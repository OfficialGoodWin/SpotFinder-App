# Building Your Own Custom Maps for SpotFinder

A complete, beginner-friendly guide to building your own lightweight offline map
files that work with SpotFinder's existing map renderer, offline download system,
and offline turn-by-turn routing — with **zero code changes** if you follow the schema.

---

## 0. Read this first: where map data actually comes from

You **cannot** take data from Google Maps (or Apple/Bing/Mapy) and paste it into
your own maps. Their data is copyrighted and their Terms of Service forbid scraping
or reusing it. Doing so is illegal and will get your app removed from the stores.

Instead you use **OpenStreetMap (OSM)** — a free, open, community-built map of the
whole world. It's legal to reuse (just keep the attribution), and it already
contains everything you asked for:

- **Roads** (motorways → footpaths, with names, refs, lanes, one-way flags)
- **Terrain** (elevation comes from separate free datasets — see Part 6)
- **Buildings** (with heights for 3D)
- **Land use** (forests, water, parks, farmland)
- **POIs** (shops, restaurants, fuel, etc.)

SpotFinder is **already built on OSM** — it uses [OpenFreeMap](https://openfreemap.org)
online. This guide just shows you how to build your **own** copy of that data so you
control it, host it cheaply, and use it offline.

---

## 1. How SpotFinder's maps work (the 2-minute mental model)

```
┌─────────────────┐      ┌──────────────────┐      ┌────────────────────┐
│  Raw OSM data   │ ───▶ │    Planetiler    │ ───▶ │  yourmap.pmtiles   │
│ (.osm.pbf file) │      │ (converter tool) │      │ (one small file)   │
└─────────────────┘      └──────────────────┘      └─────────┬──────────┘
                                                             │
                        ┌────────────────────────────────────┴───────────┐
                        │                                                 │
                   Host on a server                              Download into the app
                   (static file, cheap)                          (OPFS / IndexedDB, offline)
                        │                                                 │
                        └──────────────────┬──────────────────────────────┘
                                           ▼
                              MapLibre GL renders it using
                              src/lib/mapStyle.js  (colors, roads, icons)
                                           │
                                           ▼
                              offlineRouter.js builds routing
                              graph FROM THE SAME TILES → navigation works offline
```

**The single most important rule:** your PMTiles file must use the **OpenMapTiles
schema**. That means the layers inside must be named exactly:

```
landcover, landuse, water, waterway, transportation, transportation_name,
building, park, boundary, place, poi, water_name, aerodrome_label, mountain_peak
```

`src/lib/mapStyle.js` references these names directly (e.g. `'source-layer':
'transportation'`). If you use a different schema (like Protomaps' own v4 basemap),
the map renders **blank** because none of the style layers match. Planetiler
produces the correct schema out of the box.

> Your code already documents this in `src/lib/vectorTileDownloader.js` — see the
> big comment about `VITE_OMT_PLANET_URL` and the OpenMapTiles schema.

---

## 2. What you'll install (one-time setup)

You only need **two** things. Everything is free and cross-platform.

### 2.1 Java 21+ (Planetiler runs on it)

1. Download **Temurin JDK 21** from <https://adoptium.net/>
2. Install it (accept defaults; let it set `JAVA_HOME`).
3. Verify — open a new terminal (Command Prompt) and run:

```cmd
java -version
```

You should see `openjdk version "21..."` or higher.

### 2.2 Planetiler (the converter)

Planetiler is a single `.jar` file. No install needed.

1. Make a working folder, e.g. `C:\maps`:

```cmd
mkdir C:\maps
```

2. Download the latest `planetiler.jar` from
   <https://github.com/onthegomap/planetiler/releases/latest>
   (the file is called `planetiler.jar`) and save it into `C:\maps`.

That's it. You now have everything to build world-class map tiles.

---

## 3. Build your first map (5 minutes, tiny download)

Let's start with **Monaco** — it's tiny (~1 MB) so you can test the whole pipeline
fast. Planetiler will automatically download the OSM data for you.

Open a terminal in `C:\maps` and run:

```cmd
java -Xmx2g -jar planetiler.jar --download --area=monaco --output=monaco.pmtiles
```

What each part means:

| Part | Meaning |
|------|---------|
| `-Xmx2g` | Give Java 2 GB of RAM (raise for bigger areas) |
| `--download` | Auto-download the OSM extract from Geofabrik |
| `--area=monaco` | Which region to build (see Part 4 for the list) |
| `--output=monaco.pmtiles` | The single output file |

When it finishes you'll have `C:\maps\monaco.pmtiles`. **This one file contains the
entire map** — roads, water, buildings, POIs, land use — in the exact schema
SpotFinder needs.

### Preview it before wiring it in

Go to <https://pmtiles.io/> and drag your `monaco.pmtiles` onto the page. You'll see
your map render instantly in the browser. This confirms the file is valid before you
touch any code.

---

## 4. Build the region *you* actually want

`--area=` accepts any Geofabrik region name. Examples:

```cmd
:: A whole country
java -Xmx4g -jar planetiler.jar --download --area=czech-republic --output=cz.pmtiles

:: A larger country (more RAM)
java -Xmx8g -jar planetiler.jar --download --area=germany --output=de.pmtiles

:: A continent-sized build (needs a strong machine)
java -Xmx16g -jar planetiler.jar --download --area=europe --output=europe.pmtiles
```

Find the exact name for any region by browsing <https://download.geofabrik.de/> —
the URL slug (e.g. `europe/czech-republic`) is what you pass to `--area`.

### Custom bounding box (a single city or a custom region)

If you only want a specific rectangle (much smaller and lighter), pass a bbox as
`west,south,east,north`:

```cmd
java -Xmx4g -jar planetiler.jar --download --area=czech-republic ^
  --bounds=14.22,49.94,14.71,50.18 --output=prague.pmtiles
```

> Tip: SpotFinder's `vectorTileDownloader.js` already defines bounding boxes for
> ~18 countries in the `COUNTRIES` array. You can copy those exact bbox numbers to
> build matching regions.

---

## 5. Making it lightweight (fit it on a small server)

PMTiles is already compact (it deduplicates and compresses tiles). But you can make
it dramatically smaller with three levers:

### 5.1 Limit the max zoom

SpotFinder's style (`mapStyle.js`) declares the source `maxzoom: 14`. Building past
zoom 14 wastes space you'll never render. Cap it:

```cmd
java -Xmx4g -jar planetiler.jar --download --area=czech-republic ^
  --maxzoom=14 --output=cz.pmtiles
```

Each extra zoom level roughly **quadruples** tile count, so capping at 14 instead of
15 can cut file size by ~4×.

### 5.2 Build only the area you need

A city (a few MB) vs. a country (tens–hundreds MB) vs. a continent (GBs). Use bbox
extracts (Part 4) to keep files tiny.

### 5.3 Rough size expectations

| Area | Approx size @ maxzoom 14 |
|------|--------------------------|
| A city (e.g. Prague bbox) | 3–15 MB |
| Small country (Slovenia) | ~35 MB |
| Medium country (Czechia) | ~150–210 MB |
| Large country (Germany) | ~700 MB |

A single small-country file fits comfortably on the cheapest VPS or free static
host. Because clients use **HTTP range requests**, the server only ever sends the
handful of tile bytes each user needs — it never streams the whole file. So even a
700 MB file is fine to host on a $5 box.

---

## 6. Terrain features (hillshade + 3D terrain) — optional, advanced

OSM has almost no elevation data, so terrain comes from a separate free dataset:
a **DEM** (Digital Elevation Model), e.g. Copernicus GLO-30 or SRTM. Terrain in
MapLibre is a **raster-DEM** source, separate from your vector PMTiles.

There are two levels of effort:

### 6.1 Easiest: use a free hosted Terrain-RGB source

Add a hillshade layer to `mapStyle.js` pointing at an existing free Terrain-RGB
tileset (for example AWS's open `terrarium` tiles). Inside the `sources` object in
`mapStyle.js`:

```js
sources: {
  v: { /* ...your existing vector source... */ },
  terrain: {
    type: 'raster-dem',
    tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 13,
  },
},
```

Then add a hillshade layer (put it just after the `bg` background layer so it sits
under roads):

```js
{ id: 'hillshade', type: 'hillshade', source: 'terrain',
  paint: { 'hillshade-exaggeration': 0.4 } },
```

For true 3D terrain (tilting the map), in `MapLibreMap.jsx` after the style loads:

```js
map.setTerrain({ source: 'terrain', exaggeration: 1.2 });
```

> Note: hosted terrain tiles require a network connection. For **offline** terrain,
> continue to 6.2.

### 6.2 Offline terrain: build your own Terrain-RGB PMTiles

1. Download a DEM for your area (free): Copernicus DEM from
   <https://portal.opentopography.org/> or SRTM.
2. Convert the DEM into Terrain-RGB tiles with **rio-rgbify** (a Python tool):

   ```cmd
   pip install rio-rgbify
   rio rgbify -b -10000 -i 0.1 dem.tif terrain-rgb.mbtiles
   ```

3. Convert the MBTiles into PMTiles with the **pmtiles** CLI
   (download from <https://github.com/protomaps/go-pmtiles/releases>):

   ```cmd
   pmtiles convert terrain-rgb.mbtiles terrain.pmtiles
   ```

4. Host `terrain.pmtiles` (Part 7) and reference it with the `pmtiles://` protocol —
   which `MapLibreMap.jsx` already registers:

   ```js
   terrain: {
     type: 'raster-dem',
     tiles: ['pmtiles://https://yourhost.com/terrain.pmtiles/{z}/{x}/{y}'],
     encoding: 'terrarium',
     tileSize: 512,
   },
   ```

Terrain is the most involved part — get your flat vector map working first, then add
terrain as a polish step.

---

## 7. Host your map on a server (the cheap, lightweight way)

A `.pmtiles` file is just a static file. The **only** server requirement is support
for **HTTP Range requests** (almost everything supports this). No tile server, no
database, no backend code.

### Option A — Caddy (simplest, auto-HTTPS)

1. Download Caddy from <https://caddyserver.com/download>.
2. Put your `.pmtiles` files in a folder, e.g. `C:\maps\public`.
3. Create a file named `Caddyfile` next to `caddy.exe`:

   ```
   yourdomain.com {
       root * C:/maps/public
       file_server {
           # Range requests + CORS so the browser/app can fetch tile byte ranges
       }
       header Access-Control-Allow-Origin "*"
       header Access-Control-Allow-Headers "Range"
       header Access-Control-Expose-Headers "Content-Range, Content-Length"
   }
   ```

4. Run:

   ```cmd
   caddy run
   ```

Your file is now at `https://yourdomain.com/cz.pmtiles`.

### Option B — Nginx

Add CORS + range headers to your server block:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    root /var/www/maps;

    location ~ \.pmtiles$ {
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Headers "Range" always;
        add_header Access-Control-Expose-Headers "Content-Range, Content-Length" always;
        # Nginx serves byte ranges automatically for static files.
    }
}
```

### Option C — Object storage (zero server to manage)

Upload the file to **Cloudflare R2** (has a free tier and no egress fees) or AWS S3.
Both support range requests. Enable CORS on the bucket (`GET`, `HEAD`, allow the
`Range` request header and expose `Content-Range`/`Content-Length`). Then your URL is
the public object URL. This is the cheapest option for a small app.

### Testing your host

```cmd
curl -I -H "Range: bytes=0-99" https://yourdomain.com/cz.pmtiles
```

You want to see `HTTP/1.1 206 Partial Content` and a `Content-Range` header. If you
get `200` with the full file, range requests aren't working — fix the server config.

---

## 8. Wire your map into SpotFinder

Your app supports two paths. Both already exist in the code.

### Path A — Online / streamed base map (`VITE_OMT_PLANET_URL`)

`src/lib/vectorTileDownloader.js` reads the planet URL from an env var:

```js
const PLANET_URL = import.meta.env.VITE_OMT_PLANET_URL
  || 'https://download.openfreemap.org/planet.pmtiles';
```

Point it at your file. In your `.env` (root of the project):

```
VITE_OMT_PLANET_URL=https://yourdomain.com/cz.pmtiles
```

Rebuild the web app (`npm run build`). Now the `sf://planet/{z}/{x}/{y}` protocol and
the offline downloader both pull from *your* PMTiles. No other code changes needed —
the schema matches, so `mapStyle.js` just works.

### Path B — Bundled offline file via OPFS (fully offline, no server needed)

`src/lib/opfsTileStore.js` already streams a `.pmtiles` file into the device's
Origin Private File System and opens it with `openFromOPFS()`. To use your own file,
call its downloader with your URL:

```js
import { downloadToOPFS, openFromOPFS } from '@/lib/opfsTileStore';

// Download once (e.g. from a "Download map" button)
await downloadToOPFS('https://yourdomain.com/cz.pmtiles', 'cz.pmtiles', {
  onProgress: ({ pct }) => console.log(`Map download: ${pct}%`),
});

// Later, open it and hand tiles to MapLibre
const pm = await openFromOPFS('cz.pmtiles');
```

Because the file lives on the device, the map works with **no internet at all**.

### What you get for free after wiring in

- **Roads** render via the `transportation` layers already styled in `mapStyle.js`.
- **Offline routing** works automatically — `offlineRouter.js` builds its road graph
  by reading the `transportation` layer straight out of your tiles. No extra routing
  data, no OSRM server required.
- **Road name labels, shields, one-way arrows, 3D buildings** — all already wired to
  the OpenMapTiles fields your file now contains.

---

## 9. Custom POI icons

You asked to keep the current icons — good news, they need no work. Here's how they
work and how to change them if you ever want to.

### 9.1 The overlay POI markers (Leaflet) — `src/components/map/POILayer.jsx`

These are the round colored markers with an emoji. They're generated on a canvas by
`createPOIIcon(emoji, color, zoom)`. To change an icon, edit the category → emoji/
color mapping in `src/lib/POICategories.js`. For example:

```js
// src/lib/POICategories.js
restaurant: { emoji: '🍽️', color: '#e07b00' },
fuel:       { emoji: '⛽', color: '#3a81fc' },
// add your own:
climbing:   { emoji: '🧗', color: '#609e3f' },
```

No image files needed — emoji render everywhere and stay tiny.

### 9.2 POIs baked into the vector tiles (the `poi` source-layer)

Your Planetiler build also includes a `poi` layer inside the PMTiles. If you want to
render those directly on the base map with **image icons** (not emoji), you use a
MapLibre **sprite** — a single PNG atlas plus a JSON index. `mapStyle.js` currently
points `sprite` at the Protomaps asset server. To ship your own icons:

1. Put your PNG/SVG icons in a folder.
2. Build a sprite with **spreet** (<https://github.com/flother/spreet>):

   ```cmd
   spreet ./my-icons ./sprites/sprite
   ```

   This produces `sprite.png`, `sprite@2x.png`, `sprite.json`, `sprite@2x.json`.

3. Host that `sprites/` folder (same server as your tiles) and point the style at it:

   ```js
   // src/lib/mapStyle.js
   sprite: 'https://yourdomain.com/sprites/sprite',
   ```

4. Add a symbol layer that draws them from the `poi` source-layer:

   ```js
   { id: 'poi-icons', type: 'symbol', source: 'v', 'source-layer': 'poi', minzoom: 14,
     layout: {
       'icon-image': ['coalesce', ['image', ['get', 'class']], ['image', 'marker']],
       'icon-size': 0.8,
       'text-field': ['get', 'name'],
       'text-font': ['Noto Sans Regular'],
       'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top',
     },
     paint: { 'text-halo-width': 1.5, 'text-halo-color': '#fff' } },
   ```

Keep the emoji overlay for your app's own spots, and use the sprite approach only if
you want map-baked POI icons too. For most cases, the current emoji setup is simpler
and lighter.

---

## 10. Keeping your map up to date

OSM changes constantly. To refresh your data, just re-run the same Planetiler command
— `--download` grabs the newest OSM extract each time:

```cmd
java -Xmx4g -jar planetiler.jar --download --area=czech-republic --maxzoom=14 --output=cz.pmtiles
```

Then re-upload the file to your host (or re-trigger the in-app OPFS download). Because
it's one file, "updating the map" = "replace one file". Monthly is plenty for most
apps.

---

## 11. Quick reference — full pipeline in 4 commands

```cmd
:: 1. Build the map (roads, water, buildings, POIs — OpenMapTiles schema)
java -Xmx4g -jar planetiler.jar --download --area=czech-republic --maxzoom=14 --output=cz.pmtiles

:: 2. Preview it (drag cz.pmtiles onto this site)
::    https://pmtiles.io/

:: 3. Host it (Caddy example)
caddy run

:: 4. Point the app at it (.env), then rebuild
::    VITE_OMT_PLANET_URL=https://yourdomain.com/cz.pmtiles
npm run build
```

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Map is blank / only background color | Wrong schema (layer names don't match) | Use Planetiler (OpenMapTiles schema), not Protomaps v4 basemap |
| `206 Partial Content` missing / whole file downloads | Server doesn't support range requests | Fix server config (Part 7) |
| CORS error in browser console | Host isn't sending CORS headers | Add `Access-Control-Allow-Origin` + expose `Content-Range` |
| Roads show but no labels/shields | Tiles lack `transportation_name` layer | Rebuild with default Planetiler profile (includes it) |
| Offline routing returns nothing | Tiles for that area weren't downloaded to IndexedDB | Ensure the region was downloaded via the in-app downloader |
| File is huge | Max zoom too high / area too big | Add `--maxzoom=14`, use a bbox extract |
| Out-of-memory during build | Not enough RAM for the area | Raise `-Xmx` (e.g. `-Xmx8g`) or build a smaller area |

---

## Attribution (required)

OSM data is free to use but you **must** credit it. Your `mapStyle.js` already sets
the attribution string on the vector source:

```
© OpenStreetMap contributors
```

Keep that visible in the app (it already is). If you self-host, that's the only legal
obligation. Content in this guide was written for SpotFinder's specific architecture;
tool details come from each project's official docs (Planetiler, PMTiles, MapLibre,
Geofabrik).
