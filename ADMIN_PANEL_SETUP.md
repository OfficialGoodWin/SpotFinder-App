# SpotFinder Admin Panel setup

## What was added
- `/Admin` central admin panel: Reports, Spots, Photos, and Status.
- General "Report" button across the app.
- Report anti-spam: reCAPTCHA + Firebase session + IP hash + per-device bucket rate limits.
- "Block spammer" blocks the report's UID, IP hash and device hash from future reports.
- Admin spot edit/delete and spot-image removal.
- Admin deletion of community POI photos.
- Admin writes are callable Cloud Functions and are audit logged.
- Admin UI uses the Firebase `admin` custom claim, not an email string.
- Build-time POI enrichment now attempts name + coordinate Wikidata matching for named notable Czech POIs and only accepts matches within 150 m.

## Deploy
From the project root:

1. `firebase deploy --only functions`
2. `firebase deploy --only firestore:rules,firestore:indexes`
3. Deploy the web app normally (Vercel).

## IMPORTANT: migrate admin security
The admin UI now requires the custom claim. The existing `setAdminClaim` function is included as a one-time bootstrap helper. After deploying functions and the web app, sign in as `superadmin@spotfinder.cz`, open `/Admin`, and click **Activate admin access**. The page force-refreshes the Firebase ID token after the server grants the claim, so the admin dashboard should open without a manual sign-out/sign-in. The server only allows the legacy bootstrap account to promote itself.

After you confirm `/Admin` works, harden `firestore.rules` by changing `isSuperAdmin()` from:
`request.auth.token.admin == true || authEmail() == 'superadmin@spotfinder.cz'`
to:
`request.auth.token.admin == true`

Also change `assertIsAdmin()` in `functions/index.js` to accept only `context.auth?.token?.admin === true`, then redeploy functions. This removes the hard-coded email bootstrap path completely. If you do not need to grant admin access to other accounts, remove the `setAdminClaim` export as well after bootstrap and redeploy functions.

Enable MFA for the admin account. A custom claim limits who is an admin, but MFA is what materially reduces the damage from a stolen password/session.

## POI build-time photos
Run your enrichment as before. Name/coordinate matching is ON by default:
`node scripts/enrichment/enrich-pois.js`

Optional env vars:
- `POI_MATCH_WIKIDATA=0` disables name matching.
- `POI_MATCH_RADIUS_M=150` controls the maximum coordinate distance.
- `POI_MAX_PHOTOS=3` controls photos per POI.

The matcher focuses on named notable POIs (tourism, historic/heritage, churches, museums, viewpoints, hotels, peaks, towers, etc.). It does not blindly match every restaurant/shop because that would be slow and creates many false photo matches.
