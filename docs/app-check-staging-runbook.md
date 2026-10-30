# SpotFinder App Check staging and enforcement runbook

**Current result: staging isolation FAIL / real attestation NOT RUN.** No staging Firebase project, Vercel project link, or staging environment variables are present in this workspace or shell. Vercel dashboard scoping and Firebase Console registration cannot be verified here. No cloud resource was created and no production Firebase document was accessed. The source-level isolation gates and four local tests pass; that is not a substitute for a real staging browser run.

## Isolation gates added locally

- Vercel Preview builds require `VITE_SPOTFINDER_STAGE=staging`, a complete separate Firebase web config, an App Check public site key, and a server `FIREBASE_PROJECT_ID` equal to the staging web project. Production or missing project IDs abort the build. Production builds reject staging/emulator targets.
- Local builds must explicitly select `staging` or `emulator`. Emulator builds require `VITE_FIREBASE_EMULATOR_ONLY=true` and cannot be Vercel deployments. Vite preview requires a build marker naming a staging or demo project; its spot-page route uses synthetic fixtures only. Local development still connects Auth, Firestore, Functions, and Storage to loopback emulators.
- Nonproduction Firebase Admin initialization rejects the production project, mismatched preview project, or a service-account email outside the selected project. The Admin app now sets its project ID explicitly. These gates protect the report route and other Vercel routes that import the shared Admin bootstrap.
- Vite uses only public `VITE_` Firebase web values in the client. Service-account variables and Turnstile secrets stay in Vercel server variables. **A build artifact inspection has not yet been run**; inspect the actual staging bundle before deployment.

## Manual staging setup (no changes performed)

1. Obtain approval to create or identify a **separate Spark Firebase project**. Confirm it has no production data, production service account, production Storage bucket, or production billing link. Register a distinct Firebase Web app; record its project ID and app ID privately for configuration review.
2. In that project, create or inspect a score-based reCAPTCHA Enterprise website key and register it with that Web app under Firebase Console > App Check. Allow only a stable staging Preview hostname. Do not add `localhost` to the production key. Configure staging Firebase Authentication providers and authorized redirect domain separately. Keep all Firebase product enforcement off.
3. In Vercel Project Settings > Environment Variables, scope **staging values to Preview only** and production values to Production only. Inspect shared/team and branch-specific overrides. Preview client variables: `VITE_SPOTFINDER_STAGE`, `VITE_FIREBASE_STAGING_API_KEY`, `VITE_FIREBASE_STAGING_AUTH_DOMAIN`, `VITE_FIREBASE_STAGING_PROJECT_ID`, `VITE_FIREBASE_STAGING_APP_ID`, `VITE_FIREBASE_STAGING_MESSAGING_SENDER_ID`, `VITE_FIREBASE_STAGING_STORAGE_BUCKET`, `VITE_FIREBASE_APP_CHECK_SITE_KEY`, `VITE_FIREBASE_APP_CHECK_PROVIDER=enterprise`, and pilot keys/flags only when needed. Preview server variables: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and `FIREBASE_ALLOWED_APP_IDS` from the staging project. Never copy production private credentials into Preview. Confirm scopes without printing secret values.
4. Keep `REPORT_API_ENABLED`, `SUBSCRIPTIONS_ENABLED`, `VERCEL_APPCHECK_ENFORCE_CHECKOUT`, and `VERCEL_APPCHECK_ENFORCE_SUBSCRIPTION_STATUS` off initially. The enabled report API always requires App Check and also has its own production-approval gate. Use staging-only Turnstile credentials for a report preview test.
5. Before opening a browser, inspect the built `spotfinder-build-target.json` for the staging project ID and scan the generated client assets for forbidden server variable names or service-account material. Do not print any matching secret value. Abort if the target, key registration, or credential scope is uncertain.

## Real-browser test budget and recording

Run a single stable staging hostname with at most two browsers, two tabs each, three reloads per tab, five map movements, five report/API submissions, and a small synthetic dataset (about 20 spots). Stop at **50 App Check assessments, 1,000 Firestore document reads, or 30 writes**, whichever occurs first; check staging Usage and App Check metrics after each group. Do not use production documents or credentials. The staging project must remain Spark. Record only time, browser/version, hostname, route, product, success/error code, and Firebase App Check metric category—never tokens, IDs, credentials, or document contents.

