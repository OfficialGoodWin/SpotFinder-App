# SpotFinder upgrade path

The ZIP is now prepared for the first big chunk of the rebuild.

## Already changed in this patch

- Removed three unused Mapy REST/scraper modules that contained the old exposed Mapy key.
- Removed Mapy API hosts from the CSP.
- Added Vercel Blob to the CSP.
- Replaced the Overpass ambient tile builder with a local Geofabrik + osmium + tippecanoe pipeline.
- Added the requested OSM categories: `camp_site`, `caravan_site`, `viewpoint`, `toilets`, `drinking_water`, `picnic_site`.
- Added the build-time enrichment script and z10 detail shards.
- The PMTiles click path loads only the corresponding detail shard.
- Map attribution explicitly includes `© OpenStreetMap contributors`.
- Spot/POI images now upload to Firebase Storage instead of base64-in-Firestore.
- `createSpot` now writes a 9-character geohash.
- Home now uses a viewport bounding-box query instead of loading a global newest-200 list.
- Storage writes are restricted to the signed-in user's own folder.

## Still needs an intentional production migration

1. Upgrade Firebase Spark -> Blaze before deploying Cloud Functions. The codebase already exports Cloud Functions for ratings, flags, moderation and admin actions.
2. Create a public Vercel Blob store and set `VITE_AMBIENT_TILES_URL` in Vercel.
3. Run the local PMTiles build on WSL2/Linux.
4. Run `npm run enrich:pois` before deployment.
5. Migrate legacy base64 images already stored in Firestore. New uploads no longer create them, but old documents remain until migrated.
6. Replace the `getPublicSpots(200)` initial load with a map-bounds/geohash query.
7. Convert spot/admin DOM markers to clustered GeoJSON sources.
8. Do a Lighthouse/axe pass and legal review; add the real business identity/contact data to the legal pages.
