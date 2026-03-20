/**
 * offlineManager.js
 * 
 * Batch tile downloader — downloads all tiles for a country in parallel
 * batches of 32, stores them in IndexedDB, serves them offline.
 * 
 * Zoom levels:
 *   basic    → 0-15  street level navigation
 *   detailed → 0-19  every building and alley
 */

import {
  getTile, setTile, setMeta, deleteMeta,
  deletePOIs, setPOIs, getMeta
} from './offlineStorage.js';

// ─── Country registry ─────────────────────────────────────────────────────────
// bbox: [west, south, east, north]
export const COUNTRIES = [
  { code: 'CZ', name: 'Czech Republic',  flag: '🇨🇿', bbox: [12.09, 48.55, 18.87, 51.06], basicMB: 55,  detailedMB: 1800 },
  { code: 'SK', name: 'Slovakia',        flag: '🇸🇰', bbox: [16.83, 47.73, 22.57, 49.61], basicMB: 35,  detailedMB: 1100 },
  { code: 'AT', name: 'Austria',         flag: '🇦🇹', bbox: [9.53,  46.37, 17.16, 49.02], basicMB: 45,  detailedMB: 1500 },
  { code: 'HU', name: 'Hungary',         flag: '🇭🇺', bbox: [16.11, 45.74, 22.90, 48.59], basicMB: 38,  detailedMB: 1200 },
  { code: 'PL', name: 'Poland',          flag: '🇵🇱', bbox: [14.12, 49.00, 24.15, 54.90], basicMB: 120, detailedMB: 4500 },
  { code: 'DE', name: 'Germany',         flag: '🇩🇪', bbox: [5.87,  47.27, 15.04, 55.06], basicMB: 180, detailedMB: 7000 },
  { code: 'FR', name: 'France',          flag: '🇫🇷', bbox: [-5.14, 41.33, 9.56,  51.09], basicMB: 210, detailedMB: 8000 },
  { code: 'IT', name: 'Italy',           flag: '🇮🇹', bbox: [6.63,  35.49, 18.52, 47.09], basicMB: 150, detailedMB: 5500 },
  { code: 'ES', name: 'Spain',           flag: '🇪🇸', bbox: [-9.30, 35.95, 4.33,  43.79], basicMB: 160, detailedMB: 6000 },
  { code: 'HR', name: 'Croatia',         flag: '🇭🇷', bbox: [13.49, 42.38, 19.45, 46.55], basicMB: 28,  detailedMB: 900  },
  { code: 'SI', name: 'Slovenia',        flag: '🇸🇮', bbox: [13.38, 45.42, 16.61, 46.88], basicMB: 12,  detailedMB: 380  },
  { code: 'RO', name: 'Romania',         flag: '🇷🇴', bbox: [20.26, 43.62, 29.74, 48.27], basicMB: 90,  detailedMB: 3000 },
  { code: 'NL', name: 'Netherlands',     flag: '🇳🇱', bbox: [3.31,  50.75, 7.09,  53.55], basicMB: 25,  detailedMB: 800  },
  { code: 'BE', name: 'Belgium',         flag: '🇧🇪', bbox: [2.54,  49.50, 6.40,  51.50], basicMB: 18,  detailedMB: 580  },
  { code: 'CH', name: 'Switzerland',     flag: '🇨🇭', bbox: [5.96,  45.82, 10.49, 47.81], basicMB: 20,  detailedMB: 650  },
  { code: 'PT', name: 'Portugal',        flag: '🇵🇹', bbox: [-9.50, 36.96, -6.19, 42.15], basicMB: 30,  detailedMB: 950  },
  { code: 'GR', name: 'Greece',          flag: '🇬🇷', bbox: [19.37, 34.80, 28.24, 41.75], basicMB: 48,  detailedMB: 1600 },
  { code: 'UA', name: 'Ukraine',         flag: '🇺🇦', bbox: [22.14, 44.36, 40.23, 52.38], basicMB: 130, detailedMB: 4800 },
];

// ─── Tile math ────────────────────────────────────────────────────────────────

export function lngToX(lng, z) {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, z));
}

export function latToY(lat, z) {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z));
}

function tilesForZoom(west, south, east, north, z) {
  const x0 = lngToX(west,  z), x1 = lngToX(east,  z);
  const y0 = latToY(north, z), y1 = latToY(south, z);
  const tiles = [];
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      tiles.push({ z, x, y });
  return tiles;
}

export function tileKey(z, x, y, urlHash) {
  return `${urlHash}|${z}/${x}/${y}`;
}

export function hashUrl(url) {
  // Short hash of the tile template so different styles don't collide
  let h = 5381;
  for (let i = 0; i < Math.min(url.length, 80); i++) {
    h = ((h << 5) + h) ^ url.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16);
}

export function resolveTileUrl(template, z, x, y) {
  const s = ['a', 'b', 'c'][(x + y) % 3];
  return template
    .replace('{z}', z).replace('{x}', x).replace('{y}', y)
    .replace('{s}', s).replace('{r}', '');
}

// ─── Batch downloader ─────────────────────────────────────────────────────────

const BATCH_SIZE  = 32;   // tiles fetched in parallel per batch
const MAX_RETRIES = 2;    // retry failed tiles this many times

async function fetchTileWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) return await res.arrayBuffer();
      if (res.status === 429 && attempt < retries) {
        // Rate limited — back off
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
    } catch (_) {
      if (attempt < retries) await new Promise(r => setTimeout(r, 500));
    }
  }
  return null; // Skip failed tiles silently
}

