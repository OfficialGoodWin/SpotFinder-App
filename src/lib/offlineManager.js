/**
 * offlineManager.js — PMTiles + OPFS offline map system.
 * One file per country, streamed in, full zoom 0-19.
 */
import { CapacitorHttp } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';
import { setMeta, deleteMeta, getMeta, setPOIs, deletePOIs } from './offlineStorage.js';

export const COUNTRIES = [
  // Central Europe — Czech Republic split into 14 regions (original single file was 1.7 GB, too large to proxy)
  { code:'CZ-PHA', name:'Praha',              flag:'🇨🇿', bbox:[14.22,49.94,14.71,50.18], sizeMB:120,  parent:'CZ' },
  { code:'CZ-STC', name:'Středočeský kraj',   flag:'🇨🇿', bbox:[13.55,49.61,15.28,50.75], sizeMB:160,  parent:'CZ' },
  { code:'CZ-JHC', name:'Jihočeský kraj',     flag:'🇨🇿', bbox:[13.37,48.55,15.26,49.62], sizeMB:130,  parent:'CZ' },
  { code:'CZ-PLK', name:'Plzeňský kraj',      flag:'🇨🇿', bbox:[12.09,49.17,13.90,50.02], sizeMB:110,  parent:'CZ' },
  { code:'CZ-KVK', name:'Karlovarský kraj',   flag:'🇨🇿', bbox:[12.09,49.94,13.29,50.66], sizeMB:60,   parent:'CZ' },
  { code:'CZ-ULK', name:'Ústecký kraj',       flag:'🇨🇿', bbox:[12.84,50.16,14.65,51.06], sizeMB:90,   parent:'CZ' },
  { code:'CZ-LBK', name:'Liberecký kraj',     flag:'🇨🇿', bbox:[14.62,50.56,15.44,51.06], sizeMB:55,   parent:'CZ' },
  { code:'CZ-HKK', name:'Královéhradecký kraj',flag:'🇨🇿', bbox:[15.28,50.18,16.50,50.78], sizeMB:80,  parent:'CZ' },
  { code:'CZ-PAK', name:'Pardubický kraj',    flag:'🇨🇿', bbox:[15.50,49.61,16.90,50.33], sizeMB:75,   parent:'CZ' },
  { code:'CZ-VYS', name:'Kraj Vysočina',      flag:'🇨🇿', bbox:[15.10,49.17,16.61,49.94], sizeMB:90,   parent:'CZ' },
  { code:'CZ-JHM', name:'Jihomoravský kraj',  flag:'🇨🇿', bbox:[15.76,48.55,17.19,49.62], sizeMB:130,  parent:'CZ' },
  { code:'CZ-OLK', name:'Olomoucký kraj',     flag:'🇨🇿', bbox:[16.61,49.44,17.87,50.22], sizeMB:80,   parent:'CZ' },
  { code:'CZ-ZLK', name:'Zlínský kraj',       flag:'🇨🇿', bbox:[17.19,48.94,18.37,49.62], sizeMB:65,   parent:'CZ' },
  { code:'CZ-MSK', name:'Moravskoslezský kraj',flag:'🇨🇿', bbox:[17.58,49.44,18.87,50.22], sizeMB:110,  parent:'CZ' },
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

// ── PMTiles download ────────────────────────────────────────────────────────────────────────────────────

// 50 MB per Range chunk — fits comfortably in Android WebView memory.
// Each chunk is written to OPFS and freed before the next fetch.
const CHUNK_SIZE = 5 * 1024 * 1024;

function getDownloadUrl(countryCode) {
  // Capacitor Android serves the app from https://localhost (or capacitor://localhost).
  // Any relative /api/... fetch goes through Capacitor's WebView asset loader which
  // returns index.html for unknown paths. Must use the absolute Vercel URL instead.
  const needsAbsolute = typeof window !== 'undefined' && !import.meta.env.DEV && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'file:'
  );
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const prodUrl = host.includes('feature') ? 'https://spot-finder-app-git-feature-officialgoodwins-projects.vercel.app' : 'https://spot-finder-app.vercel.app';
  const base = needsAbsolute ? prodUrl : '';
  // Use /github-releases/ rewrite — bypasses the edge function which has a 10s timeout
  return `${base}/api/download?country=${countryCode}`;
}

