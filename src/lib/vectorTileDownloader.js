/**
 * vectorTileDownloader.js
 *
 * Downloads vector tiles (MVT) for a country bbox directly from the
 * Protomaps planet PMTiles file using HTTP Range Requests.
 *
 * How it works:
 * 1. Uses the `pmtiles` JS library to open the remote 107GB planet file
 * 2. For each z/x/y tile in the country bbox, fetches ONLY that tile's bytes
 *    via a range request (no need to download the whole file)
 * 3. Stores each MVT tile in IndexedDB under key `vt|z/x/y`
 * 4. MapLibre uses a custom `offline-vt://` protocol that serves from IndexedDB
 *
 * This mirrors exactly what the pmtiles CLI does, but in JavaScript.
 */

import { PMTiles } from 'pmtiles';
import { getTile, setTile, setMeta, deleteMeta, getMeta, setPOIs, deletePOIs, getAllMeta } from './offlineStorage.js';

const PROTOMAPS_KEY  = import.meta.env.VITE_PROTOMAPS_KEY || '';
// IMPORTANT: this MUST be a PMTiles file using the OpenMapTiles layer schema
// (source-layers: landcover, landuse, water, waterway, transportation, building,
// park, boundary, place, poi — see src/lib/mapStyle.js). The map style is shared
// between online (OpenFreeMap, same schema) and offline mode.
// Protomaps' own "v4 basemap" schema (api.protomaps.com/tiles/v4.pmtiles) uses
// DIFFERENT layer names (roads/buildings/earth/physical_line/...), so tiles from
// it decode fine but none of the style layers match anything -> blank offline map.
// OpenFreeMap publishes a self-hostable planet PMTiles extract in the matching
// OpenMapTiles schema (see https://openfreemap.org/ "self-host" / download page) —
// verify the current file URL there before shipping, then set it via
// VITE_OMT_PLANET_URL, or replace the fallback below directly.
const PLANET_URL     = import.meta.env.VITE_OMT_PLANET_URL
  || 'https://download.openfreemap.org/planet.pmtiles';
const VT_KEY_PREFIX  = 'vt|';
const CONCURRENCY    = 32;

// ─── Country registry ─────────────────────────────────────────────────────────
export const COUNTRIES = [
  { code:'CZ', name:'Czech Republic',  flag:'🇨🇿', bbox:[12.09,48.55,18.87,51.06], sizeMB:210 },
  { code:'SK', name:'Slovakia',        flag:'🇸🇰', bbox:[16.83,47.73,22.57,49.61], sizeMB:140 },
  { code:'AT', name:'Austria',         flag:'🇦🇹', bbox:[9.53,46.37,17.16,49.02],  sizeMB:180 },
  { code:'HU', name:'Hungary',         flag:'🇭🇺', bbox:[16.11,45.74,22.90,48.59], sizeMB:160 },
  { code:'PL', name:'Poland',          flag:'🇵🇱', bbox:[14.12,49.00,24.15,54.90], sizeMB:480 },
  { code:'DE', name:'Germany',         flag:'🇩🇪', bbox:[5.87,47.27,15.04,55.06],  sizeMB:720 },
  { code:'FR', name:'France',          flag:'🇫🇷', bbox:[-5.14,41.33,9.56,51.09],  sizeMB:820 },
  { code:'IT', name:'Italy',           flag:'🇮🇹', bbox:[6.63,35.49,18.52,47.09],  sizeMB:580 },
  { code:'ES', name:'Spain',           flag:'🇪🇸', bbox:[-9.30,35.95,4.33,43.79],  sizeMB:620 },
  { code:'HR', name:'Croatia',         flag:'🇭🇷', bbox:[13.49,42.38,19.45,46.55], sizeMB:90  },
  { code:'SI', name:'Slovenia',        flag:'🇸🇮', bbox:[13.38,45.42,16.61,46.88], sizeMB:35  },
  { code:'RO', name:'Romania',         flag:'🇷🇴', bbox:[20.26,43.62,29.74,48.27], sizeMB:380 },
  { code:'NL', name:'Netherlands',     flag:'🇳🇱', bbox:[3.31,50.75,7.09,53.55],   sizeMB:110 },
  { code:'BE', name:'Belgium',         flag:'🇧🇪', bbox:[2.54,49.50,6.40,51.50],   sizeMB:75  },
  { code:'CH', name:'Switzerland',     flag:'🇨🇭', bbox:[5.96,45.82,10.49,47.81],  sizeMB:80  },
  { code:'PT', name:'Portugal',        flag:'🇵🇹', bbox:[-9.50,36.96,-6.19,42.15], sizeMB:95  },
  { code:'GR', name:'Greece',          flag:'🇬🇷', bbox:[19.37,34.80,28.24,41.75], sizeMB:155 },
  { code:'UA', name:'Ukraine',         flag:'🇺🇦', bbox:[22.14,44.36,40.23,52.38], sizeMB:540 },
];

// ─── Tile math ────────────────────────────────────────────────────────────────

