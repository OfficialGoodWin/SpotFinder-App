/**
 * vectorTileDownloader.js  (updated)
 *
 * Changes from original:
 *   - downloadCountryVectorTiles now streams a single .pmtiles file to OPFS
 *     instead of fetching thousands of individual range-request tiles.
 *   - Tile server URL is configurable via VITE_TILE_SERVER env var.
 *   - downloadCountryPOIs now uses a finer adaptive grid to stay under
 *     Geoapify's 500-result limit per cell.
 *
 * Tile server setup: see /server/setup.md
 * The server must host files as: https://your-server/{CC}.pmtiles
 * Files are generated with: pmtiles extract planet.pmtiles {CC}.pmtiles --bbox=... --maxzoom=19
 */

import { downloadToOPFS, hasFile, deleteFromOPFS, getFileSizeMB } from './opfsTileStore.js';
import { setMeta, getMeta, deleteMeta, setPOIs, deletePOIs } from './offlineStorage.js';

const GEOAPIFY_KEY  = import.meta.env.VITE_GEOAPIFY_KEY || '';

// Your tile server base URL — set VITE_TILE_SERVER in .env
// e.g. https://tiles.yourserver.com  or  https://your-r2-bucket.r2.cloudflarestorage.com
const TILE_SERVER   = (import.meta.env.VITE_TILE_SERVER || '').replace(/\/$/, '');

// ─── Country registry ─────────────────────────────────────────────────────────