export async function downloadCountryPMTiles({ country, onProgress, abortRef }) {
  const url = getDownloadUrl(country.code);

  // Step 1: HEAD to get total file size so we know how many chunks to fetch
  let totalBytes = country.sizeMB * 1024 * 1024; // fallback estimate
  try {
    const head = await fetch(url, { method: 'HEAD' });
    const cl = head.headers.get('Content-Length');
    if (cl) totalBytes = parseInt(cl, 10);
  } catch (_) { /* use estimate */ }
  const totalMB = totalBytes / 1048576;

  // Step 2: Open OPFS writable — delete any partial file from a previous attempt
  const dir = await getOfflineDir();
  try { await dir.removeEntry(`${country.code}.pmtiles`); } catch (_) {}
  const handle   = await dir.getFileHandle(`${country.code}.pmtiles`, { create: true });
  const writable = await handle.createWritable();

  let received = 0;
  const t0 = Date.now();

  try {
    // Step 3: Chunked Range requests
    // Why chunked instead of one big fetch?
    //   - Android WebView buffers the ENTIRE response body in RAM before resolving .arrayBuffer()
    //   - A 1.7 GB file (Czech Republic) OOM-crashes the app immediately
    //   - 50 MB chunks keep peak memory under ~60 MB regardless of country size
    //   - The Vercel edge function now forwards the Range header to GitHub/Azure (which supports it)
    for (let start = 0; start < totalBytes; start += CHUNK_SIZE) {
      if (abortRef?.current) {
        await writable.abort();
        try { await dir.removeEntry(`${country.code}.pmtiles`); } catch (_) {}
        throw new DOMException('Aborted', 'AbortError');
      }

      const end = Math.min(start + CHUNK_SIZE - 1, totalBytes - 1);
      let res;
if (Capacitor.isNativePlatform()) {
  const r = await CapacitorHttp.request({
    method: 'GET',
    url,
    headers: { Range: `bytes=${start}-${end}` },
    responseType: 'arraybuffer',
  });
  // CapacitorHttp returns base64 for arraybuffer — decode it
  const binary = atob(r.data);
  const chunk = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) chunk[i] = binary.charCodeAt(i);
  await writable.write(chunk.buffer);
  received += chunk.byteLength;
  // report progress then continue (skip the res.arrayBuffer() below)
  const elapsed = Math.max((Date.now() - t0) / 1000, 0.1);
  const recvMB = received / 1048576;
  const speedMBps = recvMB / elapsed;
  const etaSec = speedMBps > 0 ? (totalMB - recvMB) / speedMBps : 0;
  onProgress?.({ receivedMB: recvMB, totalMB, speedMBps, etaSec, pct: Math.min(99, Math.round(received / totalBytes * 100)) });
  continue;
} else {
  res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
}

      // 206 Partial Content = server honoured Range. 200 = server ignored Range (still ok, just less efficient).
      if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);

      const chunk = await res.arrayBuffer(); // max 50 MB — safe on Android
      await writable.write(chunk);
      received += chunk.byteLength;

      const elapsed   = Math.max((Date.now() - t0) / 1000, 0.1);
      const recvMB    = received / 1048576;
      const speedMBps = recvMB / elapsed;
      const etaSec    = speedMBps > 0 ? (totalMB - recvMB) / speedMBps : 0;
      onProgress?.({
        receivedMB: recvMB,
        totalMB,
        speedMBps,
        etaSec,
        pct: Math.min(99, Math.round(received / totalBytes * 100)),
      });
    }

    await writable.close();

    const sizeMB = Math.round(received / 1048576);
    await setMeta(country.code, { downloadedAt: Date.now(), sizeMB, source: 'pmtiles' });
    onProgress?.({ receivedMB: totalMB, totalMB, speedMBps: 0, etaSec: 0, pct: 100 });

  } catch (err) {
    try { await writable.abort(); } catch (_) {}
    try { await dir.removeEntry(`${country.code}.pmtiles`); } catch (_) {}
    throw err;
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
    if (abortRef?.current === true) return;
    for (let i = 0; i < POI_CATS.length; i += BATCH) {
      if (abortRef?.current === true) return;
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
  if (abortRef?.current !== true) {
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