export function lngToX(lng, z) {
  let wrappedLng = ((lng + 180) % 360);
  if (wrappedLng < 0) {
    wrappedLng += 360;
  }
  wrappedLng -= 180;
  
  const x = Math.floor(((wrappedLng + 180) / 360) * Math.pow(2, z));
  const maxTile = Math.pow(2, z) - 1;
  return Math.max(0, Math.min(maxTile, x));
}

export function latToY(lat, z) {
  const cappedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const r = (cappedLat * Math.PI) / 180;
  const y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z));
  const maxTile = Math.pow(2, z) - 1;
  return Math.max(0, Math.min(maxTile, y));
}

function getXRange(x0, x1, maxTile) {
  const xs = [];
  if (x0 <= x1) {
    for (let x = x0; x <= x1; x++) {
      xs.push(x);
    }
  } else {
    // Crosses antimeridian
    for (let x = x0; x <= maxTile; x++) {
      xs.push(x);
    }
    for (let x = 0; x <= x1; x++) {
      xs.push(x);
    }
  }
  return xs;
}

export function* tileGenerator(country, maxZoom) {
  const [west, south, east, north] = country.bbox;
  for (let z = 0; z <= maxZoom; z++) {
    const x0 = lngToX(west, z),  x1 = lngToX(east, z);
    const y0 = latToY(north, z), y1 = latToY(south, z);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const maxTile = Math.pow(2, z) - 1;
    const xs = getXRange(x0, x1, maxTile);
    for (const x of xs) {
      for (let y = minY; y <= maxY; y++) {
        yield { z, x, y };
      }
    }
  }
}

export function countTilesForCountry(country, maxZoom = 15) {
  const [west, south, east, north] = country.bbox;
  let total = 0;
  for (let z = 0; z <= maxZoom; z++) {
    const x0 = lngToX(west, z),  x1 = lngToX(east, z);
    const y0 = latToY(north, z), y1 = latToY(south, z);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const maxTile = Math.pow(2, z) - 1;
    
    let xCount = 0;
    if (x0 <= x1) {
      xCount = x1 - x0 + 1;
    } else {
      // Crosses antimeridian
      xCount = (maxTile - x0 + 1) + (x1 + 1);
    }
    const yCount = maxY - minY + 1;
    total += xCount * yCount;
  }
  return total;
}

// ─── IndexedDB key for vector tiles ──────────────────────────────────────────

export function vtKey(z, x, y) {
  return `${VT_KEY_PREFIX}${z}/${x}/${y}`;
}

export async function getVectorTile(z, x, y) {
  return getTile(vtKey(z, x, y));
}

export async function setVectorTile(z, x, y, buf) {
  return setTile(vtKey(z, x, y), buf);
}

// ─── Main download function ───────────────────────────────────────────────────

/**
 * Download all vector tiles for a country from the Protomaps planet file.
 * Uses HTTP Range Requests via the pmtiles JS library — no file hosting needed.
 *
 * maxZoom = 15 is the maximum supported by Protomaps (covers full street level detail)
 * maxZoom = 14 is recommended for most use cases (~200MB for CZ)
 * maxZoom = 15 is detailed but larger (~800MB for CZ, 4x more tiles than zoom 14)
 */
export async function downloadCountryVectorTiles({
  country,
  maxZoom = 15,
  onProgress,
  abortRef,
}) {
const cappedMaxZoom = Math.min(15, Math.max(0, Number(maxZoom) || 14));
  const pmtiles = new PMTiles(PLANET_URL);
  const total   = countTilesForCountry(country, cappedMaxZoom);

  let done        = 0;
  let fetched     = 0;
  let cached      = 0;
  let empty       = 0;
  let failed      = 0;
  let idx         = 0;
  let startTime   = Date.now();
  let lastReport  = 0;
  const allTiles  = [...tileGenerator(country, cappedMaxZoom)]; // need array for indexed access

  onProgress?.({
    phase:'tiles',
    done:0,
    total,
    fetched,
    cached,
    empty,
    failed,
    tilesPerSec:0,
    etaSec:0,
    maxZoom:cappedMaxZoom,
  });

  function report() {
    const now = Date.now();
    if (now - lastReport < 300 && done < total) return;
    lastReport = now;
    const elapsed     = Math.max((now - startTime)/1000, 0.1);
    const tilesPerSec = Math.round(done / elapsed);
    const etaSec      = tilesPerSec > 0 ? Math.round((total-done)/tilesPerSec) : 0;
    onProgress?.({
      phase:'tiles',
      done,
      total,
      fetched,
      cached,
      empty,
      failed,
      tilesPerSec,
      etaSec,
      maxZoom:cappedMaxZoom,
    });
  }

  async function worker() {
    while (true) {
      if (abortRef?.current) return;
      const i = idx++;
      if (i >= allTiles.length) return;
      const { z, x, y } = allTiles[i];
      const key = vtKey(z, x, y);

      // Skip if already cached
      try {
        const existing = await getTile(key);
        if (existing) {
          cached++;
          done++;
          report();
          continue;
        }
      } catch (_) {}

      // Fetch from remote PMTiles via range request
      try {
        const result = await pmtiles.getZxy(z, x, y);
        if (result?.data) {
          await setTile(key, result.data).catch(()=>{});
          fetched++;
        } else {
          empty++;
        }
      } catch (_) {
        failed++;
      }

      done++;
      report();
    }
  }

  // Run workers in parallel
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  if (!abortRef?.current) {
    await setMeta(country.code, {
      downloadedAt: Date.now(),
      tileCount:    done,
      fetchedCount: fetched,
      cachedCount:  cached,
      emptyCount:   empty,
      failedCount:  failed,
      maxZoom:      cappedMaxZoom,
      type:         'vector',
      sizeMB:       country.sizeMB,
    });

    // Build the offline routing graph in the background so turn-by-turn
    // navigation works offline without any server or native plugin. Best
    // effort — failure here shouldn't fail the tile download itself.
    import('./offlineRouter.js')
      .then(({ buildRoutingGraph }) => buildRoutingGraph(country, 'driving', { force: true }))
      .catch((e) => console.warn('[offline routing] graph build failed:', e?.message || e));
  }
}

