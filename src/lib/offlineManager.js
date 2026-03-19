/**
 * offlineManager.js
 * 
 * PMTiles-based offline map system.
 * 
 * Downloads a single .pmtiles file per country from /offline/{CC}.pmtiles
 * on your own Vercel deployment. Stores in OPFS (Origin Private File System)
 * which is optimised for large binary files — much better than IndexedDB.
 * 
 * To generate the PMTiles files, run the pmtiles CLI once per country:
 *   npm install -g pmtiles
 *   pmtiles extract https://build.protomaps.com/20260319.pmtiles public/offline/CZ.pmtiles \
 *     --bbox=12.09,48.55,18.87,51.06 --maxzoom=14
 * Then commit public/offline/*.pmtiles to your repo (Vercel serves them as static files).
 */

import { setMeta, deleteMeta, deletePOIs, setPOIs, getMeta } from './offlineStorage.js';

// ─── Country registry ─────────────────────────────────────────────────────────
// basicMB   = zoom 0–15  (navigation + street names, ~same as Google Maps default)
// detailedMB = zoom 0–19  (every building, alley, parking spot — very large files)
export const COUNTRIES = [
  { code: 'CZ', name: 'Czech Republic',   flag: '🇨🇿', bbox: [12.09, 48.55, 18.87, 51.06], basicMB: 55,   detailedMB: 1800  },
  { code: 'SK', name: 'Slovakia',         flag: '🇸🇰', bbox: [16.83, 47.73, 22.57, 49.61], basicMB: 35,   detailedMB: 1100  },
  { code: 'AT', name: 'Austria',          flag: '🇦🇹', bbox: [9.53,  46.37, 17.16, 49.02], basicMB: 45,   detailedMB: 1500  },
  { code: 'HU', name: 'Hungary',          flag: '🇭🇺', bbox: [16.11, 45.74, 22.90, 48.59], basicMB: 38,   detailedMB: 1200  },
  { code: 'PL', name: 'Poland',           flag: '🇵🇱', bbox: [14.12, 49.00, 24.15, 54.90], basicMB: 120,  detailedMB: 4500  },
  { code: 'DE', name: 'Germany',          flag: '🇩🇪', bbox: [5.87,  47.27, 15.04, 55.06], basicMB: 180,  detailedMB: 7000  },
  { code: 'FR', name: 'France',           flag: '🇫🇷', bbox: [-5.14, 41.33, 9.56,  51.09], basicMB: 210,  detailedMB: 8000  },
  { code: 'IT', name: 'Italy',            flag: '🇮🇹', bbox: [6.63,  35.49, 18.52, 47.09], basicMB: 150,  detailedMB: 5500  },
  { code: 'ES', name: 'Spain',            flag: '🇪🇸', bbox: [-9.30, 35.95, 4.33,  43.79], basicMB: 160,  detailedMB: 6000  },
  { code: 'HR', name: 'Croatia',          flag: '🇭🇷', bbox: [13.49, 42.38, 19.45, 46.55], basicMB: 28,   detailedMB: 900   },
  { code: 'SI', name: 'Slovenia',         flag: '🇸🇮', bbox: [13.38, 45.42, 16.61, 46.88], basicMB: 12,   detailedMB: 380   },
  { code: 'RO', name: 'Romania',          flag: '🇷🇴', bbox: [20.26, 43.62, 29.74, 48.27], basicMB: 90,   detailedMB: 3000  },
  { code: 'NL', name: 'Netherlands',      flag: '🇳🇱', bbox: [3.31,  50.75, 7.09,  53.55], basicMB: 25,   detailedMB: 800   },
  { code: 'BE', name: 'Belgium',          flag: '🇧🇪', bbox: [2.54,  49.50, 6.40,  51.50], basicMB: 18,   detailedMB: 580   },
  { code: 'CH', name: 'Switzerland',      flag: '🇨🇭', bbox: [5.96,  45.82, 10.49, 47.81], basicMB: 20,   detailedMB: 650   },
  { code: 'PT', name: 'Portugal',         flag: '🇵🇹', bbox: [-9.50, 36.96, -6.19, 42.15], basicMB: 30,   detailedMB: 950   },
  { code: 'GR', name: 'Greece',           flag: '🇬🇷', bbox: [19.37, 34.80, 28.24, 41.75], basicMB: 48,   detailedMB: 1600  },
  { code: 'UA', name: 'Ukraine',          flag: '🇺🇦', bbox: [22.14, 44.36, 40.23, 52.38], basicMB: 130,  detailedMB: 4800  },
];

// ─── OPFS helpers ─────────────────────────────────────────────────────────────
// OPFS = Origin Private File System — browser API for large file storage.
// Much faster than IndexedDB for binary blobs (no serialisation overhead).

async function getOPFSRoot() {
  return navigator.storage.getDirectory();
}

async function getOfflineDir() {
  const root = await getOPFSRoot();
  return root.getDirectoryHandle('offline-maps', { create: true });
}

/** Returns a File object for a downloaded country, or null if not present */
export async function getCountryFile(code, meta) {
  try {
    const dir    = await getOfflineDir();
    // Try the suffix stored in meta first, then fall back to either variant
    const suffix = meta?.suffix || null;
    const tries  = suffix ? [`${code}-${suffix}.pmtiles`] : [`${code}-detailed.pmtiles`, `${code}-basic.pmtiles`];
    for (const name of tries) {
      try {
        const handle = await dir.getFileHandle(name);
        return handle.getFile();
      } catch (_) {}
    }
    return null;
  } catch (_) {
    return null;
  }
}

