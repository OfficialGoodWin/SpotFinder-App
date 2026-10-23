# SpotFinder Mobile V2 staging route

Mobile V2 is mounted only at `/new` and its child routes. The existing homepage remains at `/`. The V2 screen and styles live in this folder; the supplied original logo is copied unchanged to `public/mobile-v2/official-logo.png`.

## Live data and workflows

- The map reuses `MapLibreMap`, including OpenFreeMap styles, PMTiles POIs, gestures, 3D, zoom and marker selection. It stays mounted after the first map visit.
- Nearby starts with bounded public spots in the visible map. Applying distance or rating filters calls the existing bounded radius query. Imported POIs remain selectable on the map and open the separate POI detail panel.
- Discover reads paged, published public spots. Photos are displayed only when available. Save verifies the authenticated account and current relation before writing.
- Collection reads saved, liked and created records for the current account. Each list is bounded to 100 records; `100+` means the list is at its cap and does not assert an exact total.
- Add Spot, community detail, imported POI detail, navigation handoff, authentication, account security, photo preparation and publishing reuse the existing components and Firebase functions. V2 enables photo reordering in the shared Add Spot component without changing its original-route presentation.
- Drafts read the existing guest or owner scoped cloud store. Resume uses the existing editor and photo restoration; deletion keeps the existing private photo cleanup behavior.

## Staging and release boundaries

Vercel and the local production preview return `X-Robots-Tag: noindex, nofollow, noarchive` for `/new` paths. The client also sets a robots meta tag. `/new` is absent from the generated sitemap. No deployment or homepage switch is part of this staging work.

When approved for staging, use the existing Vercel project and its normal deployment workflow after `npm run build`. This route uses the existing Firebase project; do not use real accounts for write tests. To roll back V2, revert the V2-specific changes to `App.jsx`, `vercel.json`, `vite.config.js`, the opt-in shared component/API additions, and remove `src/mobile-v2/` plus `public/mobile-v2/`. Preserve unrelated working-tree changes in `index.html`, `news-shell.html`, and `public/manifest.json`.

Journal, desktop, admin, legal, FAQ and status pages intentionally remain on their existing routes. Admin workflows are outside the public Mobile V2 pass and retain their existing gates. Links from V2 to legal, FAQ and updates open those existing pages.

## Verification still needed before release

Browser screenshots and interactive Playwright checks are pending at the user's request. The V2 shell is Czech first; changing the shared language preference updates the reused map and legacy workflow components, while the new V2 shell copy still needs localization beyond Czech. The Nearby list currently contains community spots; imported POIs are available through the map, without a combined source filter. Exact collection totals beyond the existing 100-item read cap require a separate authorized count strategy. Device testing on iOS Safari has not been performed.
