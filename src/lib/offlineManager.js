/**
 * offlineManager.js — PMTiles + OPFS offline map system.
 * One file per country, streamed in, full zoom 0-19.
 */

import { setMeta, deleteMeta, getMeta, setPOIs, deletePOIs } from './offlineStorage.js';

export const COUNTRIES = [
  // Central Europe
  { code:'CZ', name:'Czech Republic',  flag:'🇨🇿', bbox:[12.09,48.55,18.87,51.06], sizeMB:210 },
  { code:'SK', name:'Slovakia',         flag:'🇸🇰', bbox:[16.83,47.73,22.57,49.61], sizeMB:140 },
  { code:'AT', name:'Austria',          flag:'🇦🇹', bbox:[9.53,46.37,17.16,49.02],  sizeMB:190 },
  { code:'HU', name:'Hungary',          flag:'🇭🇺', bbox:[16.11,45.74,22.90,48.59], sizeMB:175 },
  { code:'PL', name:'Poland',           flag:'🇵🇱', bbox:[14.12,49.00,24.15,54.90], sizeMB:520 },
  { code:'DE', name:'Germany',          flag:'🇩🇪', bbox:[5.87,47.27,15.04,55.06],  sizeMB:820 },
  { code:'CH', name:'Switzerland',      flag:'🇨🇭', bbox:[5.96,45.82,10.49,47.81],  sizeMB:140 },
  // Western Europe
  { code:'FR', name:'France',           flag:'🇫🇷', bbox:[-5.14,41.33,9.56,51.09],  sizeMB:980 },
  { code:'ES', name:'Spain',            flag:'🇪🇸', bbox:[-9.30,35.95,4.33,43.79],  sizeMB:760 },
  { code:'PT', name:'Portugal',         flag:'🇵🇹', bbox:[-9.50,36.96,-6.19,42.15], sizeMB:160 },
  { code:'NL', name:'Netherlands',      flag:'🇳🇱', bbox:[3.31,50.75,7.09,53.55],   sizeMB:190 },
  { code:'BE', name:'Belgium',          flag:'🇧🇪', bbox:[2.54,49.50,6.40,51.50],   sizeMB:130 },
  { code:'LU', name:'Luxembourg',       flag:'🇱🇺', bbox:[5.73,49.44,6.53,50.19],   sizeMB:18  },
  { code:'GB', name:'United Kingdom',   flag:'🇬🇧', bbox:[-8.18,49.87,1.77,60.93],  sizeMB:870 },
  { code:'IE', name:'Ireland',          flag:'🇮🇪', bbox:[-10.48,51.39,-5.93,55.44],sizeMB:120 },
  // Southern Europe
  { code:'IT', name:'Italy',            flag:'🇮🇹', bbox:[6.63,35.49,18.52,47.09],  sizeMB:680 },
  { code:'HR', name:'Croatia',          flag:'🇭🇷', bbox:[13.49,42.38,19.45,46.55], sizeMB:95  },
  { code:'SI', name:'Slovenia',         flag:'🇸🇮', bbox:[13.38,45.42,16.61,46.88], sizeMB:40  },
  { code:'GR', name:'Greece',           flag:'🇬🇷', bbox:[19.37,34.80,28.24,41.75], sizeMB:220 },
  { code:'RS', name:'Serbia',           flag:'🇷🇸', bbox:[18.82,42.23,23.01,46.19], sizeMB:110 },
  { code:'BA', name:'Bosnia',           flag:'🇧🇦', bbox:[15.72,42.55,19.62,45.28], sizeMB:65  },
  { code:'MK', name:'North Macedonia',  flag:'🇲🇰', bbox:[20.45,40.85,23.03,42.37], sizeMB:40  },
  { code:'AL', name:'Albania',          flag:'🇦🇱', bbox:[19.27,39.62,21.07,42.67], sizeMB:38  },
  { code:'ME', name:'Montenegro',       flag:'🇲🇪', bbox:[18.45,41.85,20.36,43.57], sizeMB:28  },
  { code:'MT', name:'Malta',            flag:'🇲🇹', bbox:[14.18,35.79,14.58,36.08], sizeMB:8   },
  // Northern Europe
  { code:'SE', name:'Sweden',           flag:'🇸🇪', bbox:[11.11,55.34,24.17,69.06], sizeMB:520 },
  { code:'NO', name:'Norway',           flag:'🇳🇴', bbox:[4.09,57.96,31.29,71.19],  sizeMB:450 },
  { code:'DK', name:'Denmark',          flag:'🇩🇰', bbox:[8.07,54.55,15.20,57.76],  sizeMB:120 },
  { code:'FI', name:'Finland',          flag:'🇫🇮', bbox:[20.55,59.80,31.59,70.09], sizeMB:340 },
  { code:'EE', name:'Estonia',          flag:'🇪🇪', bbox:[21.77,57.51,28.21,59.68], sizeMB:65  },
  { code:'LV', name:'Latvia',           flag:'🇱🇻', bbox:[20.97,55.67,28.24,57.97], sizeMB:75  },
  { code:'LT', name:'Lithuania',        flag:'🇱🇹', bbox:[20.94,53.90,26.84,56.46], sizeMB:90  },
  { code:'IS', name:'Iceland',          flag:'🇮🇸', bbox:[-24.54,63.39,-13.50,66.55],sizeMB:75 },
  // Eastern Europe
  { code:'RO', name:'Romania',          flag:'🇷🇴', bbox:[20.26,43.62,29.74,48.27], sizeMB:390 },
  { code:'BG', name:'Bulgaria',         flag:'🇧🇬', bbox:[22.36,41.23,28.61,44.22], sizeMB:170 },
  { code:'UA', name:'Ukraine',          flag:'🇺🇦', bbox:[22.14,44.36,40.23,52.38], sizeMB:760 },
  { code:'MD', name:'Moldova',          flag:'🇲🇩', bbox:[26.62,45.47,30.13,48.49], sizeMB:55  },
  { code:'BY', name:'Belarus',          flag:'🇧🇾', bbox:[23.18,51.26,32.78,56.17], sizeMB:250 },
  // Microstates
  { code:'AD', name:'Andorra',          flag:'🇦🇩', bbox:[1.41,42.43,1.79,42.66],   sizeMB:4   },
  { code:'MC', name:'Monaco',           flag:'🇲🇨', bbox:[7.38,43.72,7.44,43.76],   sizeMB:1   },
  { code:'SM', name:'San Marino',       flag:'🇸🇲', bbox:[12.40,43.89,12.52,43.99], sizeMB:2   },
  { code:'LI', name:'Liechtenstein',    flag:'🇱🇮', bbox:[9.47,47.05,9.64,47.27],   sizeMB:2   },
];

