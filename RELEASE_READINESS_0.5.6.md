# SpotFinder 0.5.6 release readiness

Prepared: 2026-10-13. This is an engineering release candidate report, not deployment approval, legal advice, or a compliance certification.

## Release summary

SpotFinder now reports version `0.5.6` from `src/config/appVersion.js`. The release adds a maintainable Updates page, replaces the outdated FAQ and tutorials with verified workflows, makes the status page distinguish published evidence from missing monitoring, and retains the privacy and security safeguards completed during the earlier 0.5.6 phases.

The verified public release note is stored once in `src/data/releases.js`. No historical release was invented; only 0.5.6 is shown until reliable older records are supplied.

## Phase 5 files

- `src/config/appVersion.js`
- `src/data/releases.js`
- `src/components/updates/ReleaseTimeline.jsx`
- `src/pages/Updates.jsx`
- `src/pages/FAQ.jsx`
- `src/pages/Status.jsx`
- `src/lib/statusMetrics.js`
- `src/lib/ThemeContext.jsx`
- `src/components/SettingsModal.jsx`
- `src/components/map/MapLayerSwitcher.jsx`
- `src/lib/NavigationTracker.jsx`
- `src/pages.config.js`
- `src/pages/Home.jsx`
- `src/locales/translations.js`
- `public/sitemap.xml`
- `tests/release-data.test.js`
- `tests/status-metrics.test.js`
- `scripts/release-audit.mjs`
- `scripts/responsive-audit.mjs`
- `scripts/privacy-network-audit.mjs`
- `package.json`
- `THIRD_PARTY_NOTICES.md`

The obsolete `public/faq/README.txt` placeholder was removed because the tutorials are now responsive, code-native illustrations with accessible labels. No user or production data was changed.

## 21st.dev source and dependencies

The release timeline adapts the semantic structure of the MIT-licensed **What's New Changelog Timeline** by DHxWhy from 21st.dev. The catalogue URL and adoption notes are recorded in `THIRD_PARTY_NOTICES.md`. The autoplay, pointer simulation, deployment status, hover expansion, and sample content were not copied.

No dependency was added. The implementation uses the existing React, Lucide, and Tailwind stack.

## Documentation and content verification

- Add Spot help now shows the actual placement button, required name and description, optional enrichment, supported JPEG/PNG/WebP uploads, social links, rights confirmation, and save result.
- Rating help uses Overall experience, Ease of access, Condition & cleanliness, Safety & comfort, and Crowdedness. The obsolete Parking/Beauty/Privacy calculation text was removed from current English copy.
- Navigation copy describes browser speech support, internal drive/bike/walk routing, approximate rerouting, and provider-dependent traffic without promising road coverage or a fixed language count.
- About identifies the current MapLibre/Firebase implementation, version 0.5.6, and plan previews that are not currently for sale.
- Status no longer invents a 90-day operational history. Missing intervals are unknown, reported percentages use only stored intervals, and the page discloses that it is not an independent external monitor.
- Public legal review banners remain present.
- The former translated FAQ bodies contained the same outdated feature claims. The verified replacement is currently English-only; non-English users see an explicit notice instead of inaccurate translated guidance, and feedback retains the selected-language metadata. Reviewed translations are a remaining content task.