/** Returns true if the country pmtiles file exists in OPFS */
export async function hasCountryFile(code) {
  try {
    const dir = await getOfflineDir();
    for (const name of [`${code}-detailed.pmtiles`, `${code}-basic.pmtiles`]) {
      try { await dir.getFileHandle(name); return true; } catch (_) {}
    }
    return false;
  } catch (_) {
    return false;
  }
}

/** Delete a country's pmtiles file from OPFS */
async function deleteCountryFile(code) {
  try {
    const dir = await getOfflineDir();
    for (const name of [`${code}-detailed.pmtiles`, `${code}-basic.pmtiles`]) {
      try { await dir.removeEntry(name); } catch (_) {}
    }
  } catch (_) {}
}

// ─── Single-file streaming download ──────────────────────────────────────────

/**
 * Download a country's PMTiles file as a single stream.
 * The source URL is /offline/{CC}.pmtiles — served from your own Vercel deployment.
 * 
 * @param {Object}   country   - entry from COUNTRIES
 * @param {Function} onProgress - ({ receivedMB, totalMB, speedMBps, etaSec }) callback
 * @param {Object}   abortRef  - { current: false } — set .current = true to cancel
 */
export async function downloadCountryPMTiles({ country, zoom = 15, onProgress, abortRef }) {
  // Files are named CZ-basic.pmtiles (zoom 15) or CZ-detailed.pmtiles (zoom 19)
  const suffix = zoom >= 19 ? 'detailed' : 'basic';
  const url = `/offline/${country.code}-${suffix}.pmtiles`;
  const controller = new AbortController();

  // Watch for external cancellation
  const cancelWatcher = setInterval(() => {
    if (abortRef?.current) controller.abort();
  }, 200);

  try {
    const res = await fetch(url, { signal: controller.signal });

    if (res.status === 404) {
      throw new Error(`${country.name} tiles not found on server. See offlineManager.js for how to generate them.`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentLength = parseInt(res.headers.get('Content-Length') || '0', 10);
    const totalMB = contentLength > 0 ? contentLength / 1024 / 1024 : country.sizeMB;

    // Stream the response body
    const reader    = res.body.getReader();
    const chunks    = [];
    let received    = 0;
    let startTime   = Date.now();
    let lastReport  = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;

      const now = Date.now();
      if (now - lastReport > 300) {  // report every 300ms
        const elapsedSec  = (now - startTime) / 1000;
        const speedMBps   = (received / 1024 / 1024) / Math.max(elapsedSec, 0.1);
        const receivedMB  = received / 1024 / 1024;
        const remaining   = totalMB - receivedMB;
        const etaSec      = speedMBps > 0 ? remaining / speedMBps : 0;
        onProgress?.({ receivedMB, totalMB, speedMBps, etaSec });
        lastReport = now;
      }
    }

    // Assemble and write to OPFS
    const total  = new Uint8Array(received);
    let offset   = 0;
    for (const chunk of chunks) { total.set(chunk, offset); offset += chunk.length; }

    const dir    = await getOfflineDir();
    const handle = await dir.getFileHandle(`${country.code}.pmtiles`, { create: true });
    const writable = await handle.createWritable();
    await writable.write(total.buffer);
    await writable.close();

    await setMeta(country.code, {
      downloadedAt: Date.now(),
      sizeMB: Math.round(received / 1024 / 1024),
      source: 'pmtiles',
      zoom,
      suffix,
    });

    onProgress?.({ receivedMB: totalMB, totalMB, speedMBps: 0, etaSec: 0 });
  } finally {
    clearInterval(cancelWatcher);
  }
}

// ─── POI download (Geoapify) ──────────────────────────────────────────────────

const POI_CATEGORIES_OFFLINE = [
  'catering.restaurant', 'catering.cafe', 'catering.bar',
  'accommodation.hotel',
  'healthcare.pharmacy', 'healthcare.hospital',
  'service.financial.atm', 'service.financial.bank',
  'commercial.supermarket', 'entertainment.museum', 'heritage',
  'public_transport.train', 'service.vehicle.fuel',
];

export async function downloadCountryPOIs({ country, geoapifyKey, onProgress, abortRef }) {
  if (!geoapifyKey) return;

  const [west, south, east, north] = country.bbox;
  const allPOIs = [];
  const seen    = new Set();
  const cats    = POI_CATEGORIES_OFFLINE;
  const BATCH   = 4;

  const gridSteps = country.sizeMB > 100 ? 3 : 2;
  const latStep   = (north - south) / gridSteps;
  const lngStep   = (east  - west)  / gridSteps;
  const cells     = [];

  for (let row = 0; row < gridSteps; row++) {
    for (let col = 0; col < gridSteps; col++) {
      cells.push({
        s: south + row * latStep, n: south + (row + 1) * latStep,
        w: west  + col * lngStep, e: west  + (col + 1) * lngStep,
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
      onProgress?.(doneReqs, totalReqs);
      await new Promise(r => setTimeout(r, 80));
    }
  }

  if (!abortRef?.current) {
    await setPOIs(country.code, allPOIs);
    const existing = await getMeta(country.code) || {};
    await setMeta(country.code, { ...existing, hasPOIs: true });
  }
}

// ─── Delete a country ─────────────────────────────────────────────────────────

export async function deleteCountry(country) {
  await Promise.all([
    deleteCountryFile(country.code),
    deletePOIs(country.code),
    deleteMeta(country.code),
  ]);
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