// ── OPFS ─────────────────────────────────────────────────────────────────────

async function getOfflineDir() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('pmtiles', { create: true });
}

export async function getCountryFile(code) {
  try {
    const dir    = await getOfflineDir();
    const handle = await dir.getFileHandle(`${code}.pmtiles`);
    return handle.getFile();
  } catch (_) { return null; }
}

export async function hasCountryFile(code) {
  try {
    const dir = await getOfflineDir();
    await dir.getFileHandle(`${code}.pmtiles`);
    return true;
  } catch (_) { return false; }
}

async function deleteCountryFile(code) {
  try {
    const dir = await getOfflineDir();
    await dir.removeEntry(`${code}.pmtiles`);
  } catch (_) {}
}

// ── PMTiles streaming download ────────────────────────────────────────────────

export async function downloadCountryPMTiles({ country, onProgress, abortRef }) {
  const url  = `https://github.com/OfficialGoodWin/SpotFinder-App/releases/latest/download/${country.code}.pmtiles`;
  const ctrl = new AbortController();
  const cancelWatch = setInterval(() => { if (abortRef?.current) ctrl.abort(); }, 200);

  try {
    const res = await fetch(url, { signal: ctrl.signal });

    if (res.status === 404 || !res.ok) {
      throw new Error(
        `PMTiles file not found for ${country.name}. ` +
        `Run: pmtiles extract https://build.protomaps.com/20260319.pmtiles ` +
        `public/offline/${country.code}.pmtiles --bbox=${country.bbox.join(',')} --maxzoom=16`
      );
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentLength = parseInt(res.headers.get('Content-Length') || '0', 10);
    const totalMB = contentLength > 0 ? contentLength / 1024 / 1024 : country.sizeMB;

    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    const t0 = Date.now();
    let lastReport = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      const now = Date.now();
      if (now - lastReport > 250) {
        lastReport = now;
        const elapsed   = Math.max((now - t0) / 1000, 0.1);
        const recvMB    = received / 1024 / 1024;
        const speedMBps = recvMB / elapsed;
        const etaSec    = speedMBps > 0 ? (totalMB - recvMB) / speedMBps : 0;
        onProgress?.({ receivedMB: recvMB, totalMB, speedMBps, etaSec,
                       pct: Math.min(99, Math.round(recvMB / totalMB * 100)) });
      }
    }

    // Assemble
    const buf = new Uint8Array(received);
    let off = 0;
    for (const chunk of chunks) { buf.set(chunk, off); off += chunk.length; }

    // Write to OPFS
    const dir      = await getOfflineDir();
    const handle   = await dir.getFileHandle(`${country.code}.pmtiles`, { create: true });
    const writable = await handle.createWritable();
    await writable.write(buf.buffer);
    await writable.close();

    await setMeta(country.code, {
      downloadedAt: Date.now(),
      sizeMB: Math.round(received / 1024 / 1024),
      source: 'pmtiles',
    });

    onProgress?.({ receivedMB: totalMB, totalMB, speedMBps: 0, etaSec: 0, pct: 100 });

  } finally {
    clearInterval(cancelWatch);
  }
}

