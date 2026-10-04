# SpotFinder ambient POI tiles — local build

This folder builds a Czech Republic POI PMTiles archive from OpenStreetMap data. It does not use Overpass and does not scrape Mapy/Firmy.cz.

## Windows: use WSL2

Install Ubuntu from the Microsoft Store, open Ubuntu, then:

```bash
sudo apt update
sudo apt install -y osmium-tool build-essential libsqlite3-dev zlib1g-dev git curl
```

Install Node.js 18+ using your preferred method. Then install Tippecanoe:

```bash
git clone https://github.com/felt/tippecanoe.git
cd tippecanoe
make -j
sudo make install
cd ~
```

Keep the repository under `~/` in WSL for speed, not under `/mnt/c/...`.

## Download the Czech extract

The current Geofabrik Czech extract is available here:
https://download.geofabrik.de/europe/czech-republic.html

The file is roughly 900 MB as of the current snapshot, so leave several GB of free disk space for intermediate files and PMTiles.

```bash
curl -L -o czech-republic-latest.osm.pbf \\
  https://download.geofabrik.de/europe/czech-republic-latest.osm.pbf
```

## Build PMTiles

From this folder:

```bash
npm install
./build.sh ./czech-republic-latest.osm.pbf
```

The pipeline is:

`Geofabrik PBF -> osmium tags-filter -> osmium export -> Node normalization -> tippecanoe -> ambient-poi.pmtiles`

The tile source layer is `ambient_poi`, which must stay in sync with `src/components/map/MapLibreMap.jsx`.

## Upload to Vercel Blob

Create a **Public** Blob store in your Vercel project (Storage -> Create -> Blob). Vercel's public Blob URLs are CDN-backed and are suitable for direct browser reads. PMTiles reads the file using HTTP range requests.

Put the Blob token into the WSL session without committing it:

```bash
export BLOB_READ_WRITE_TOKEN='PASTE_TOKEN_HERE'
./build.sh ./czech-republic-latest.osm.pbf
```

The uploader uses one stable pathname so `VITE_AMBIENT_TILES_URL` does not change between builds.

Then in Vercel Project Settings -> Environment Variables, add:

`VITE_AMBIENT_TILES_URL=https://<your-store>.public.blob.vercel-storage.com/spotfinder/ambient-poi.pmtiles`

Redeploy the site after changing a `VITE_` variable.

## Details/photos enrichment

After the PMTiles GeoJSON exists:

```bash
cd ../..
npm run enrich:pois
```

This produces `public/poi-details/10/{x}/{y}.json` shards. The map fetches only the shard for the z10 tile when a user taps an ambient POI. It follows the OSM/Wikimedia/Wikidata chain and stores photo credit/license metadata rather than scraping a commercial map site at runtime.

Do not commit API keys or the Vercel Blob token.
