# App Check and spot-owner release checklist

This is an offline release plan. The checked-in Firebase Web app initializes Auth, Firestore, Functions and Storage from `src/api/firebaseClient.js`. Before this change it never initialized Firebase App Check. The public form's Enterprise reCAPTCHA (`src/lib/recaptcha.js`) serves a different purpose and its key must not be reused silently as an App Check registration. Missing App Check initialization is a source-confirmed cause of unverified web requests; the exact cause of the reported production 401s still requires Console evidence.

## App Check configuration and Console actions

1. In Firebase Console, identify the registered Web app ID matching `src/api/firebaseConfig.js` and inspect its App Check provider and key. Set the **public** `VITE_FIREBASE_APP_CHECK_PROVIDER=enterprise` and `VITE_FIREBASE_APP_CHECK_SITE_KEY` to that registration's public score-based web key in each relevant Vercel build environment. The current client rejects the `recaptcha-v3` provider setting. Do not put a reCAPTCHA secret, service account, or debug token in Vite variables. Do not reuse `VITE_RECAPTCHA_SITE_KEY` without verifying that the same key was deliberately registered for App Check.
2. In the matching reCAPTCHA key settings, authorize the actual web origins, including `spotfinder.live`, `www.spotfinder.live`, and `old.spotfinder.live` **only if it serves a deployed client**. Add only the real preview or alternate domains that must receive tokens; use a separate nonproduction key/registration where practical. Firebase Authentication's Authorized domains for Google/redirect sign-in are a separate Console list and must include the actual sign-in origins. Confirm email/password and anonymous providers remain enabled.
3. Do not add `localhost` to a production reCAPTCHA key. Local development now uses the Firebase emulators and does not request production App Check tokens. The old `VITE_FIREBASE_APP_CHECK_DEBUG` flag is no longer supported. Real Enterprise attestation must use a separate staging Firebase web app and hostname; follow `docs/app-check-staging-runbook.md`.
4. Check that all Firebase Web app registrations used by the original and `/new` deployments have an attestation provider. Verify the build's `appId`, provider and site key together. The site key is public; Firebase/Vercel configuration values and registration state were not changed in this task.
5. Check the Capacitor Android build separately. It runs the web Firebase SDK inside a WebView, while the production web reCAPTCHA key should not authorize a `localhost` WebView origin. A native App Check path using the registered Android app and Play Integrity (or a proven equivalent bridge) must be implemented and observed before enforcing services used by Android. This change does not claim Android attestation works.

App Check now initializes on the existing default Firebase app before `getAuth`, `getFirestore`, `getFunctions`, or `getStorage`, and token auto-refresh is enabled. It logs a configuration error in production if the public key/provider is absent. Initializing the SDK does not itself prove that token exchange succeeds. Public-form reCAPTCHA, MFA's `RecaptchaVerifier`, Firebase Auth credentials and App Check are separate controls.

## Manual compatibility checks (no production probing by this audit)

In a controlled preview with enforcement **off**, use only owner-approved dummy accounts and records. For each deployed web origin and the Android build if supported:

- Open a fresh session and confirm anonymous guest sign-in, a public spot load, and the Firebase App Check metrics category for Auth and Firestore.
- Sign in using email/password and Google (including redirect return where used); confirm no `auth/firebase-app-check-token-is-invalid` or Firebase 401 response. Confirm sign-out and re-entry.
- Load public spots and save/unsave a dummy spot; check Firestore request success and Verified metrics.
- Create a dummy spot via `submitSpot`, edit its allowed text/visit fields, then upload a prepared JPEG and edit its photos through `updateSpotPhotos`; check Functions, Firestore, and Storage Verified metrics and expected ownership denial for another dummy account.
- Repeat on `spotfinder.live`, `www.spotfinder.live`, `old.spotfinder.live` if deployed, and any intended preview origin. Do not infer one origin's success from another.

Wait for representative legitimate traffic with a high Verified share for every service and client cohort before considering enforcement. Do not enable enforcement as part of this change. If enforcement is already on and legitimate clients are failing, the owner should first use the Firebase Console rollback control for the affected service; changing Firestore rules will not repair invalid App Check tokens.

## Deployment parity and release order

Before release, an owner should compare the **deployed** Firestore rules with `firestore.rules`, Storage rules with `storage.rules`, and deployed callable names/revisions with `functions/index.js`. Confirm whether App Check is enforced separately for Authentication, Firestore, Storage and each callable; the checked-in Functions do not set `enforceAppCheck`. Confirm the active Firebase project, Web app ID, Storage bucket, Vercel build variables per domain, Auth Authorized domains, reCAPTCHA key domain list, and Android App Check registration. No remote values were read here.

Safe order for the spot-owner fix:

1. Save the current deployed rules, callable revisions, web build and App Check enforcement settings as rollback references. Keep enforcement off during the App Check verification period.
2. Deploy the new `updateSpotPhotos` callable and verify it with dummy owner/nonowner records while the old rules still allow the older client. The callable accepts only owner content/photo patches and validates new project-bucket JPEG objects.
3. Release the web client with matching public App Check configuration and the photo-edit callable path. Check original and `/new` interfaces, all deployed domains, guest/authenticated paths, and Android compatibility before proceeding.
4. Deploy the narrow `firestore.rules` owner allowlist only after the new callable and client work. Re-run dummy owner, other-user, admin and draft checks against the deployed revision through owner-controlled release validation. Direct image/reference updates from older clients will fail after this step; plan a client update window.
5. Monitor App Check Verified metrics and application errors. Consider per-service enforcement later, only after every legitimate web and Android client is represented by verified traffic.

Rollback: restore the saved Firestore rules first if legitimate owner edits fail, then restore the prior web build and callable revision as needed. If App Check enforcement causes valid traffic failures, the owner should disable enforcement for the affected service in Firebase Console while preserving rules, investigate the app/provider/domain mismatch, and redeploy a corrected client before re-enabling. Do not loosen Storage rules or publish a debug token to recover traffic.
