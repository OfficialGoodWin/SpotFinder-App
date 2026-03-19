/**
 * offlineManager.js
 * Country registry, tile coordinate math, and download queue.
 *
 * Download levels:
 *   basic    → zoom 0-12  (~3-20 MB)   navigation + city names
 *   standard → zoom 0-13  (~20-120 MB) street-level detail + POI labels
 *
 * Tile counts are pre-computed estimates; actual sizes vary with content.
 */

import { getTile, setTile, setMeta, deleteMeta, deleteTilesWithPrefix,
         deletePOIs, setPOIs } from './offlineStorage.js';

// ─── Country registry ─────────────────────────────────────────────────────────
// bbox: [west, south, east, north]  (lng_min, lat_min, lng_max, lat_max)
export const COUNTRIES = [
  { code: 'CZ', name: 'Czech Republic',   flag: '🇨🇿', bbox: [12.09, 48.55, 18.87, 51.06], basicMB: 12,  standardMB: 85  },
  { code: 'SK', name: 'Slovakia',         flag: '🇸🇰', bbox: [16.83, 47.73, 22.57, 49.61], basicMB: 8,   standardMB: 55  },
  { code: 'AT', name: 'Austria',          flag: '🇦🇹', bbox: [9.53,  46.37, 17.16, 49.02], basicMB: 10,  standardMB: 70  },
  { code: 'HU', name: 'Hungary',          flag: '🇭🇺', bbox: [16.11, 45.74, 22.90, 48.59], basicMB: 9,   standardMB: 60  },
  { code: 'PL', name: 'Poland',           flag: '🇵🇱', bbox: [14.12, 49.00, 24.15, 54.90], basicMB: 22,  standardMB: 180 },
  { code: 'DE', name: 'Germany',          flag: '🇩🇪', bbox: [5.87,  47.27, 15.04, 55.06], basicMB: 30,  standardMB: 260 },
  { code: 'FR', name: 'France',           flag: '🇫🇷', bbox: [-5.14, 41.33, 9.56,  51.09], basicMB: 38,  standardMB: 330 },
  { code: 'IT', name: 'Italy',            flag: '🇮🇹', bbox: [6.63,  35.49, 18.52, 47.09], basicMB: 28,  standardMB: 230 },
  { code: 'ES', name: 'Spain',            flag: '🇪🇸', bbox: [-9.30, 35.95, 4.33,  43.79], basicMB: 32,  standardMB: 260 },
  { code: 'HR', name: 'Croatia',          flag: '🇭🇷', bbox: [13.49, 42.38, 19.45, 46.55], basicMB: 7,   standardMB: 45  },
  { code: 'SI', name: 'Slovenia',         flag: '🇸🇮', bbox: [13.38, 45.42, 16.61, 46.88], basicMB: 3,   standardMB: 18  },
  { code: 'RO', name: 'Romania',          flag: '🇷🇴', bbox: [20.26, 43.62, 29.74, 48.27], basicMB: 18,  standardMB: 145 },
  { code: 'NL', name: 'Netherlands',      flag: '🇳🇱', bbox: [3.31,  50.75, 7.09,  53.55], basicMB: 6,   standardMB: 40  },
  { code: 'BE', name: 'Belgium',          flag: '🇧🇪', bbox: [2.54,  49.50, 6.40,  51.50], basicMB: 4,   standardMB: 28  },
  { code: 'CH', name: 'Switzerland',      flag: '🇨🇭', bbox: [5.96,  45.82, 10.49, 47.81], basicMB: 4,   standardMB: 30  },
  { code: 'PT', name: 'Portugal',         flag: '🇵🇹', bbox: [-9.50, 36.96, -6.19, 42.15], basicMB: 6,   standardMB: 45  },
  { code: 'GR', name: 'Greece',           flag: '🇬🇷', bbox: [19.37, 34.80, 28.24, 41.75], basicMB: 10,  standardMB: 75  },
  { code: 'UA', name: 'Ukraine',          flag: '🇺🇦', bbox: [22.14, 44.36, 40.23, 52.38], basicMB: 25,  standardMB: 210 },
];