## Verification performed

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm test`: 53 pass, 0 fail, 2 skipped in the normal run.
- `npm run build`: pass.
- `node --check functions/index.js`: pass.
- `npm audit --omit=dev`: reports 7 build-tool-chain advisories (5 high, 2 moderate) through Tailwind 3 dependencies (`braces` and `postcss-selector-parser`). npm offers only a forced Tailwind 4 upgrade, which is a breaking change and was not applied automatically. These packages are not emitted as browser runtime libraries, but the build environment still requires a planned Tailwind 4 compatibility upgrade or another reviewed remediation.
- `npm run test:responsive`: pass at 320x700, 375x812, 390x844, 430x932, 768x1024, 1024x768, 1440x900, 1920x1080, 667x375, and 844x390.
- `npm run test:privacy-network`: pass for four clean-session consent histories across ten routes plus home interaction/reload. No GA4, GTM, Firebase Analytics, or AdSense request was observed. Firebase/identity and other essential Google traffic remained, as expected.
- `npm run test:release`: pass in light and dark themes for Updates, FAQ, Status, map rendering and controls, and the guest sign-in UI.
- Headless Edge rendered the MapLibre canvas and controls but emitted six MapLibre software-renderer `recalculate`/`resize` warnings during rapid layout changes. This needs a hardware-accelerated manual browser check; it was not represented as a functional pass for every browser/GPU.
- Firestore and Storage emulator tests could not run: the installed Java runtime is below the Firebase CLI's required JDK 21. Their ordinary-test entries remain explicitly skipped. Install JDK 21+ and run `firebase emulators:exec --only firestore,storage "npm test"` before release.

## Not verified automatically

- Registered-user, Google sign-in, SMS MFA enrollment/recovery, and recent-reauthentication flows against disposable test accounts.
- End-to-end spot publication, editing/deletion, My Spots, live routing, social embeds, and account-deletion completion against deployed test services.
- Real mobile hardware, Safari/Firefox, screen-reader output, degraded/offline map caches, production monitoring accuracy, or production Stripe configuration.
- Human-reviewed translations of the new FAQ body. The current accurate English fallback is disclosed in the UI for other selected languages.
- Production network/storage behavior after deployment. No deployment was performed.

## Legal and operational blockers

- Privacy Policy, Terms, Cookie Policy, and Refund Policy remain engineering drafts pending qualified review and owner approval.
- Operator legal status, service address, registration/tax disclosures, governing law, competent court, processor roles, transfer safeguards, retention periods, and the treatment/licence of retained public contributions require confirmation.
- Full-DOB storage, the age-16 basis, under-age handling, and the absence of an automatic 30-day legacy-account completion deletion require a policy decision.
- Public contribution/photo retention after account deletion and legacy UID-bearing Storage paths require legal and technical review.
- Stripe checkout must remain disabled until prices, webhook operations, tax/invoicing, cancellation, withdrawal acknowledgements, refunds, entitlement revocation, and support procedures are verified.
- The status UI is only as reliable as `status_services` and `status_incidents`; it is not backed by independent uptime monitoring in this repository.
- The Tailwind 3 build dependency audit is not clean. Do not use `npm audit fix --force` without testing the required Tailwind 4 migration.

## Environment and data requirements

The map and optional integrations use the existing environment variables where applicable: `VITE_ORS_API_KEY`, `VITE_GEOAPIFY_KEY`, `VITE_TOMTOM_API_KEY`, `VITE_PROTOMAPS_KEY`, `VITE_AMBIENT_TILES_URL`, `VITE_POI_DETAILS_BASE_URL`, and `VITE_RECAPTCHA_SITE_KEY`. Firebase client configuration remains in the existing Firebase module.

Paid subscriptions additionally require coordinated client and server flags/credentials, including `VITE_SUBSCRIPTIONS_ENABLED`, Stripe publishable/secret and webhook keys, and approved price IDs. Do not configure `VITE_SUBSCRIPTIONS_ENABLED=true` until the legal and operational blockers above are closed.

Phase 5 requires no database migration. The status page can consume existing optional status collections without fabricating defaults. Any legacy contributor/DOB/storage cleanup remains a separately reviewed migration and is not part of this release candidate.

## Deployment and rollback

1. Install JDK 21+ and pass the emulator suites.
2. Complete owner acceptance on disposable accounts and real target browsers/devices.
3. Obtain legal approval for the publication drafts and confirm operator disclosures.
4. Review the final diff and environment values. Keep subscriptions disabled unless separately approved.
5. Deploy only after explicit owner approval; verify `/updates`, `/FAQ`, `/Status`, legal routes, authentication, the map, and the privacy-network audit on the deployed origin.

Rollback is a frontend rollback to the previously approved artifact/commit. Phase 5 has no database migration to reverse. Preserve Firestore, Storage, and Functions state; do not roll back production rules or account-deletion infrastructure merely to revert the documentation/UI release. Re-run the privacy-network audit after rollback because an older frontend could restore tracking behavior.

Suggested commit: `release: prepare SpotFinder 0.5.6`

Suggested tag after acceptance (not created): `v0.5.6`
