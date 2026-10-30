# SpotFinder abuse prevention: prepared design, not active protection

**State:** local preparation only. The Turnstile UI and verifier in this change are not connected to a live action. No Firebase enforcement, WAF rule, DNS change, or deployment has been made. Before rollout, verify the Firebase plan in Console: a read-only Cloud Billing check on 29 October 2026 returned `billingEnabled: true`, after activity logs showed billing disabled and then assigned again.

## 1. Existing coverage and bypasses

| Operation | Current path and protection | Remaining bypass or cost exposure |
| --- | --- | --- |
| Public map, Nearby, Discover, spot detail | Client `getDocs`/`getDoc`; public-status Firestore rule | Direct Firebase traffic bypasses both Cloudflare and Vercel WAF. The `spots` rule has no query-limit cap; many reads return full documents. |
| Admin map overlays, public POI photos/ratings, status | Client Firestore reads; some callers cap results | Several collections are public; limits and cache behavior vary. |
| Publish spot | `submitSpot` callable: verified Firebase UID, content checks, transactional UID 10/day and hashed-IP 20/day limits | Trusted source of IP must be confirmed; `x-forwarded-for` is currently read directly. No Turnstile. |
| Edit/delete published spot | Owner or admin Firestore-rule checks; direct SDK writes | Bypasses callable rate limits and Turnstile. Moving edits to a trusted endpoint is a separate architecture change. |
| Draft autosave and private photos | Owner-scoped Firestore/Storage rules; 1.2-second debounce; queue serializes saves | Direct writes/uploads have no server action limit. CAPTCHA here would interrupt normal work. |
| POI review/rating | Callable, verified UID, transactional 20/hour limit; server moderation | Spot ratings, flags, votes, bookmarks, likes, and saves also have direct SDK write paths governed by rules rather than server rate limits. |
| Reports, feedback, social posts | Callables use reCAPTCHA Enterprise assessment plus transactional UID and/or hashed-IP limits | Feedback's no-auth fallback uses one shared `no-auth` key. The default reCAPTCHA hostname list omits `spotfinder.live`. |
| Community/POI image upload | Storage rules enforce owner path, JPEG and 5 MB cap; callable validates submitted photos | Storage upload itself bypasses Function rate limits. App Check and an upload-ticket architecture need staged review. |
| Admin actions | Signed admin claim on Functions/rules | Keep the claim as authorization; CAPTCHA and WAF never grant admin authority. |
| Vercel APIs | Auth token checks for account routes, webhook policy, checkout transaction limit 10/min, short cached public spot page | No Turnstile or Vercel Firewall SDK integration found in source. Dashboard WAF state was not inspected. HTTP routes can be called directly. |

Relevant code: `src/api/firebaseClient.js` (map 536, Nearby 575, direct writes 416, 681, 745, 842, 911), `src/pages/Home.jsx` (188), `src/mobile-v2/MobileV2.jsx` (343), `src/new/NewDiscover.jsx` (34), `src/new/QuickAddFlow.jsx` (147, 199), `functions/index.js` (303, 325, 398, 822, 1064, 1106, 1438), `api/create-checkout-session.js` (48), `firestore.rules` (71, 85, 100, 214, 256), and `storage.rules` (4, 15).

## 2. Layered architecture

1. **Edge:** retain Vercel's existing firewall and DDoS protection for Vercel requests. Use Cloudflare Turnstile as an independent widget on selected forms; it works without proxying the domain. Cloudflare WAF/rate rules would only cover traffic proxied through Cloudflare, not direct Firebase SDK calls or Vercel's alternate hostname. Do not enable proxying merely for this design. If it is ever considered, verify Vercel domain ownership, TLS/ACME, `/.well-known/vercel/*` cache exclusion, client-IP handling, and both cache layers first.
2. **App Check:** the client already initializes App Check before Auth, Firestore, Functions, and Storage when its public key/provider variables are present. Register the exact web app and score-based reCAPTCHA Enterprise key for each served production hostname. Use a separate nonproduction key; do not authorize localhost on a production key. App Check attests the app, not the user or request rate. It does not by itself authorize Vercel endpoints or Admin SDK calls.
3. **Action verification:** when a trusted endpoint decides a submission needs a challenge, return a challenge-required state. Mount `src/new/TurnstileChallenge.jsx`, submit its token with the *same action*, and verify it with `functions/turnstileSiteverify.js` before performing the protected write. Siteverify checks the secret, success, exact hostname/action, age, and one-time redemption. The secret lives only in the server environment. Never take an action merely because the browser reports success.
4. **Server limits:** use the verified Firebase UID as the primary key for authenticated actions. For guests use a server-verified anonymous Firebase UID or signed session plus a deliberately high network fallback. Do not take UID, IP, role, or bypass flags from request JSON. Use a transaction before expensive work; include `retryAfterSeconds` in callable error details and `429`/`Retry-After` for HTTP routes. Keep one bounded counter per subject/action/window, and clean up old counters with an explicitly costed lifecycle. No counter read/write on map movement, search keystrokes, or public reads.
5. **Read protection:** split `get` and `list` for public `spots`, then cap `request.query.limit` after auditing every existing caller (the current viewport cap is 500). Preserve owner/admin access and public anonymous browsing. A rule limit caps one query, not the number of queries. Reuse viewport and in-flight request caches; send only approved summary fields through a future CDN publication path, with full details fetched on demand. Keep image caching separate from Firestore egress.

