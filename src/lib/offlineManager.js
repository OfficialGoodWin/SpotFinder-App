/**
 * offlineManager.js
 *
 * Single "Download Country" — downloads everything needed for full offline use:
 *   1. Map tiles  zoom 0-19  (all tile levels, worker pool of 64)
 *   2. POI data   via Geoapify (restaurants, cafes, hospitals, etc.)
 *
 * Voice navigation uses browser SpeechSynthesis which is built-in and offline.
 * Routing uses OSRM which needs internet — offline routing is not implemented.
 */

import { getTile, setTile, setMeta, deleteMeta, deletePOIs, setPOIs, getMeta } from './offlineStorage.js';

// ─── Country registry ─────────────────────────────────────────────────────────
export const COUNTRIES = [
  { code: 'CZ', name: 'Czech Republic',  flag: '🇨🇿', bbox: [12.09, 48.55, 18.87, 51.06], sizeMB: 1800 },
  { code: 'SK', name: 'Slovakia',        flag: '🇸🇰', bbox: [16.83, 47.73, 22.57, 49.61], sizeMB: 1100 },
  { code: 'AT', name: 'Austria',         flag: '🇦🇹', bbox: [9.53,  46.37, 17.16, 49.02], sizeMB: 1500 },
  { code: 'HU', name: 'Hungary',         flag: '🇭🇺', bbox: [16.11, 45.74, 22.90, 48.59], sizeMB: 1200 },
  { code: 'PL', name: 'Poland',          flag: '🇵🇱', bbox: [14.12, 49.00, 24.15, 54.90], sizeMB: 4500 },
  { code: 'DE', name: 'Germany',         flag: '🇩🇪', bbox: [5.87,  47.27, 15.04, 55.06], sizeMB: 7000 },
  { code: 'FR', name: 'France',          flag: '🇫🇷', bbox: [-5.14, 41.33, 9.56,  51.09], sizeMB: 8000 },
  { code: 'IT', name: 'Italy',           flag: '🇮🇹', bbox: [6.63,  35.49, 18.52, 47.09], sizeMB: 5500 },
  { code: 'ES', name: 'Spain',           flag: '🇪🇸', bbox: [-9.30, 35.95, 4.33,  43.79], sizeMB: 6000 },
  { code: 'HR', name: 'Croatia',         flag: '🇭🇷', bbox: [13.49, 42.38, 19.45, 46.55], sizeMB: 900  },
  { code: 'SI', name: 'Slovenia',        flag: '🇸🇮', bbox: [13.38, 45.42, 16.61, 46.88], sizeMB: 380  },
  { code: 'RO', name: 'Romania',         flag: '🇷🇴', bbox: [20.26, 43.62, 29.74, 48.27], sizeMB: 3000 },
  { code: 'NL', name: 'Netherlands',     flag: '🇳🇱', bbox: [3.31,  50.75, 7.09,  53.55], sizeMB: 800  },
  { code: 'BE', name: 'Belgium',         flag: '🇧🇪', bbox: [2.54,  49.50, 6.40,  51.50], sizeMB: 580  },
  { code: 'CH', name: 'Switzerland',     flag: '🇨🇭', bbox: [5.96,  45.82, 10.49, 47.81], sizeMB: 650  },
  { code: 'PT', name: 'Portugal',        flag: '🇵🇹', bbox: [-9.50, 36.96, -6.19, 42.15], sizeMB: 950  },
  { code: 'GR', name: 'Greece',          flag: '🇬🇷', bbox: [19.37, 34.80, 28.24, 41.75], sizeMB: 1600 },
  { code: 'UA', name: 'Ukraine',         flag: '🇺🇦', bbox: [22.14, 44.36, 40.23, 52.38], sizeMB: 4800 },
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
  const x0 = lngToX(west, z),  x1 = lngToX(east,  z);
  const y0 = latToY(north, z), y1 = latToY(south, z);
  const tiles = [];
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      tiles.push({ z, x, y });
  return tiles;
}

export function countTilesForCountry(country, maxZoom = 19) {
  const [west, south, east, north] = country.bbox;
  let total = 0;
  for (let z = 0; z <= maxZoom; z++) {
    const x0 = lngToX(west, z),  x1 = lngToX(east,  z);
    const y0 = latToY(north, z), y1 = latToY(south, z);
    total += (x1 - x0 + 1) * (y1 - y0 + 1);
  }
  return total;
}

export function tileKey(z, x, y, urlHash) {
  return `${urlHash}|${z}/${x}/${y}`;
}

export function hashUrl(url) {
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

// ─── Worker pool tile downloader ──────────────────────────────────────────────

const CONCURRENCY = 64;
const MAX_RETRIES = 1;

async function fetchTileWithRetry(url) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) return await res.arrayBuffer();
      if (res.status === 429 && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      }
    } catch (_) {
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 200));
    }
  }
  return null;
}

