# SpotFinder — Security & Moderation Review

**Scope reviewed:** the exported source tree (React + Vite web app, wrapped in Capacitor
for `com.spotfinder.app`; Firebase Auth/Firestore/Storage backend; Vercel serverless
API for Stripe billing). No native `android/` or `ios/` project folders were included
in this export (Capacitor generates them at `npx cap add`/build time), so
manifest-level and platform-binary checks (Sections 6–7, 9) are marked **not
verifiable from this export** rather than pass/fail — re-run those checks against the
generated native projects before a release.

**What changed in this pass:** `firestore.rules` hardened, `functions/` (new) added
for server-side moderation and trusted aggregate computation, `src/lib/moderation.js`
(new) for client-side spam/rate-limit UX, and moderation checks wired into the two
main free-text submission flows (`AddSpotModal`, `POIDetailPanel`).

---

## 0. Moderation & Anti-Spam — what "these people" can currently do, and what changed

Before this pass, **every** piece of community moderation (flags, votes, rating
averages, IP bans) was enforced only by the *client-side JavaScript*. Firestore
Security Rules — the actual security boundary — only checked `isAuth()` on most
writes. Anyone can register a free Firebase account and then call the Firestore SDK
directly (bypassing your app entirely, e.g. from browser devtools) to:

- Post unlimited spots/reviews with arbitrary text, no length or content limits.
- Rate the same spot repeatedly (no server-side de-dupe) to inflate or tank its score.
- Flag or vote as many times as they like (`flags`/`votes` had **no rule at all**, so
  in the exported ruleset those writes are actually rejected outright by Firestore's
  default-deny — meaning flagging/voting may be silently broken in production, or the
  deployed rules differ from this export and are more permissive. Either way, verify).
- Call `updateDoc` on any spot's `rating`, `flag_count`, or `status` fields directly,
  since nothing in the rules ever protected those fields specifically.

