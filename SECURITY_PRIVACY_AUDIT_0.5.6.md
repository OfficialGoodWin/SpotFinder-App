# SpotFinder 0.5.6 security and privacy implementation audit

Date: 13 October 2026  
Status: engineering review; not legal advice and not approval for publication or production deployment.

## Data-flow inventory

| Data | Collection and processing | Transmission / storage | Deletion or retention behavior |
|---|---|---|---|
| Firebase Auth email/password | Email and password registration/login in `firebaseClient.js`; plaintext password is passed to the Firebase SDK, not stored by app code | Firebase Authentication; auth state is held by the Firebase client SDK | Auth user is deleted by `requestAccountDeletion` after cleanup; failed cleanup leaves Auth available for retry |
| Google sign-in | Google popup/redirect requests email/profile scopes | Google Identity/Firebase Authentication; display name, email and photo URL enter Auth state | Same Auth deletion path; Google may retain its own account/provider records |
| Private user profile / DOB | New email/password registration sends full `YYYY-MM-DD` to callable `setAccountDateOfBirth`; server validates calendar date and age 16–120 | Private `users/{uid}` Firestore document; rules are owner-read/server-write | Deleted during account cleanup. The legacy-account DOB reminder/deadline migration and scheduled 30-day deletion were removed |
| SMS MFA phone | Collected only in Settings enrollment; E.164-like format checked before Firebase SMS request | Firebase Authentication/Identity Platform and SMS delivery providers | Enrollment state is removed with Auth account; UI says active only after enrollment completes |
| Public spots | Coordinates, title, description, directions, categories, attribution and photo URLs sent to `submitSpot` | Public Firestore `spots`; new writes no longer copy account email, but still contain `created_by_uid` for rule-based ownership | Retained with direct contributor fields relabeled/removed on account deletion; public photo URLs may retain a pseudonymous UID path |
| Ratings / reviews | Spot category ratings are keyed by spot + UID; POI reviews currently store an email-derived `created_by` field | `spot_ratings` is owner/admin-readable after this audit; `poi_ratings` is public | Spot ratings deleted; POI reviews retained and contributor field de-identified. Legacy public identifiers require migration |
| Likes, saves, votes, bookmarks | UID used for modern likes/saves; email used by legacy votes/bookmarks | Private/registered-user Firestore collections; aggregate counts copied to public spot | Relations deleted by UID/email; aggregate triggers recalculate when applicable |
| Photos | Browser validates signature/dimensions, decodes and re-encodes to JPEG; Storage rules enforce owner path, JPEG, and 5 MB processed limit | Public `community/{uid}/*.jpg`; private `drafts/{uid}/{draftId}/*.jpg`; public download URL in spot/POI docs | Private drafts deleted. Public contribution photos are retained under a former-contributor label, but their URL path can retain a pseudonymous UID. Admin content deletion removes managed uploads |
| Feedback | Message, optional email, locale, reCAPTCHA result, account/session UID, salted IP hash | Callable to Firestore `feedback`; optional SMTP notification sends message and optional reply-to | Deleted on account deletion when linked by UID/email; no approved general retention period yet |
| Reports / moderation | Report text/target, reporter UID/email, device hash, salted IP hash and reCAPTCHA score | Server-only `reports`, `report_blocks`; admin tools only | Reporter UID/email removed on account deletion; hashed anti-abuse/moderation record retained pending approved schedule |
| IP / abuse metadata | Cloud Function extracts request IP and HMAC-hashes it with `ANTI_SPAM_IP_SALT`; raw IP is not written by reviewed functions | Hash in feedback/reports/rate limits; providers/hosting still see raw network IP | Account-linked counters removed where addressable; fixed hash/log retention is unresolved |
| Precise location / search / routes | Browser geolocation feeds map/nearby UI. Search, reverse geocoding, start and destination coordinates are used for provider requests | Geoapify, Mapy/Seznam, OpenRouteService, public OSRM and configured tile/POI services; local/offline routing where selected | App code does not intentionally persist user GPS history server-side; providers control their logs |
| Analytics | GA script injected only when analytics consent is true; IP anonymization option requested | Google Analytics; consent in `spotfinder_cookie_consent_v1` local storage | Revocation sends denied consent, removes loader and first-party `_ga*` cookies; provider-side prior data is not automatically erased |
| Advertising | AdSense script/ad requests only when ads consent is true | Google AdSense | Revocation sends denied consent, removes loader/content and known first-party ad cookies; third-party cleanup depends on browser/provider |
| Stripe | Authenticated server endpoint creates allowlisted-price subscription Checkout only when server `SUBSCRIPTIONS_ENABLED=true`; verified webhook updates entitlement | Stripe gets account email, UID/plan metadata, billing/payment details; Firestore stores plan/status/customer/subscription/end | Account cleanup deletes local `users` record. Stripe/tax record retention and cancellation/refund operations require approval |
| Social content | Strict HTTPS host/path allowlist canonicalizes Instagram posts/reels and TikTok videos; server repeats validation | Canonical reference stored in public Firestore; iframe created only after per-embed click, sandboxed and lazy | Reference retained/de-identified on deletion; provider gets IP/browser data only after load click |
| Error/log data | Client currently logs some Firebase/service error objects; server logs sanitized deletion/Stripe errors but some existing paths log caught errors | Browser console, Firebase/Google Cloud or Vercel logs | Provider retention not verified. Production log sampling/redaction and retention need manual configuration review |

## Security changes in this phase

