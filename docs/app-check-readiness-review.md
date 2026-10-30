# Firebase App Check readiness review (2026-10-30)

**Decision: do not enforce yet.** This review changes no Firebase Console setting, security rule, function deployment, or billing plan.

## What the repository proves

- `src/api/firebaseClient.js` is the shared web Firebase entry point for the original app, `/new`, admin UI, guests, Auth, Firestore, Functions, and Storage. It initializes App Check before obtaining service instances. `firebaseAppCheck.js` reuses the instance for the default app and enables automatic token refresh. Local emulator-only mode intentionally skips App Check.
- Production web identity in `firebaseConfig.js`: project `spotfinderapp-cdc7b`, app ID `1:179466659021:web:f93b90b96948a264d23584`. These are source values, not a Console verification. No production App Check site key, registered key/domain list, or Vercel environment scope is available in this workspace.
- All 29 callable definitions use `enforceAppCheck: false`; Firestore and Storage rules remain independent authorization controls. Vercel App Check switches are separate; the report pilot requires App Check only when its own pilot is enabled.
- A missing `VITE_FIREBASE_APP_CHECK_SITE_KEY` or mismatched provider causes App Check initialization to return null, so SDK requests cannot be verified. This is a plausible cause of earlier 0% verified metrics, but those metrics and old deployment artifacts are unavailable here. Enforcing against absent tokens can cause 401s; Firestore/Storage permission errors can also arise from rules, Auth, project mismatch, or service availability. Do not assign a single root cause without Console and request evidence.
- Staging-only diagnostics now report `not configured`, `attestation ready`, `attestation unavailable`, or `attestation failed`. They never report token values, key values, provider error messages, or credentials. The production bundle has no debug-token assignment in repository source.

## Manual scenario checks before enforcement

Use a separate, registered staging web app and small synthetic dataset. Keep all enforcement off. For each row, verify a valid App Check token is attached to the relevant SDK request in developer tools **by presence only**, check the expected Firebase project, compare App Check Console verified/invalid/outdated metrics, and confirm the user action succeeds. Do not copy token values into logs or reports. Browser and hosted tests were not run in this repository review.

| Scenario | Required path and observation |
| --- | --- |
| Anonymous visitor | Restored session or guest creation; public map and `/new` reads remain available; Firestore requests verified. |
| Google login | Popup/redirect completion, restored session, subsequent Firestore request verified. |
| Password login | Login, email verification/recovery behavior, subsequent Firestore request verified. |
| SMS MFA | Enrolled password sign-in completes second factor; Auth and subsequent service requests succeed. Verify Google sign-in separately; do not assume identical MFA coverage. |
| Map browsing | Nearby, viewport, detail, and old cached bundles work; Firestore verified share is healthy. |
| Drafts | Owner create, edit, reload, and private draft reads remain authorized. |
| Uploads | Community and draft upload/download only if Storage is actually available; check both SDK attestation and Storage rules. |
| Reporting | Callable path and optional Vercel pilot tested separately; confirm App Check, Auth, Turnstile, and rate controls independently. |
| Admin | Admin callable and Firestore flows succeed only for valid claims; test a denied nonadmin user. |
| Account deletion | Reauthentication and deletion callable work; signed-out client cannot retain access. |
| Capacitor/WebView | Test installed Android app, origin/key compatibility, cold start, offline/reconnect, and old versions before any web enforcement. |

## Production rollout gates

1. In Firebase Console, confirm project, web app ID, App Check registration, actual Spark plan, and per-product enforcement status. In Google Cloud Console, confirm a score-based reCAPTCHA Enterprise web key registered to the **same app**, with domain verification on and every genuinely served production hostname allowed. Check the actual Vercel domains and Firebase Auth authorized domains separately. Never add localhost to the production key.
2. In Vercel Production variables, set the public `VITE_FIREBASE_APP_CHECK_SITE_KEY` and `VITE_FIREBASE_APP_CHECK_PROVIDER=enterprise`. Confirm Preview uses a different staging Firebase app/key and that no debug token or service credential appears in client assets. Keep all `VERCEL_APPCHECK_ENFORCE_*` switches off.
3. After separate deployment approval, build and deploy the compatible client **with enforcement still off**. Verify the built app ID/project and token presence on a real production hostname. Monitor Verified, Outdated, Unknown, and Invalid metrics for a representative cycle, including old bundles and WebViews. Establish an immediate rollback owner and procedure.
4. Only after each product's legitimate traffic is demonstrably verified, seek separate approval for one enforcement switch at a time. Recheck login, map, drafts, uploads, reporting, admin, and deletion after each switch. Roll back the newly enabled switch immediately if real users receive 401s, permission errors, or missing data.

## Spark limits

App Check registration and Firestore enforcement are available on Spark within applicable quotas; reCAPTCHA Enterprise assessments have a no-cost allowance and Spark score limitations. Firebase Authentication App Check enforcement requires Authentication with Identity Platform, whose status is unverified here; leave Auth enforcement off. New Cloud Functions deployments require Blaze, so do not plan a callable enforcement code rollout on Spark. Current Firebase Storage documentation says Storage requires Blaze and Spark bucket API calls fail with 402/403; verify the actual project's status before treating uploads as an App Check issue. None of these controls replaces Auth, security rules, or rate limiting.