async function downloadTiles({ country, tileTemplate, maxZoom = 19, onProgress, abortRef }) {
  const [west, south, east, north] = country.bbox;
  const urlHash = hashUrl(tileTemplate);
  const total   = countTilesForCountry(country, maxZoom);

  let done       = 0;
  let startTime  = Date.now();
  let lastReport = 0;

  onProgress?.({ phase: 'tiles', done: 0, total, tilesPerSec: 0, etaSec: 0 });

  function report() {
    const now = Date.now();
    if (now - lastReport < 250 && done < total) return;
    lastReport = now;
    const elapsed     = Math.max((now - startTime) / 1000, 0.1);
    const tilesPerSec = Math.round(done / elapsed);
    const etaSec      = tilesPerSec > 0 ? Math.round((total - done) / tilesPerSec) : 0;
    onProgress?.({ phase: 'tiles', done, total, tilesPerSec, etaSec });
  }

  // Lazy tile generator — yields one tile at a time, never builds a huge array
  function* tileGenerator() {
    for (let z = 0; z <= maxZoom; z++) {
      const x0 = lngToX(west, z),  x1 = lngToX(east,  z);
      const y0 = latToY(north, z), y1 = latToY(south, z);
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++)
          yield { z, x, y };
    }
  }

  const gen = tileGenerator();

  // Each worker pulls the next tile from the generator
  async function worker() {
    while (true) {
      if (abortRef?.current) return;
      const next = gen.next();
      if (next.done) return;

      const { z, x, y } = next.value;
      const key = tileKey(z, x, y, urlHash);

      try {
        const existing = await getTile(key);
        if (!existing) {
          const buf = await fetchTileWithRetry(resolveTileUrl(tileTemplate, z, x, y));
          if (buf) await setTile(key, buf).catch(() => {});
        }
      } catch (_) {}

      done++;
      report();
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return { done, urlHash };
}

// ─── POI downloader ───────────────────────────────────────────────────────────

const POI_CATS = [
  'catering.restaurant', 'catering.cafe', 'catering.bar', 'catering.fast_food',
  'accommodation.hotel', 'accommodation.hostel', 'accommodation.camping',
  'healthcare.pharmacy', 'healthcare.hospital', 'healthcare.dentist',
  'service.financial.atm', 'service.financial.bank',
  'commercial.supermarket', 'commercial.food_and_drink',
  'entertainment.museum', 'heritage',
  'public_transport.train', 'public_transport.bus',
  'service.vehicle.fuel', 'service.vehicle.charging_station',
  'parking',
];

async function downloadPOIs({ country, geoapifyKey, onProgress, abortRef }) {
  if (!geoapifyKey) return [];

  const [west, south, east, north] = country.bbox;
  const allPOIs = [];
  const seen    = new Set();
  const BATCH   = 4;
  const grid    = country.sizeMB > 3000 ? 4 : country.sizeMB > 1000 ? 3 : 2;
  const latStep = (north - south) / grid;
  const lngStep = (east - west)   / grid;
  const cells   = [];

  for (let row = 0; row < grid; row++)
    for (let col = 0; col < grid; col++)
      cells.push({
        s: south + row * latStep,   n: south + (row + 1) * latStep,
        w: west  + col * lngStep,   e: west  + (col + 1) * lngStep,
      });

  const totalReqs = Math.ceil(POI_CATS.length / BATCH) * cells.length;
  let doneReqs = 0;

  for (const cell of cells) {
    if (abortRef?.current) return allPOIs;
    for (let i = 0; i < POI_CATS.length; i += BATCH) {
      if (abortRef?.current) return allPOIs;
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
            allPOIs.push({ id, lat, lon, name: p.name || '', address: p.address_line2 || p.formatted || '', categories: p.categories || [], phone: p.contact?.phone, website: p.website });
          }
        }
      } catch (_) {}
      doneReqs++;
      onProgress?.({ phase: 'pois', done: doneReqs, total: totalReqs, tilesPerSec: 0, etaSec: 0 });
      await new Promise(r => setTimeout(r, 60));
    }
  }
  return allPOIs;
}

// ─── Main download entry point ────────────────────────────────────────────────

const MAPY_KEY      = import.meta.env.VITE_MAPY_API_KEY || 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';
const TILE_TEMPLATE = `https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${MAPY_KEY}`;

/**
 * Download everything for a country — tiles (zoom 0-19) + POIs.
 * onProgress({ phase, done, total, tilesPerSec, etaSec })
 *   phase: 'tiles' | 'pois'
 */
export async function downloadCountry({ country, geoapifyKey, onProgress, abortRef }) {
  // Phase 1: tiles
  const { done: tilesDone, urlHash } = await downloadTiles({
    country, tileTemplate: TILE_TEMPLATE, maxZoom: 19, onProgress, abortRef,
  });

  if (abortRef?.current) return;

  // Phase 2: POIs
  const pois = await downloadPOIs({ country, geoapifyKey, onProgress, abortRef });

  if (!abortRef?.current) {
    if (pois.length > 0) await setPOIs(country.code, pois);
    await setMeta(country.code, {
      downloadedAt: Date.now(),
      tileCount:    tilesDone,
      maxZoom:      19,
      urlHash,
      hasPOIs:      pois.length > 0,
      sizeMB:       country.sizeMB,
    });
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteCountry(country) {
  const meta = await getMeta(country.code);
  if (meta?.urlHash) {
    const { deleteTilesWithPrefix } = await import('./offlineStorage.js');
    await deleteTilesWithPrefix(`${meta.urlHash}|`);
  }
  await deletePOIs(country.code);
  await deleteMeta(country.code);
}

export async function scrubInvalidMeta() {
  const { getAllMeta } = await import('./offlineStorage.js');
  const all = await getAllMeta();
  for (const [code, meta] of Object.entries(all)) {
    if (!meta.tileCount || meta.tileCount < 10) {
      await deleteMeta(code);
    }
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