- Added authenticated account-deletion callable with a five-minute `auth_time` requirement, explicit confirmation, server-derived UID/email, idempotent cleanup, failure status, and Auth on-delete retry.
- Private data is deleted and direct contributor fields on retained public contributions are removed/relabeled; no caller can target another UID. Storage-path pseudonyms remain documented pending migration.
- Removed the legacy-account DOB reminder/deadline migration and scheduled 30-day deletion job. New email/password registration still requires a valid 16+ DOB.
- New public spot records no longer copy the account email into `created_by`.
- `spot_ratings` reads are now owner/admin only.
- Draft Storage writes now accept only processed `.jpg` files, `image/jpeg`, maximum 5 MB, in the authenticated owner's path.
- Added client DOB calendar/boundary/leap-year validation and rollback of a just-created Auth account if required DOB storage fails.
- MFA UI now distinguishes inactive from enrolled, validates international phone format, and describes primary-provider protection/recovery accurately.
- Consent preferences reopen with saved choices; rejection/revocation keeps categories independent, updates Google consent, removes loaders and known first-party cookies.
- Stripe Checkout now has a server-side disabled-by-default switch. Webhooks claim event IDs before processing and release failed claims for retry.
- Social embeds remain URL-allowlisted, click-to-load, lazy, and sandboxed; uploads remain signature/dimension checked and JPEG re-encoded.

## Known gaps and required decisions

1. **Legacy public identifiers:** existing spot, POI review/photo, vote, bookmark, flag and related documents can contain email-derived fields. Run a reviewed, backed-up migration; do not bulk-edit production as part of this audit.
2. **Public ownership architecture:** new spots still expose a Firebase UID as `created_by_uid` because direct Firestore owner edits rely on it. Move ownership to a private server collection and callable edit/delete endpoints before claiming public documents contain no authentication identifier.
3. **Retention:** approve and implement purge periods for feedback, reports, IP/device hashes, rate limits, deletion records, audit logs, platform logs and payment records.
4. **DOB minimization:** decide whether a one-time age gate or stored eligibility assertion can replace full DOB. Do not erase or transform production DOBs without approved policy and migration.
5. **Age/legal scope:** approve age threshold, parental-consent approach and jurisdictions served.
6. **Subscriptions:** checkout remains unavailable unless both client and server switches are deliberately enabled. Before enabling, add/verify cancellation tooling, invoices/tax, payment-failure handling, refund operations, checkout withdrawal request/acknowledgement, feature entitlement enforcement and access revocation.
   Account deletion is blocked while local subscription status is active, trialing, past due, or unpaid so recurring billing cannot be orphaned.
7. **Operator/legal terms:** confirm controller/operator identity, legal/service address, registration/tax status, governing law, courts, consumer dispute route and accessibility disclosures.
8. **Processors/transfers:** verify current production vendors, data regions, DPAs, roles and international-transfer mechanisms.
9. **Production consent scan:** browser automation can verify app-request behavior locally, but a production tag/cookie scan and provider-console review remain required. reCAPTCHA is security processing, not automatically exempt from every notice/legal-basis requirement.
10. **Logs:** establish structured redaction and retention. Avoid logging full Firebase/Stripe error objects where they could contain request or provider metadata.
11. **Account deletion test:** use Auth/Firestore/Storage emulators or disposable non-production accounts after function deployment; never validate by deleting a real production user.
12. **Build-tool advisories:** `npm audit` reports seven advisories (five high, two moderate) in the Tailwind 3 development/build chain (`braces` and `postcss-selector-parser` paths). `npm ls --omit=dev` shows that chain is absent from the production dependency tree, and the built browser bundle does not ship those Node tools. npm's proposed fix is a breaking Tailwind 4 upgrade, which needs a separate tested migration. The Cloud Functions package reports zero vulnerabilities.

## Verification results

- `npm test`: 48 passed, 0 failed, 2 emulator suites skipped. The passing tests include DOB boundaries/leap years, consent gating/revocation, social URL attack cases, upload signature/size/dimension checks, draft isolation, and static deletion-cleanup assertions.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run test:responsive`: passed at 10 desktop/mobile portrait/landscape viewports against the local production preview.
- `node --check` on Functions and Stripe endpoint files: passed.
- Root `npm audit`: seven build-chain advisories as described above; no forced breaking upgrade applied. `functions/npm audit`: zero vulnerabilities.
- Firestore and Storage permission suites: present but skipped because Firebase CLI/emulators were unavailable. They must run before deployment.
- Account deletion with a disposable Auth user: not run because Auth/Functions emulators were unavailable; no production account was touched.
- SMS delivery/provider recovery: not run because a configured Firebase Identity Platform test project and test phone numbers were unavailable.
- Stripe test mode: not run because enabled test keys/prices/webhook secret were not configured; server checkout remains disabled by default.
- Consent: unit behavior was verified. A production browser network/cookie scan and provider-console verification were not available and remain mandatory.

## Deployment and rollback

- Deploy Functions, Firestore rules and Storage rules together; otherwise the UI can advertise deletion before the callable exists or uploads can disagree with rules.
- Confirm required indexes for every cleanup query in a staging project. Single-field indexes are normally automatic.
- Back up/export affected Firestore collections before any legacy-identifier migration. The code in this phase performs no production migration.
- Keep `SUBSCRIPTIONS_ENABLED=false` in the server environment until the legal/operational checklist is signed off.
- Roll back UI and Functions together if deletion fails in staging. Do not roll back only the on-delete cleanup after accounts have begun using the new flow.
- Monitor `account_deletion_requests` statuses and function errors after deployment; define a support runbook for `failed` records before release.
