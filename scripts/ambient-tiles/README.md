# Ambient POI tiles

Replaces the live per-pan Geoapify calls in `MapLibreMap.jsx` (cafes, museums,
viewpoints, etc.) with a pre-baked PMTiles file MapLibre streams directly —
no network round-trip on pan/zoom. This only covers the *ambient/background*
POI layer. Your own user-submitted Spots stay on live Firestore reads and
are untouched by any of this.

## Pipeline

1. `build.js` — queries Overpass for the categories in `osm-tags.js`
   (kept in sync with `src/lib/ambientCategories.js`), converts to GeoJSON,
   and (unless `--skip-credits`) pre-fetches Wikimedia author/license credit
   for any feature with a `wikidata`/`wikimedia_commons` tag — so the client
   never makes that round-trip per-POI either.
2. `build.sh` — runs `build.js`, then `tippecanoe` to produce
   `ambient-poi.pmtiles`.
3. You host that file somewhere with HTTP range-request support (required —
   PMTiles reads byte ranges, it doesn't download the whole file) and point
   the app at it.

Run it locally:

```bash
cd scripts/ambient-tiles
npm install
./build.sh "48.5,12.0,51.1,18.9"   # south,west,north,east — your coverage area
```

## Hosting: Vercel Blob

Since the app is already on Vercel, tiles are hosted on [Vercel Blob](https://vercel.com/docs/vercel-blob) — it explicitly supports HTTP range requests (required for PMTiles, which reads byte ranges rather than downloading the whole file) and files up to 5TB, so no separate infra/account needed.

Setup (one-time):

1. Vercel dashboard → your project → **Storage** → **Create Database** → **Blob**.
2. Copy the `BLOB_READ_WRITE_TOKEN` it gives you.
3. Run the pipeline locally once to get the file hosted and get its URL:
   ```bash
   cd scripts/ambient-tiles
   npm install
   BLOB_READ_WRITE_TOKEN=... ./build.sh "48.5,12.0,51.1,18.9"   # south,west,north,east
   ```
   `upload.js` (called automatically by `build.sh` when the token is set) prints the public blob URL and the exact CSP/env var values to set next.
4. In Vercel's project env vars, set `VITE_AMBIENT_TILES_URL` to that URL.
5. In `index.html`'s CSP, add the blob host (`https://<id>.public.blob.vercel-storage.com`) to `connect-src`.
6. Redeploy. Leaving `VITE_AMBIENT_TILES_URL` unset is always safe — `MapLibreMap.jsx` falls back to the original live Geoapify fetch automatically.

To keep it current automatically, add `BLOB_READ_WRITE_TOKEN` as a **repo secret** (Settings → Secrets → Actions) so `.github/workflows/build-ambient-tiles.yml` can rebuild and re-upload monthly. `upload.js` uploads to the same fixed filename each time (`addRandomSuffix: false`), so the URL — and therefore `VITE_AMBIENT_TILES_URL` — never changes between rebuilds.

## Keeping it fresh

Ambient POIs don't change hourly — monthly is plenty. `.github/workflows/
build-ambient-tiles.yml` runs this on a monthly cron. Fill in your bbox and
upload step (R2 or a GitHub Release) before enabling it; it's written with
placeholders since the hosting choice above is yours to make.

## If you add a category later

Update `src/lib/ambientCategories.js` **and** `osm-tags.js` together — the
frontend match expressions and the Overpass query both key off the same
category strings, and a mismatch just means that category silently returns
no POIs from the tile source.