| Flow | Expected staging observation | Status |
| --- | --- | --- |
| Fresh desktop and mobile-width load | Correct staging project/app ID, one App Check initialization, public map/Discover/Nearby load from staging | NOT RUN |
| Guest, anonymous Auth, email/password, Google redirect/popup | Legitimate flows work; Auth restoration does not become anonymous prematurely | NOT RUN |
| Drafts, images, private records | Owner can access; guest cannot; Storage may be unavailable on Spark | NOT RUN |
| Report normal, third-report challenge, invalid/replayed Turnstile, hard cap | Normal accepted, challenge required, invalid rejected, hard cap remains | NOT RUN |
| Vercel report endpoint | Valid App Check + Auth succeeds; missing/invalid App Check, bad Auth, exceeded limit and failed Turnstile reject | Local mocks PASS; real staging NOT RUN |
| Checkout/subscription status | Missing/invalid App Check rejects only after their individual switch is deliberately enabled | Local mocks PASS; real staging NOT RUN |
| Reload, two tabs, expired token, offline/reconnect, blocked reCAPTCHA | Token refresh/recovery is visible; no silent empty map; useful error if attestation fails | NOT RUN |
| Cached old bundle and Capacitor WebView | Old bundle behavior and WebView origin/provider compatibility are known before any enforcement | NOT RUN |

For real attestation, use browser network tools only to confirm requests go to the staging Firebase project and the expected Enterprise/App Check endpoints. Inspect token **presence**, never copy or log token values. Compare Firebase Console App Check verified/outdated/unknown/invalid categories for each product. A browser test needs actual staging registration; emulator tests cannot prove Enterprise token generation.

## Service readiness gates and order

| Service | Gate before enforcement | Current decision |
| --- | --- | --- |
| Report Vercel API | Staging browser obtains real token; Admin validates exact staging app ID; Auth, Turnstile, rate cap and rollback tested; old callable bypass addressed | NOT READY |
| Checkout/subscription Vercel | Both browser paths send real tokens across cached bundles; separately test 401 and recovery; server switch known | NOT READY |
| Callable Functions | Each callable's legitimate clients verified; compatible deployment plan and billing support | DEFERRED on Spark |
| Firestore | Verified metrics for anonymous/public map, nearby/discover, drafts, admin, mobile/WebView and old bundles over representative usage; immediate rollback owner | NOT READY |
| Storage | Service available on Spark, real uploads/downloads verified, public CDN behavior understood | NOT READY / availability unknown |
| Authentication | Identity Platform status known and separately approved; Google/password/SMS/recovery all verified | DEFERRED |

**Rollout:** (A) register staging app/key and verify staging browser flows under the strict budget; (B) after explicit approval, deploy a compatible production client while all Firebase product enforcement remains off; (C) monitor each product's Verified, Outdated, Unknown and Invalid categories and actual user errors for a representative cycle, including old bundles and WebViews; (D) enable one Vercel route switch at a time after its gate; (E) enable Firestore only after its gate and a separate approval; (F) defer Storage and callable enforcement until their service and billing prerequisites are understood. Do not enable Auth enforcement without confirmed Identity Platform support and approval.

**Rollback:** On legitimate 401s, missing map data, login failure, or upload failure, immediately disable only the newly enabled Vercel switch or Firebase product enforcement. Restore access first, then diagnose app ID, hostname, key, cached bundle and token metrics. Keep the previous working client build available. Do not weaken Firestore/Storage rules, remove Auth checks, or reopen direct report writes. The report pilot itself can be disabled while its legacy callable remains, but that callable is a known bypass until a separately approved cutover.

## Cost and quota stop conditions

Firebase's Enterprise App Check guide says the default one-hour token TTL causes refresh at roughly half TTL; shortening it raises assessment volume. Current Google documentation describes a **10,000-assessment monthly no-cost allowance per organization**, shared across projects, with quota errors after the limit for projects without billing. A staging project therefore shares the organization's allowance and cannot be treated as unlimited. Spark has fewer Enterprise score levels. Vercel Function invocations and Firebase reads/writes from staging tests also count toward their respective quotas. Do not enable billing or Blaze to finish this validation. See [Firebase Enterprise App Check](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider), [Google assessment billing](https://docs.cloud.google.com/recaptcha/docs/billing-information), [Firebase metrics categories](https://firebase.google.com/docs/app-check/monitor-metrics), and [Vercel variable scoping](https://vercel.com/docs/environment-variables).