**Fixes applied:**
| Area | Before | After |
|---|---|---|
| Rating aggregates | Any authenticated write to `spots/{id}` could set `rating`/`rating_count` | New `spot_ratings/{spotId_uid}` collection, one doc per user per spot (dedupe by document ID), aggregates recomputed **only** by a Cloud Function (`onSpotRatingWritten`) — clients can never write the average directly |
| Flags/votes | No Security Rule existed for these collections | Added rules requiring `docId = spotId_userEmail`, one per user; `flag_count`/auto-hide now recomputed server-side (`onFlagCreated`) instead of by the reporting client |
| Spam text | No validation at all | `src/lib/moderation.js` blocks obvious spam client-side before submit; `functions/index.js` re-checks server-side (the real gate) and auto-flags/hides content that scores high on link-spam, banned terms, shouting, repeated characters |
| Volume abuse | None | Per-user rate limits enforced in Cloud Functions via a transactional counter doc (10 spots/day, 20 POI reviews/hour) — client-side limiter in `moderation.js` is UX-only and explicitly documented as bypassable |
| IP bans | `ip_bans` collection existed but nothing ever checked it against the writer's IP | Still unenforced — Firestore triggers cannot see a client's IP. To actually act on `ip_bans`, route writes through an HTTPS **callable** Cloud Function (which does get the caller's IP) or put App Check + Cloud Armor in front, rather than writing straight from the client SDK. Flagged as an open item below. |
| Fake accounts | `registerWithEmail` has no verification requirement | Recommend requiring `sendEmailVerification()` and gating spot/rating creation on `user.emailVerified` — cheap, meaningfully raises the cost of spam accounts |

**Follow-up work not done in this pass** (flagging so it isn't lost):
1. ~~Migrate `submitCategoryRatings()`...~~ **Done** — now writes to `spot_ratings/{spotId}_{uid}`.
2. ~~Move `flagSpot`/`voteSpot` field names...~~ **Confirmed already correct** — no change needed; `flagSpot` no longer writes `flag_count`/`status` directly (that's the Cloud Function's job now).
3. ~~Add an admin review queue UI...~~ **Done** — new "Moderation" tab in `SuperAdminEditor.jsx` (flag queue + site status control). Note: it doesn't yet surface the softer `needs_review: true` items (low-confidence spam scores) — only hard `flagged`/`hidden` content and user reports. Add a second list for those if you want reviewers to catch borderline cases too.
4. ~~Require email verification...~~ **Done** — `firestore.rules` now requires `request.auth.token.email_verified == true` on every content-creation path; `registerWithEmail` sends the verification email; a dismissible banner (`StatusBanner.jsx`) prompts unverified users to verify/resend.

**Also found and fixed while investigating (not on the original list, but real bugs):**
- The **report button didn't exist anywhere in the UI** — `flagSpot()` was fully implemented in `firebaseClient.js` but no component ever called it. Added to `SpotDetailModal.jsx`.
- The **status banner never rendered** — same root cause pattern: `getMaintenanceStatus()` existed but nothing called it, *and* `firestore.rules` had no rule for the `config` collection it reads, so even a correct call would have failed with permission-denied. Added the rule and a real `StatusBanner.jsx`, mounted in `Layout.jsx`.
- **Feedback never emailed anyone** — the form only ever wrote to Firestore. Added a Cloud Function (`onFeedbackCreated`) that sends an email via SMTP whenever non-spam feedback comes in.
- **Stripe subscriptions likely never activated**: `create-checkout-session.js` never sent `userId` to Stripe, so the webhook had nothing to attribute a paid subscription to. Both the webhook and `subscription-status` endpoint were also using the *client* Firestore SDK from a serverless function — which can't authenticate as anyone and would fail outright, or (worse) succeed only if rules were looser than they should be. Rewrote both to use the Firebase Admin SDK (`api/_firebaseAdmin.js`) and pass `userId`/`plan` through Checkout Session metadata.
- **`subscription-status` had no auth check (IDOR)** — anyone could pass any `userId` and read that person's plan/status. Now requires a verified Firebase ID token matching the requested `userId`.
- **Admin actions (ban IP, resolve flag, delete spot) now go through audited Cloud Function callables** (`adminBanIP`, `adminUnbanIP`, `adminResolveFlag`, `adminDeleteSpot`) instead of direct client Firestore writes — every action guarantees an `admin_audit_log` entry, closing that "Low" item from the priority list.

**Still open / deliberately deferred:**
- **Stop storing contributor emails on public spot documents** — not done. This cascades into every place that checks `created_by == auth.token.email` (rules) or queries "my spots" by email (`firebaseClient.js`, several components), so it needs its own careful pass rather than a partial edit that could silently break ownership checks. Recommended approach: add `created_by_uid` alongside the existing `created_by` field, migrate ownership checks in rules and code to use `created_by_uid`/`request.auth.uid`, then stop writing/returning `created_by` (email) in public reads.
- **Custom claims migration** — the mechanism is built (`functions/setAdminClaim.js`), but you still need to run it once (see that file's comment block) and then remove the hardcoded-email fallback from `isSuperAdmin()` in `firestore.rules`.

---

## 1. MASVS-AUTH — Authentication & Authorization

- **Auth model:** Firebase Auth (email/password + Google). No MFA / step-up auth for
  sensitive actions (e.g. deleting a spot, admin actions) beyond the single
  `superadmin@spotfinder.cz` email check.
- **Finding (Medium):** `isSuperAdmin()` is a hardcoded email string comparison
  (`firestore.rules`, `firebaseClient.js`). This works but is fragile — a Firebase
  custom claim (`request.auth.token.admin == true`) is safer against email changes
  and is easier to audit/rotate than a string baked into rules and client code.
- **Finding (Medium):** No re-authentication ("step-up") is required before
  destructive actions like `deleteSpotAsSuperAdmin` or IP bans — a compromised admin
  session can act indefinitely.
- **Finding (Low):** No email verification enforced before a new account can write
  content (see §0) — trivial to mass-create throwaway accounts.
- **Not verifiable from this export:** local/biometric auth (no native project),
  session/token storage on-device (see §5).

## 2. MASVS-CODE — Code Quality

- **Dependencies:** `firebase-admin` is listed in the **root/client**
  `package.json`, which is a red flag in general (it's a server-only SDK) — but
  `grep -rn "firebase-admin" src/ api/` returns nothing, so it's not actually
  imported into the client bundle. Still recommend removing it from the root
  `package.json` (it's now properly declared in `functions/package.json`) so a
  future contributor doesn't accidentally import it into `src/` and ship
  service-level code into the public web/mobile bundle.
- **Input validation:** Prior to this pass, none of the Firestore writes validated
  field types/ranges/lengths — fixed for the collections above in `firestore.rules`.
- **Error handling:** Several `catch` blocks (`console.error` then silently continue,
  e.g. image upload failures in `AddSpotModal.jsx`) swallow errors without surfacing
  them to the user, which can mask partial-failure states.
- **Forced update mechanism:** none observed — no version-gating in Firestore rules
  or a remote-config check. For a Capacitor app with an unreviewed web bundle
  pushed independently of the store binary (see §9), this matters less for the web
  layer but the native shell should still refuse to run a bundle whose contract
  it doesn't understand.

## 3. MASVS-CRYPTO — Cryptography

- No custom cryptography is implemented in the reviewed source — the app relies on
  Firebase SDK/TLS and Stripe for all sensitive operations, which is the right
  default (don't roll your own crypto).
- **Finding (Info):** `firebaseConfig` (API key, project ID, etc.) is a public,
  client-embedded config by Firebase design — this is expected and not a secret, but
  confirm the file isn't also carrying anything that *should* be secret (it should
  only ever contain the public web config).
- **Finding (High) — secret handling in serverless functions:** `STRIPE_SECRET_KEY`
  and `STRIPE_WEBHOOK_SECRET` are correctly read from `process.env` in
  `api/create-checkout-session.js` and `api/webhooks/route.js` (good — not hardcoded).
  Verify these are set as encrypted environment variables in the Vercel dashboard and
  never logged; `console.error('Webhook signature verification failed:', err)` is
  fine (doesn't log the secret) but double-check no other log line ever prints `body`
  or headers containing the signature.
- No hardcoded keys, weak algorithms (MD5/DES/ECB), or custom key derivation were
  found in the reviewed application code.

## 4. MASVS-STORAGE — Data Storage

- **LocalStorage usage:** the app stores non-sensitive UI state in `localStorage`
  (e.g. `RATED_KEY` flags in `SpotDetailModal.jsx`, now also the moderation rate-limit
  counters in `moderation.js`). None of this is sensitive (no tokens, PII, or
  payment data observed being persisted to `localStorage`) — good.
- **Finding (Low):** Firebase Auth's default web persistence keeps ID/refresh tokens
  in IndexedDB in the WebView. That's standard for Firebase Web SDK and reasonably
  safe on a single-user device, but note it means anyone with device/file access to
  an unlocked phone (or, on Android, `adb backup` on a debuggable/rootable device)
  could potentially extract a live session. Consider enabling
  `browserSessionPersistence` for the admin account specifically, and rely on Firebase
  token expiry + revocation for the general user base.
- **Not verifiable from this export:** Android `allowBackup`/`android:extractNativeLibs`
  flags, iOS `NSFileProtection` level, Keychain `kSecAttrAccessible` class — these
  live in the generated native project, not in this source export. Check them in the
  built `android/app/src/main/AndroidManifest.xml` and `ios/App/App/Info.plist`
  before release; for a Capacitor app the defaults are usually acceptable but
  `allowBackup="false"` is worth setting explicitly if any sensitive cache is ever
  added later.

## 5. MASVS-NETWORK — Network Communication

- All backend traffic goes through Firebase SDKs (enforced TLS) and `fetch()` to
  the app's own Vercel API — no evidence of manually-constructed insecure HTTP calls.
- `create-checkout-session.js` sets CORS to an explicit allow-list
  (`https://spotfinder.cz` + localhost), which is correct; make sure the fallback
  branch (`: 'https://spotfinder.cz'`) doesn't accidentally reflect an
  attacker-controlled `Origin` header in a future edit — right now it correctly
  falls back to a fixed origin rather than echoing the request's `Origin`.
- **Not verifiable from this export:** Android Network Security Config /
  `usesCleartextTraffic`, iOS ATS exceptions, and certificate pinning all live in the
  generated native project. `capacitor.config.ts` has no `server.cleartext: true` and
  no custom scheme override, which is the secure default — just confirm the built
  `AndroidManifest.xml` doesn't add a permissive `network_security_config.xml`.

## 6. MASVS-PLATFORM — Platform Interaction

- This is a Capacitor WebView app, so the "WebView" *is* the app — the main platform
  risk is what content the WebView is allowed to load. `capacitor.config.ts` uses the
  default (no custom `server.url` pointing at a remote origin, no
  `allowNavigation` wildcard), which is good: it means the WebView only ever loads
  the bundled `dist/` and can't be redirected to arbitrary remote pages.
- **Finding (Medium):** No Content-Security-Policy meta tag was found in
  `index.html`/`dist/index.html`. Since this is a data-driven map app that renders
  user-submitted text (spot descriptions, POI reviews, feedback) into the DOM, a CSP
  is a meaningful defense-in-depth layer against any future XSS regression (e.g. if a
  markdown/HTML renderer is added later, or a dependency changes behavior). Recommend
  adding a restrictive `default-src 'self'` CSP with explicit allowances for the
  Firebase/Stripe/maplibre origins actually used.
- **Checked:** the only `dangerouslySetInnerHTML` in the codebase is in
  `src/components/ui/chart.jsx`, generating CSS from a fixed set of theme keys —
  not user-controlled input, so no XSS risk there. `react-markdown` (a dependency)
  is safe by default since it doesn't render raw HTML unless `rehype-raw` is added,
  which it isn't. No unsafe HTML injection of user content was found.
- **Not verifiable from this export:** Android intent-filter / deep-link
  configuration, iOS Universal Links association file — live in the native project.

## 7. MASVS-PRIVACY — Privacy

- **Data collected:** email, display name, GPS coordinates of user-submitted spots,
  optional photos, and (via Stripe) billing/payment metadata (handled by Stripe, not
  stored directly per the webhook code, which only stores plan/status/customer ID).
- **Finding (Medium):** Precise GPS coordinates of "hidden"/"secret" spots
  (camping, viewpoints, etc.) are stored with `is_public: true` and readable by
  anyone (`allow read: if true` on `/spots`) regardless of auth state. This is
  presumably the product's whole point, but it means the app **is** a public
  geolocation database of user-submitted content — make sure users are clearly told,
  at submission time, that a pin's coordinates are public and permanent (privacy
  transparency), and that there's a way to request removal of a spot that
  inadvertently reveals a private location (private property, someone's driveway,
  etc.) — the existing `flags` reason `private_property` suggests this is already
  partly handled by product design.
- **Finding (Low):** `created_by`/`created_by_name` (email-derived) are stored on
  every public spot document and readable by anyone. Consider storing only a
  `uid`/display name for public documents and keeping the email server-side, since
  email addresses are often treated as PII and this exposes every contributor's
  address to anyone who reads the public spots collection.
- No third-party analytics/tracking SDK was found in `package.json` — good; if one
  is added later, it needs a consent flow and disclosure to satisfy MASVS-PRIVACY-3.

## 8. MASVS-RESILIENCE — Reverse-Engineering Resilience

- As a Capacitor/WebView app, the "binary" is largely a bundled JS app — meaningful
  root/jailbreak detection, anti-tampering, and anti-debugging are a native-layer
  concern and **not present or verifiable in this export** (no native project).
- Given the app is a community map/rating tool (not a payments-holding wallet or
  DRM product), MASVS-RESILIENCE is reasonably a **low priority tier** here — the
  NowSecure risk-tiering guidance in `secure-mobile-dev-guide` would classify this as
  a low-to-medium risk app (no on-device secrets, no offline payment logic,
  server-mediated billing via Stripe Checkout). Recommend focusing hardening effort
  on §0 (moderation/anti-spam) and §4/§7 (storage/privacy) rather than investing in
  root detection or obfuscation, which add engineering cost with limited payoff for
  this app's actual threat model.

## 9. Threat Model Summary (STRIDE, abbreviated)

| Threat | Vector | Mitigation status |
|---|---|---|
| Spoofing | Fake/throwaway accounts posting spam | Partially mitigated this pass (rate limits, content scoring); email verification still recommended |
| Tampering | Direct Firestore SDK write bypassing app UI to fabricate ratings/flags | **Fixed this pass** — rules now validate ownership, shape, and lock aggregate fields to server-only writes |
| Repudiation | No audit log of admin actions (bans, deletes, flag resolutions) | Not addressed — recommend an `admin_audit_log` collection written by Cloud Functions whenever `isSuperAdmin()` actions occur |
| Information Disclosure | Public read on `spots`/`poi_*` exposes reporter emails and precise coordinates | Partially addressed above (§7); recommend removing email from public docs |
| Denial of Service | Unlimited public writes to `feedback` (no auth required) | **Mitigated this pass** — length cap in rules + spam scoring in `onFeedbackCreated` |
| Elevation of Privilege | Hardcoded superadmin email vs. custom claims | Flagged (§1); recommend migrating to custom claims |

## 10. Penetration-Test Checklist (quick-reference for a follow-up pentest)

- [ ] Attempt direct Firestore writes (via a throwaway script + the public
      `firebaseConfig`) to `spots`, `spot_ratings`, `flags`, `votes`, `feedback` —
      confirm the new rules reject malformed/out-of-range/duplicate writes.
- [ ] Attempt to update `spots/{id}.rating` as a non-owner and as the owner — both
      should now fail (aggregate fields are locked, see §0/rules).
- [ ] Fuzz `api/create-checkout-session` with missing/invalid `priceId`, oversized
      payloads, and forged `Origin` headers — confirm 4xx and no Stripe session leaks.
- [ ] Replay a captured Stripe webhook payload with a stale/invalid signature —
      confirm `stripe.webhooks.constructEvent` rejects it (code already does this).
- [ ] Confirm `superadmin@spotfinder.cz`-gated functions (`banIP`, `deleteSpotAsSuperAdmin`,
      `resolveFlag`) reject a non-admin authenticated user.
- [ ] Once native projects are generated: run the standard MASTG static+dynamic
      suite (root detection bypass, cleartext traffic capture via a proxy,
      backup extraction) — not possible against this source-only export.

## 11. Priority Fix List

| Priority | Item | Status |
|---|---|---|
| High | Lock rating/flag/status fields so only server code can write them | **Done** |
| High | Add missing rules for `flags`/`votes`/`users` collections | **Done** |
| High | Server-side spam scoring + rate limits | **Done** |
| High | Fix Stripe webhook/subscription-status using the wrong SDK + missing auth | **Done** |
| Medium | Migrate `submitCategoryRatings` to per-user rating docs; deploy `functions/` | **Done** (still needs `firebase deploy`) |
| Medium | Require email verification before write access | **Done** |
| Medium | Move admin check to Firebase custom claims instead of a hardcoded email | **Mechanism built** — run `setAdminClaim` once, then remove the fallback |
| Medium | Add a restrictive CSP to `index.html` | **Done** |
| Medium | Stop storing contributor emails on public documents | Open — deferred, see §0 |
| Low | Add an `admin_audit_log` for superadmin actions | **Done** |
| Low | Remove `firebase-admin` from root `package.json` | **Reverted** — it's legitimately needed by `api/`, corrected in §2 |