### Architecture decision before wiring

Direct Firestore and Storage writes cannot be made subject to a trusted server counter or Turnstile by adding frontend checks. Two viable paths are **(A)** migrate selected actions to authenticated Vercel routes using Admin SDK or **(B)** migrate them to Firebase callables. Both require replacing client write paths, maintaining rules, and testing old-client compatibility. Firebase Functions deployment is unavailable on Spark; Vercel routes introduce their own secret, App Check token verification, and Admin SDK authorization obligations. Choose one path for each action before wiring the prepared helper. Do not weaken rules to ease migration.

## 3. Initial policy for later implementation

These are starting limits, not active settings. Count successful attempts and rejected bursts separately. Keep network limits much higher than account limits to avoid blocking households, schools, or mobile carrier NATs.

| Action | Account/guest starting limit | Escalation |
| --- | --- | --- |
| Publish community spot | Preserve 10/account/day; 3/hour warning | Challenge on unusual burst; deny with cooldown after limit. Keep network fallback above normal shared-IP use. |
| Edit published spot | 30/account/hour, 100/day | Cooldown on burst; challenge only after suspicious pattern. |
| Spot/POI rating or review | Preserve existing POI 20/account/hour initially; 50/day review | Challenge for repeated review churn, then cooldown. |
| Like, save, vote | 30/account/minute, 200/day each | Short cooldown first; avoid routine CAPTCHA. |
| Report | Preserve 8/account/hour; one open report per target | Challenge on burst, then cooldown; trusted duplicate check. |
| Photo upload | 20/account/hour, 50/day, existing 5 MB/file and per-spot limits | Verify identity before upload ticket; avoid processing rejected bytes. |
| Sensitive account action | 5/account/hour, 20/day | Recent authentication and longer cooldown; CAPTCHA is additional friction only. |
| Public feedback | Preserve 5/verified guest session/hour, but remove shared `no-auth` bucket | Challenge high-risk traffic; high network ceiling; `429` with retry. |
| Draft autosave | Debounce, queue, coalesce; generous 30/account/minute alert only | Never show repeated CAPTCHA; temporarily pause and retry locally if truly excessive. |

Tune using the 95th/99th percentile of **legitimate successful actions**, false positives, shared-IP support reports, and cost per action. A first burst should yield a short cooldown or challenge; continued excess receives 429 plus a bounded retry interval; persistent abuse receives a time-limited server restriction and moderation alert. Store only aggregate counters, not raw per-request logs.

## 4. App Check rollout and rollback gate

1. Verify Firebase billing plan, registered web app, reCAPTCHA Enterprise score-based key, exact authorized production hostnames, and separate Auth authorized domains. The current `functions/index.js` default hostname fallback omits `spotfinder.live`; update it only with the actual server configuration and local test before rollout.
2. Test App Check initialization and token delivery with emulators, mocks, and a controlled nonproduction registration. The current client silently returns `null` when public App Check configuration is absent. Confirm the deployed build includes the correct public key/provider and that the web registration matches. Keep local development emulator-only; never ship a debug token or add localhost to the production key.
3. Deploy **client initialization alone** while Firestore, Storage, Auth, and Functions enforcement remain off. Check real app flows on every intended hostname, including anonymous map browsing, account and draft flows, Storage uploads, and callables.
4. Monitor Firebase App Check verified/outdated/unverified request categories per product for at least a full normal-usage cycle. Require stable healthy verification for legitimate web and any mobile clients before enabling one product at a time. A previous enforcement attempt broke the app, so treat any unexplained unverified share as a stop condition.
5. Enable one product's enforcement manually only after the gate passes. Watch errors and successful operation counts immediately. If legitimate requests fail, **disable that product's enforcement first**; roll back the client only after access is restored. Never make enforcement and client changes in the same release.

## 5. Local verification and costs

Prepared modules have no live imports, secrets, or deployment effect. `tests/turnstile-siteverify.test.js` uses a mock Siteverify response; it covers success, wrong hostname/action, malformed/expired/replayed token, missing secret, and unavailable service. Before integration, add emulator and UI tests for two concurrent requests against one counter, identity spoofing, guest/authenticated users, users sharing an IP, missing App Check, challenge remounts, map query deduplication, Firestore confidentiality, and every direct-write migration. No production Firebase call is needed for those tests.

Turnstile's Free plan currently allows up to 20 widgets, 10 hostnames per widget, and unlimited challenges/validations; its independent widget needs no Cloudflare proxy. Firestore's free quota includes 50,000 reads/day, 20,000 writes/day, and 10 GiB outbound/month; transactional action counters add Firestore operations, so do not apply them to public reads. On Blaze, excess reads, writes, egress, Functions, and verification services may create charges. On Spark, Functions cannot be newly deployed, and quotas can shut off service rather than bill overage. Recheck actual regional prices and current plan before rollout. Existing Firebase rules `get()` calls may themselves incur reads even on rejected requests.

**Manual setup later:** create separate Turnstile widgets for production and nonproduction hostnames; store only the site key in Vite and the secret only on the chosen server; update CSP for `challenges.cloudflare.com` script/frame/connect destinations after testing; register the reCAPTCHA Enterprise score key with the Firebase web app and exact domains; configure the public App Check key/provider per build environment; verify product metrics; then consider enforcement. No Cloudflare DNS, WAF, Vercel, or Firebase settings were changed by this preparation.