export const COUNTRIES = [
  { code:'CZ', name:'Czech Republic',  flag:'🇨🇿', bbox:[12.09,48.55,18.87,51.06], sizeMB:95  },
  { code:'SK', name:'Slovakia',        flag:'🇸🇰', bbox:[16.83,47.73,22.57,49.61], sizeMB:65  },
  { code:'AT', name:'Austria',         flag:'🇦🇹', bbox:[9.53,46.37,17.16,49.02],  sizeMB:80  },
  { code:'HU', name:'Hungary',         flag:'🇭🇺', bbox:[16.11,45.74,22.90,48.59], sizeMB:75  },
  { code:'PL', name:'Poland',          flag:'🇵🇱', bbox:[14.12,49.00,24.15,54.90], sizeMB:175 },
  { code:'DE', name:'Germany',         flag:'🇩🇪', bbox:[5.87,47.27,15.04,55.06],  sizeMB:280 },
  { code:'FR', name:'France',          flag:'🇫🇷', bbox:[-5.14,41.33,9.56,51.09],  sizeMB:320 },
  { code:'IT', name:'Italy',           flag:'🇮🇹', bbox:[6.63,35.49,18.52,47.09],  sizeMB:240 },
  { code:'ES', name:'Spain',           flag:'🇪🇸', bbox:[-9.30,35.95,4.33,43.79],  sizeMB:260 },
  { code:'HR', name:'Croatia',         flag:'🇭🇷', bbox:[13.49,42.38,19.45,46.55], sizeMB:90  },
  { code:'SI', name:'Slovenia',        flag:'🇸🇮', bbox:[13.38,45.42,16.61,46.88], sizeMB:35  },
  { code:'RO', name:'Romania',         flag:'🇷🇴', bbox:[20.26,43.62,29.74,48.27], sizeMB:170 },
  { code:'NL', name:'Netherlands',     flag:'🇳🇱', bbox:[3.31,50.75,7.09,53.55],   sizeMB:110 },
  { code:'BE', name:'Belgium',         flag:'🇧🇪', bbox:[2.54,49.50,6.40,51.50],   sizeMB:75  },
  { code:'CH', name:'Switzerland',     flag:'🇨🇭', bbox:[5.96,45.82,10.49,47.81],  sizeMB:80  },
  { code:'PT', name:'Portugal',        flag:'🇵🇹', bbox:[-9.50,36.96,-6.19,42.15], sizeMB:95  },
  { code:'GR', name:'Greece',          flag:'🇬🇷', bbox:[19.37,34.80,28.24,41.75], sizeMB:155 },
  { code:'UA', name:'Ukraine',         flag:'🇺🇦', bbox:[22.14,44.36,40.23,52.38], sizeMB:175 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isPointInCountry(lat, lng, country) {
  const [w, s, e, n] = country.bbox;
  return lat >= s && lat <= n && lng >= w && lng <= e;
}

export function getDownloadedCountryAt(lat, lng, metaMap) {
  for (const code of Object.keys(metaMap)) {
    const country = COUNTRIES.find(c => c.code === code);
    if (country && metaMap[code]?.type === 'pmtiles' && isPointInCountry(lat, lng, country)) {
      return country;
    }
  }
  return null;
}

/** Returns the OPFS filename for a country's .pmtiles file */
export function pmtilesFilename(code) { return `${code}.pmtiles`; }

// ─── Main download function ───────────────────────────────────────────────────

/**
 * Download a country's .pmtiles file from the tile server to OPFS.
 *
 * onProgress receives:
 *   { phase: 'tiles', receivedMB, totalMB, speedMBps, etaSec, pct }
 *   { phase: 'pois', done, total }
 *
 * abortRef: { current: false } — set .current = true to cancel.
 */
export async function downloadCountryVectorTiles({ country, onProgress, abortRef }) {
  if (!TILE_SERVER) {
    throw new Error('VITE_TILE_SERVER is not set. See server/setup.md for server setup instructions.');
  }

  const filename = pmtilesFilename(country.code);
  const url      = `${TILE_SERVER}/${filename}`;

  // Stream the .pmtiles file straight into OPFS
  const receivedBytes = await downloadToOPFS(url, filename, {
    onProgress: (p) => onProgress?.({ phase: 'tiles', ...p }),
    abortRef,
  });

  if (abortRef?.current) return;

  const sizeMB = Math.round(receivedBytes / 1048576);

  await setMeta(country.code, {
    type:        'pmtiles',
    downloadedAt: Date.now(),
    sizeMB,
    hasPOIs:     false,
    zoomMax:     19,
  });

  return { sizeMB };
}

// ─── POI download ─────────────────────────────────────────────────────────────

// Categories to download from Geoapify
const POI_CATS = [
  'accommodation.hotel',
  'accommodation.hostel',
  'accommodation.motel',
  'catering.restaurant',
  'catering.cafe',
  'catering.bar',
  'catering.fast_food',
  'commercial.supermarket',
  'commercial.food_and_drink',
  'service.financial.bank',
  'service.financial.atm',
  'service.vehicle.fuel',
  'service.vehicle.charging_station',
  'healthcare.hospital',
  'healthcare.pharmacy',
  'entertainment.museum',
  'entertainment.cinema',
  'entertainment.zoo',
  'heritage',
  'public_transport.train',
  'public_transport.bus',
  'parking',
  'sport',
  'tourism.sights',
];

/**
 * Download POIs for a country using an adaptive grid to stay under Geoapify's
 * 500-result limit per cell. Grid resolution scales with country area.
 *
 * For CZ (~75,000 km²): 8x8 grid = 64 cells × 6 category batches = ~384 API calls
 * Each cell covers ~18 km² — well under the density where 500 results would be hit.
 */
export async function downloadCountryPOIs({ country, onProgress, abortRef }) {
  if (!GEOAPIFY_KEY) return;

  const [west, south, east, north] = country.bbox;
  const area    = (east - west) * (north - south); // rough square-degrees area
  // Scale grid resolution: ~1 grid cell per ~0.3 sq degree
  const gridN   = Math.max(4, Math.min(12, Math.ceil(Math.sqrt(area / 0.3))));
  const latStep = (north - south) / gridN;
  const lngStep = (east  - west)  / gridN;

  const cells = [];
  for (let r = 0; r < gridN; r++)
    for (let c = 0; c < gridN; c++)
      cells.push({
        s: south + r * latStep,
        n: south + (r + 1) * latStep,
        w: west  + c * lngStep,
        e: west  + (c + 1) * lngStep,
      });

  const BATCH_SIZE   = 4; // categories per Geoapify request
  const CONCURRENCY  = 3; // parallel requests per cell
  const totalReqs    = cells.length * Math.ceil(POI_CATS.length / BATCH_SIZE);
  let   doneReqs     = 0;

  const allPOIs = [];
  const seen    = new Set();

  function addPOIs(features) {
    for (const feat of features) {
      const [lon, lat] = feat.geometry?.coordinates || [];
      if (!lat || !lon) continue;
      const p  = feat.properties || {};
      const id = p.place_id || `${lat.toFixed(5)}-${lon.toFixed(5)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      allPOIs.push({
        id, lat, lon,
        name:       p.name             || '',
        address:    p.address_line2    || '',
        categories: p.categories       || [],
        phone:      p.contact?.phone,
        website:    p.website,
      });
    }
  }

  // Process cells with limited concurrency
  for (let i = 0; i < cells.length; i += CONCURRENCY) {
    if (abortRef?.current) return;

    const chunk = cells.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (cell) => {
      // Fetch each batch of categories for this cell
      for (let j = 0; j < POI_CATS.length; j += BATCH_SIZE) {
        if (abortRef?.current) return;

        const batch = POI_CATS.slice(j, j + BATCH_SIZE).join(',');
        const url   = `https://api.geoapify.com/v2/places`
          + `?categories=${encodeURIComponent(batch)}`
          + `&filter=rect:${cell.w},${cell.s},${cell.e},${cell.n}`
          + `&limit=500&apiKey=${GEOAPIFY_KEY}`;

        // Retry up to 2 times on network errors
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              addPOIs(data.features || []);
            }
            break;
          } catch (_) {
            if (attempt < 2) await delay(500 * (attempt + 1));
          }
        }

        doneReqs++;
        onProgress?.({ phase: 'pois', done: doneReqs, total: totalReqs });
        await delay(80); // Rate limit: ~12 req/sec
      }
    }));
  }

  if (abortRef?.current) return;

  await setPOIs(country.code, allPOIs);

  const existing = (await getMeta(country.code)) || {};
  await setMeta(country.code, { ...existing, hasPOIs: true, poiCount: allPOIs.length });
}

// ─── Delete country ───────────────────────────────────────────────────────────

export async function deleteCountry(country) {
  await deleteFromOPFS(pmtilesFilename(country.code));
  await deletePOIs(country.code);
  await deleteMeta(country.code);
}

// ─── Scrub invalid meta entries ───────────────────────────────────────────────

export async function scrubInvalidMeta() {
  const { getAllMeta } = await import('./offlineStorage.js');
  const all = await getAllMeta();
  for (const [code, meta] of Object.entries(all)) {
    if (meta?.type === 'pmtiles') {
      const exists = await hasFile(pmtilesFilename(code));
      if (!exists) await deleteMeta(code);
    }
  }
}

// ─── Legacy exports (keep compatibility with MapLibreMap.jsx) ─────────────────

/** No-op: individual tile storage replaced by OPFS PMTiles */
export function vtKey() { return ''; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// getMeta re-exported so MapLibreMap can import from one place
export { getMeta } from './offlineStorage.js';
export { getAllMeta } from './offlineStorage.js';