// ── POI download ──────────────────────────────────────────────────────────────

const POI_CATS = [
  'catering.restaurant','catering.cafe','catering.bar','catering.fast_food',
  'accommodation.hotel','accommodation.hostel',
  'healthcare.pharmacy','healthcare.hospital','healthcare.dentist',
  'service.financial.atm','service.financial.bank',
  'commercial.supermarket','commercial.food_and_drink',
  'entertainment.museum','heritage',
  'public_transport.train','service.vehicle.fuel','service.vehicle.charging_station',
  'parking',
];

export async function downloadCountryPOIs({ country, geoapifyKey, onProgress, abortRef }) {
  if (!geoapifyKey) return;
  const [west, south, east, north] = country.bbox;
  const allPOIs = [], seen = new Set();
  const BATCH = 4;
  const grid  = country.sizeMB > 500 ? 4 : country.sizeMB > 200 ? 3 : 2;
  const latStep = (north - south) / grid;
  const lngStep = (east - west) / grid;
  const cells = [];
  for (let r = 0; r < grid; r++)
    for (let c = 0; c < grid; c++)
      cells.push({ s:south+r*latStep, n:south+(r+1)*latStep, w:west+c*lngStep, e:west+(c+1)*lngStep });

  const totalReqs = Math.ceil(POI_CATS.length / BATCH) * cells.length;
  let doneReqs = 0;

  for (const cell of cells) {
    if (abortRef?.current) return;
    for (let i = 0; i < POI_CATS.length; i += BATCH) {
      if (abortRef?.current) return;
      const batch = POI_CATS.slice(i, i + BATCH).join(',');
      const url = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(batch)}&filter=rect:${cell.w},${cell.s},${cell.e},${cell.n}&limit=500&apiKey=${geoapifyKey}`;
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
            allPOIs.push({ id, lat, lon, name:p.name||'', address:p.address_line2||p.formatted||'',
                           categories:p.categories||[], phone:p.contact?.phone, website:p.website });
          }
        }
      } catch (_) {}
      doneReqs++;
      onProgress?.({ poi:true, done:doneReqs, total:totalReqs });
      await new Promise(r => setTimeout(r, 60));
    }
  }
  if (!abortRef?.current) {
    await setPOIs(country.code, allPOIs);
    const existing = await getMeta(country.code) || {};
    await setMeta(country.code, { ...existing, hasPOIs:true, poiCount:allPOIs.length });
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteCountry(country) {
  await Promise.all([deleteCountryFile(country.code), deletePOIs(country.code), deleteMeta(country.code)]);
}

export async function scrubInvalidMeta() {
  const { getAllMeta } = await import('./offlineStorage.js');
  const all = await getAllMeta();
  for (const [code, meta] of Object.entries(all)) {
    if (!meta.sizeMB || meta.sizeMB < 1) await deleteMeta(code);
  }
}

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