// ─── Tile coordinate math ─────────────────────────────────────────────────────

export function lngToTileX(lng, z) {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, z));
}

export function latToTileY(lat, z) {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z));
}

/** Returns an array of {z,x,y} for all tiles covering a bbox at a given zoom */
export function tilesForBboxAtZoom(west, south, east, north, z) {
  const x0 = lngToTileX(west,  z);
  const x1 = lngToTileX(east,  z);
  const y0 = latToTileY(north, z);  // north = smaller y
  const y1 = latToTileY(south, z);  // south = larger y
  const tiles = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      tiles.push({ z, x, y });
    }
  }
  return tiles;
}

/** Total tile count for a country from zoom 0 up to and including maxZoom */
export function countTiles(country, maxZoom) {
  const [west, south, east, north] = country.bbox;
  let total = 0;
  for (let z = 0; z <= maxZoom; z++) {
    total += tilesForBboxAtZoom(west, south, east, north, z).length;
  }
  return total;
}

// Tile key used for IndexedDB — includes a hash of the URL template so different
// map styles are stored separately and don't collide.
export function tileKey(z, x, y, tplHash) {
  return `${tplHash}|${z}/${x}/${y}`;
}

/** Simple djb2-style hash of a string → short hex string */
export function hashTemplate(tpl) {
  let h = 5381;
  for (let i = 0; i < Math.min(tpl.length, 64); i++) {
    h = ((h << 5) + h) ^ tpl.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16);
}

/** Resolve a tile URL template (replaces {z}/{x}/{y}/{s}) */
export function resolveTileUrl(tpl, z, x, y) {
  // Replace {s} subdomain placeholder with a simple round-robin 'a'/'b'/'c'
  const subs = ['a', 'b', 'c'];
  const s    = subs[(x + y) % subs.length];
  return tpl
    .replace('{z}', z)
    .replace('{x}', x)
    .replace('{y}', y)
    .replace('{s}', s)
    .replace('{r}', '');  // retina suffix — ignore for cache
}

// ─── Download orchestrator ────────────────────────────────────────────────────

const CONCURRENCY = 6;  // parallel tile fetches

/**
 * Download tiles for a country and store in IndexedDB.
 *
 * @param {Object}   country     - entry from COUNTRIES
 * @param {string}   tileTemplate - e.g. "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
 * @param {number}   maxZoom     - inclusive (12 = basic, 13 = standard)
 * @param {Function} onProgress  - (done, total) callback
 * @param {Object}   abortRef    - { current: false } — set to true to cancel
 */
export async function downloadCountry({ country, tileTemplate, maxZoom = 12, onProgress, abortRef }) {
  const [west, south, east, north] = country.bbox;
  const tplHash = hashTemplate(tileTemplate);
  const prefix  = `${tplHash}|`;

  // Build full tile list
  const allTiles = [];
  for (let z = 0; z <= maxZoom; z++) {
    allTiles.push(...tilesForBboxAtZoom(west, south, east, north, z));
  }

  const total = allTiles.length;
  let done    = 0;
  let idx     = 0;

  async function worker() {
    while (idx < total) {
      if (abortRef?.current) return;
      const tile = allTiles[idx++];
      const key  = tileKey(tile.z, tile.x, tile.y, tplHash);

      // Skip tiles we already have
      try {
        const existing = await getTile(key);
        if (existing) { done++; onProgress?.(done, total); continue; }
      } catch (_) {}

      const url = resolveTileUrl(tileTemplate, tile.z, tile.x, tile.y);
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          await setTile(key, buf);
        }
      } catch (_) {
        // Silently skip failed tiles — they'll be fetched live when needed
      }

      done++;
      onProgress?.(done, total);
    }
  }

  // Launch workers
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  if (!abortRef?.current) {
    await setMeta(country.code, {
      downloadedAt: Date.now(),
      tileCount: done,
      zoomMax: maxZoom,
      tplHash,
      sizeMB: maxZoom <= 12 ? country.basicMB : country.standardMB,
    });
  }
}