/**
 * Download all tiles for a country in parallel batches.
 * 
 * @param {Object}   country      - entry from COUNTRIES
 * @param {string}   tileTemplate - URL template with {z}/{x}/{y}
 * @param {number}   maxZoom      - 15 for basic, 19 for detailed
 * @param {Function} onProgress   - ({ done, total, tilesPerSec, etaSec }) => void
 * @param {Object}   abortRef     - { current: false } set true to cancel
 */
export async function downloadCountryTiles({ country, tileTemplate, maxZoom = 15, onProgress, abortRef }) {
  const [west, south, east, north] = country.bbox;
  const urlHash = hashUrl(tileTemplate);

  // Build full tile list across all zoom levels
  const allTiles = [];
  for (let z = 0; z <= maxZoom; z++) {
    allTiles.push(...tilesForZoom(west, south, east, north, z));
  }

  const total     = allTiles.length;
  let done        = 0;
  let startTime   = Date.now();

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < total; i += BATCH_SIZE) {
    if (abortRef?.current) break;

    const batch = allTiles.slice(i, i + BATCH_SIZE);

    // Download entire batch in parallel
    await Promise.all(batch.map(async ({ z, x, y }) => {
      if (abortRef?.current) return;

      const key = tileKey(z, x, y, urlHash);

      // Skip tiles already in cache
      try {
        const existing = await getTile(key);
        if (existing) { done++; return; }
      } catch (_) {}

      const url = resolveTileUrl(tileTemplate, z, x, y);
      const buf = await fetchTileWithRetry(url);
      if (buf) {
        try { await setTile(key, buf); } catch (_) {}
      }
      done++;
    }));

    // Report progress after each batch
    const elapsed     = (Date.now() - startTime) / 1000;
    const tilesPerSec = elapsed > 0 ? Math.round(done / elapsed) : 0;
    const remaining   = total - done;
    const etaSec      = tilesPerSec > 0 ? Math.round(remaining / tilesPerSec) : 0;
    onProgress?.({ done, total, tilesPerSec, etaSec });
  }

  if (!abortRef?.current) {
    await setMeta(country.code, {
      downloadedAt: Date.now(),
      tileCount:    done,
      maxZoom,
      urlHash,
      sizeMB:       maxZoom <= 15 ? country.basicMB : country.detailedMB,
    });
  }
}

// ─── Delete country ────────────────────────────────────────────────────────────

export async function deleteCountryTiles(country) {
  const meta = await getMeta(country.code);
  if (!meta?.urlHash) {
    await deleteMeta(country.code);
    return;
  }

  // Delete all tiles with this country's urlHash prefix
  const { deleteTilesWithPrefix } = await import('./offlineStorage.js');
  await deleteTilesWithPrefix(`${meta.urlHash}|`);
  await deletePOIs(country.code);
  await deleteMeta(country.code);
}

// ─── POI download ─────────────────────────────────────────────────────────────

const POI_CATS = [
  'catering.restaurant', 'catering.cafe', 'catering.bar',
  'accommodation.hotel', 'healthcare.pharmacy', 'healthcare.hospital',
  'service.financial.atm', 'service.financial.bank',
  'commercial.supermarket', 'entertainment.museum', 'heritage',
  'public_transport.train', 'service.vehicle.fuel',
];

export async function downloadCountryPOIs({ country, geoapifyKey, onProgress, abortRef }) {
  if (!geoapifyKey) return;

  const [west, south, east, north] = country.bbox;
  const allPOIs = [];
  const seen    = new Set();
  const BATCH   = 4;
  const gridSteps = country.basicMB > 100 ? 3 : 2;
  const latStep   = (north - south) / gridSteps;
  const lngStep   = (east  - west)  / gridSteps;
  const cells     = [];

  for (let row = 0; row < gridSteps; row++)
    for (let col = 0; col < gridSteps; col++)
      cells.push({
        s: south + row * latStep, n: south + (row + 1) * latStep,
        w: west  + col * lngStep, e: west  + (col + 1) * lngStep,
      });

  const totalReqs = Math.ceil(POI_CATS.length / BATCH) * cells.length;
  let doneReqs = 0;

  for (const cell of cells) {
    if (abortRef?.current) return;
    for (let i = 0; i < POI_CATS.length; i += BATCH) {
      if (abortRef?.current) return;
      const batch = POI_CATS.slice(i, i + BATCH).join(',');
      const url   = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(batch)}&filter=rect:${cell.w},${cell.s},${cell.e},${cell.n}&limit=500&apiKey=${geoapifyKey}`;
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          for (const feat of data.features || []) {
            const [lon, lat] = feat.geometry?.coordinates || [];
            if (!lat || !lon) continue;
            const id = feat.properties?.place_id || `${lat.toFixed(5)}-${lon.toFixed(5)}`;
            if (seen.has(id)) continue;
            seen.add(id);
            const p = feat.properties || {};
            allPOIs.push({ id, lat, lon, name: p.name || '', address: p.address_line2 || '', categories: p.categories || [], phone: p.contact?.phone, website: p.website });
          }
        }
      } catch (_) {}
      doneReqs++;
      onProgress?.({ done: doneReqs, total: totalReqs, tilesPerSec: 0, etaSec: 0 });
      await new Promise(r => setTimeout(r, 80));
    }
  }

  if (!abortRef?.current) {
    await setPOIs(country.code, allPOIs);
    const existing = await getMeta(country.code) || {};
    await setMeta(country.code, { ...existing, hasPOIs: true });
  }
}

// ─── Geo helpers ──────────────────────────────────────────────────────────────

export function isPointInCountry(lat, lng, country) {
  const [west, south, east, north] = country.bbox;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

export function getDownloadedCountryAt(lat, lng, metaMap) {
  for (const code of Object.keys(metaMap)) {
    const country = COUNTRIES.find(c => c.code === code);
    if (country && isPointInCountry(lat, lng, country)) return country;
  }
  return null;
}