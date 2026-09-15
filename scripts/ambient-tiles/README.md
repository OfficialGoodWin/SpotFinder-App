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

## Hosting

Any static host with range-request support works. Two straightforward options:

- **Cloudflare R2** — free egress, this is what Protomaps' own docs
  recommend for self-hosted PMTiles. Needs an R2 bucket + a public custom
  domain (or R2.dev subdomain) in front of it.
- **GitHub Releases** — zero extra infra: attach `ambient-poi.pmtiles` as a
  release asset and use its `github.com/.../releases/download/...` URL.
  Simplest option if your coverage area is small enough that the file stays
  under a few hundred MB.

Whichever you pick, two things need updating:

1. **CSP** (`index.html`) — add that host's domain to `connect-src`.
2. **Env var** — set `VITE_AMBIENT_TILES_URL` to the file's public URL in
   Vercel's env vars. Leaving it unset is safe: `MapLibreMap.jsx` falls back
   to the original live Geoapify fetch automatically.

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
