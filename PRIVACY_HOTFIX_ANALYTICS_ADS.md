# SpotFinder 0.5.6 analytics and advertising privacy hotfix

Date: 13 October 2026  
Status: engineering record; not legal advice, publication approval, or deployment confirmation.

## Finding and root cause

`src/main.jsx` called `bootConsent()` on every load. The former implementation read `spotfinder_cookie_consent_v1` and dynamically injected GA4 or AdSense whenever a stored `analytics` or `ads` value was `true`. A visitor who accepted in an earlier session therefore reactivated those services before opening the preference panel. Revocation removed loader elements and readable first-party cookies, but could not retract requests already sent or reliably stop provider code that had already executed. No Firebase Analytics SDK initialization, Google Tag Manager container, explicit page-view hook, or custom analytics-event hook was found elsewhere.

## Disabled paths

- Removed the GA4 script injector, measurement configuration, Consent Mode bootstrap/update calls, and all runtime calls capable of activating analytics.
- Removed the AdSense script injector and converted `AdBanner` into a zero-layout component that creates no slot or placeholder.
- Removed the unused AdSense publisher declaration from `src/components/Ads.txt`; no public `ads.txt` is emitted by this build.
- Removed analytics and advertising origins from both HTML and Vercel Content Security Policies as defense in depth.
- `bootConsent()` now only neutralizes legacy same-tab artifacts, removes known tag/ad elements, and expires readable first-party GA/AdSense cookies. It does not initialize a Google tag.
- The effective analytics and advertising state is hard-coded off. The public preference setter cannot grant either category during suspension.

## Consent migration behavior

The existing storage key is not renamed, deleted, or made more permissive. Prior raw choices remain stored until the user explicitly selects “Keep optional services off,” but `getConsent()` exposes them only as historical metadata and reports both optional categories as inactive. Restoring a provider must use a new consent version and fresh explicit opt-in; a historical acceptance must not be reused.

## Traffic classification

The application may still contact Google for Firebase Authentication, Firestore, Storage, Functions, Google sign-in, reCAPTCHA, and user-selected Google-backed functionality. Map, geocoding, routing, tiles, social embeds, Stripe, and other documented providers also remain. Such traffic is not GA4 or AdSense traffic and requires its own disclosure and legal assessment.

## Verification boundary

Repository scans and local production-build browser tests can establish what this build initiates. They cannot prove what an older deployed bundle, browser extension, reverse proxy, hosting injection, provider account, or retained provider-side record does. After deployment, the owner must repeat clean and previously-consented session checks in browser Network/Application panels and retain evidence. Publication wording remains subject to qualified review.

Local verification passed for four isolated browser states (new visitor, prior analytics acceptance, prior rejection, and prior advertising acceptance) across Home, FAQ, Status, Admin, Status Admin, Privacy Policy, Cookie Policy, Terms, and Refund Policy, plus Home interaction and reload. No request to a GA4, Tag Manager, AdSense, DoubleClick, or Google ad-quality host occurred; no related script/global/ad slot or readable first-party tracking cookie remained. Expected Firebase/reCAPTCHA-related traffic was observed at `firestore.googleapis.com`, `identitytoolkit.googleapis.com`, and `www.google.com`. No disposable registered-user credentials were available, so registered sign-in, submission, and populated spot-detail checks remain manual release actions. The suspension executes before auth state resolution and has no auth-dependent activation branch.

## Safe restoration requirements

Do not merely flip the current constant. Reintroduction requires owner approval, a new consent-record version, default-off independently selectable categories, pre-consent and post-revocation network tests, provider/CSP/documentation updates, data-retention and transfer review, and a migration that never treats legacy acceptance as fresh consent.