/**
 * Download POI data for a country from Geoapify and store locally.
 * Only fetches the most important categories (restaurants, cafes, etc.)
 * at a coverage level suitable for offline browsing.
 */
const POI_CATEGORIES_OFFLINE = [
  'catering.restaurant', 'catering.cafe', 'catering.bar',
  'accommodation.hotel',
  'healthcare.pharmacy', 'healthcare.hospital',
  'service.financial.atm', 'service.financial.bank',
  'commercial.supermarket',
  'entertainment.museum', 'heritage',
  'public_transport.train', 'service.vehicle.fuel',
];

export async function downloadCountryPOIs({ country, geoapifyKey, onProgress, abortRef }) {
  if (!geoapifyKey) return;

  const [west, south, east, north] = country.bbox;
  const allPOIs  = [];
  const seen     = new Set();
  const cats     = POI_CATEGORIES_OFFLINE;
  const BATCH    = 4; // categories per request

  // Geoapify has a result limit of 500. For large countries we tile the bbox into a 3x3 grid.
  const gridSteps = country.basicMB > 20 ? 3 : 2;
  const latStep   = (north - south) / gridSteps;
  const lngStep   = (east  - west)  / gridSteps;

  const cells = [];
  for (let row = 0; row < gridSteps; row++) {
    for (let col = 0; col < gridSteps; col++) {
      cells.push({
        s: south + row * latStep,
        n: south + (row + 1) * latStep,
        w: west  + col * lngStep,
        e: west  + (col + 1) * lngStep,
      });
    }
  }

  const totalReqs = Math.ceil(cats.length / BATCH) * cells.length;
  let doneReqs = 0;

  for (const cell of cells) {
    if (abortRef?.current) return;

    for (let i = 0; i < cats.length; i += BATCH) {
      if (abortRef?.current) return;

      const batch = cats.slice(i, i + BATCH).join(',');
      const url   =
        `https://api.geoapify.com/v2/places` +
        `?categories=${encodeURIComponent(batch)}` +
        `&filter=rect:${cell.w},${cell.s},${cell.e},${cell.n}` +
        `&limit=500` +
        `&apiKey=${geoapifyKey}`;

      try {
        const res  = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          for (const feat of data.features || []) {
            const [lon, lat] = feat.geometry?.coordinates || [];
            if (!lat || !lon) continue;
            const id = feat.properties?.place_id || `${lat.toFixed(5)}-${lon.toFixed(5)}`;
            if (seen.has(id)) continue;
            seen.add(id);
            const p = feat.properties || {};
            allPOIs.push({
              id, lat, lon,
              name:       p.name || p.address_line1 || '',
              address:    p.address_line2 || p.formatted || '',
              categories: p.categories || [],
              phone:      p.contact?.phone,
              website:    p.website || p.contact?.website,
            });
          }
        }
      } catch (_) {}

      doneReqs++;
      onProgress?.(doneReqs, totalReqs);
      // Small pause to avoid hammering the API
      await new Promise(r => setTimeout(r, 80));
    }
  }

  if (!abortRef?.current) {
    await setPOIs(country.code, allPOIs);
  }
}

/**
 * Delete all downloaded data for a country (tiles + POIs + meta).
 */
export async function deleteCountry(country, tplHash) {
  const prefix = `${tplHash}|`;
  await Promise.all([
    deleteTilesWithPrefix(prefix),
    deletePOIs(country.code),
    deleteMeta(country.code),
  ]);
}

/**
 * Check if a lat/lng point is within a country's bbox.
 */
export function isPointInCountry(lat, lng, country) {
  const [west, south, east, north] = country.bbox;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

/**
 * Find which downloaded countries (from meta map) contain a given point.
 */
export function getDownloadedCountryAt(lat, lng, metaMap) {
  for (const code of Object.keys(metaMap)) {
    const country = COUNTRIES.find(c => c.code === code);
    if (country && isPointInCountry(lat, lng, country)) return country;
  }
  return null;
}