// ─── POI download (unchanged) ─────────────────────────────────────────────────

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '';
const POI_CATS = [
  'catering.restaurant','catering.cafe','catering.bar','catering.fast_food',
  'accommodation.hotel','healthcare.pharmacy','healthcare.hospital',
  'service.financial.atm','service.financial.bank',
  'commercial.supermarket','commercial.food_and_drink',
  'entertainment.museum','heritage',
  'public_transport.train','service.vehicle.fuel','service.vehicle.charging_station',
  'parking',
];

export async function downloadCountryPOIs({ country, onProgress, abortRef }) {
  if (!GEOAPIFY_KEY) return;
  const [west,south,east,north] = country.bbox;
  const allPOIs = [], seen = new Set();
  const BATCH   = 4;
  const grid    = country.sizeMB > 400 ? 3 : 2;
  const latStep = (north-south)/grid, lngStep = (east-west)/grid;
  const cells   = [];
  for (let r=0;r<grid;r++)
    for (let c=0;c<grid;c++)
      cells.push({ s:south+r*latStep, n:south+(r+1)*latStep, w:west+c*lngStep, e:west+(c+1)*lngStep });

  const totalReqs = Math.ceil(POI_CATS.length/BATCH) * cells.length;
  let doneReqs = 0;

  for (const cell of cells) {
    if (abortRef?.current) return;
    for (let i=0; i<POI_CATS.length; i+=BATCH) {
      if (abortRef?.current) return;
      const batch = POI_CATS.slice(i,i+BATCH).join(',');
      const url   = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(batch)}&filter=rect:${cell.w},${cell.s},${cell.e},${cell.n}&limit=500&apiKey=${GEOAPIFY_KEY}`;
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          for (const feat of data.features||[]) {
            const [lon,lat] = feat.geometry?.coordinates||[];
            if (!lat||!lon) continue;
            const id = feat.properties?.place_id||`${lat.toFixed(5)}-${lon.toFixed(5)}`;
            if (seen.has(id)) continue;
            seen.add(id);
            const p = feat.properties||{};
            allPOIs.push({ id, lat, lon, name:p.name||'', address:p.address_line2||'', categories:p.categories||[], phone:p.contact?.phone, website:p.website });
          }
        }
      } catch (_) {}
      doneReqs++;
      onProgress?.({ phase:'pois', done:doneReqs, total:totalReqs, tilesPerSec:0, etaSec:0 });
      await new Promise(r=>setTimeout(r,60));
    }
  }
  if (!abortRef?.current) {
    await setPOIs(country.code, allPOIs);
    const existing = await getMeta(country.code)||{};
    await setMeta(country.code, { ...existing, hasPOIs:true });
  }
}

// ─── Delete country data ──────────────────────────────────────────────────────

export async function deleteCountry(country) {
  const { deleteTilesWithPrefix } = await import('./offlineStorage.js');
  await deleteTilesWithPrefix(VT_KEY_PREFIX);  // deletes all vt| tiles
  await deletePOIs(country.code);
  await deleteMeta(country.code);
}

export async function scrubInvalidMeta() {
  const all = await getAllMeta();
  for (const [code, meta] of Object.entries(all)) {
    if (!meta.tileCount || meta.tileCount < 10) {
      await deleteMeta(code);
    }
  }
}

// ─── Geo helpers ──────────────────────────────────────────────────────────────

export function isPointInCountry(lat, lng, country) {
  const [west,south,east,north] = country.bbox;
  return lat>=south && lat<=north && lng>=west && lng<=east;
}

export function getDownloadedCountryAt(lat, lng, metaMap) {
  for (const code of Object.keys(metaMap)) {
    const country = COUNTRIES.find(c=>c.code===code);
    if (country && isPointInCountry(lat,lng,country)) return country;
  }
  return null;
}
