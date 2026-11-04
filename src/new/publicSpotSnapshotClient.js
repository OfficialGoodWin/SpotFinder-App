import { MAX_VIEW_REGIONS, REGION_DEGREES, SNAPSHOT_FORMAT, SUPPORTED_SNAPSHOT_FORMATS, decodeSnapshotSpot, regionsForBounds, regionForPoint, snapshotRegionDirectory, spotInsideBounds, validSnapshotSpot } from './publicSpotSnapshotFormat.js';

const VERSION = /^[a-f0-9]{20}$/;
const FILE = /^r\d+-\d+-[a-f0-9]{20}\.json$/;
const RETRIES = 1;
const RETRY_DELAY_MS = 150;
const MANIFEST_TTL_MS = 5000;
const REVOCATION_TTL_MS = 10000;
const MAX_REGION_CACHE = 128;
const MAX_REGION_JSON_CHARS = 5000000;
const MAX_CACHE_JSON_CHARS = 20000000;

async function hashJson(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 20);
}

async function requestJson(fetchJson, url, options) {
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetchJson(url, { ...options, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`Snapshot HTTP ${response.status || 'error'}`);
      return await response.json();
    } catch (error) {
      if (attempt === RETRIES) throw error;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

async function validateManifest(manifest) {
  if (!manifest || !SUPPORTED_SNAPSHOT_FORMATS.includes(manifest.format) || manifest.regionDegrees !== REGION_DEGREES
    || !VERSION.test(manifest.revision) || manifest.version !== manifest.revision
    || typeof manifest.publishedAt !== 'string' || Number.isNaN(Date.parse(manifest.publishedAt))
    || !manifest.regions || Array.isArray(manifest.regions) || typeof manifest.regions !== 'object'
    || Object.entries(manifest.regions).some(([key, filename]) => !FILE.test(filename) || !filename.startsWith(`${key}-`)))
    throw new Error('Invalid snapshot manifest');
  if (await hashJson(manifest.regions) !== manifest.revision) throw new Error('Corrupt snapshot manifest');
  return manifest;
}

function regionDistanceFromViewport(key, bounds) {
  const match = /^r(\d+)-(\d+)$/.exec(key);
  if (!match) return Infinity;
  const lat = Number(match[1]) * REGION_DEGREES - 90 + REGION_DEGREES / 2;
  const lng = Number(match[2]) * REGION_DEGREES - 180 + REGION_DEGREES / 2;
  const centerLng = (bounds.west + bounds.east) / 2;
  const lngDelta = Math.abs(lng - centerLng);
  const wrappedLngDelta = Math.min(lngDelta, 360 - lngDelta);
  const latDelta = Math.abs(lat - (bounds.south + bounds.north) / 2);
  return wrappedLngDelta * wrappedLngDelta + latDelta * latDelta;
}

function coveredRegionsForViewport(viewportKeys, bounds, manifestRegions) {
  const covered = viewportKeys.filter(key => manifestRegions[key]);
  if (covered.length <= MAX_VIEW_REGIONS) return covered;
  return covered.sort((a, b) => regionDistanceFromViewport(a, bounds) - regionDistanceFromViewport(b, bounds)
    || a.localeCompare(b)).slice(0, MAX_VIEW_REGIONS);
}

export function createPublicSpotSnapshotReader({ fetchJson = fetch, basePath = '/spot-snapshots', now = Date.now,
  revocationSource = null } = {}) {
  const regions = new Map();
  let cachedChars = 0;
  const trimRegions = () => {
    while (regions.size > 1 && (regions.size > MAX_REGION_CACHE || cachedChars > MAX_CACHE_JSON_CHARS)) {
      const oldest = regions.keys().next().value;
      cachedChars -= regions.get(oldest).chars;
      regions.delete(oldest);
    }
  };
  let manifestPending = null;
  let manifestCache = null;
  let manifestAt = 0;
  let revocationPending = null;
  let revocationAt = 0;
  let lastRevocations = null;
  const revokedEver = new Set();
  let activeRevocationSource = null;
  const getRevocations = async (force = false) => {
    if (revocationSource) {
      const source = await revocationSource();
      activeRevocationSource = source;
      const current = await source.current();
      for (const id of current) revokedEver.add(id);
      return { format: 1, revoked: [...current] };
    }
    if (!force && lastRevocations && now() - revocationAt < REVOCATION_TTL_MS) return lastRevocations;
    if (!revocationPending) revocationPending = requestJson(fetchJson, '/api/spot-snapshot-revocations', { cache: 'no-store' })
      .then(data => {
        if (data?.format !== 1 || !Array.isArray(data.revoked) || data.revoked.length > 500
          || data.revoked.some(id => typeof id !== 'string' || !id || id.length > 1500 || id.includes('/')))
          throw new Error('Invalid revocation feed');
        for (const id of data.revoked) revokedEver.add(id);
        lastRevocations = data;
        revocationAt = now();
        return data;
      }).finally(() => { revocationPending = null; });
    return revocationPending;
  };
  const getManifest = async () => {
    if (manifestCache && now() - manifestAt < MANIFEST_TTL_MS) return manifestCache;
    if (!manifestPending) manifestPending = requestJson(fetchJson, `${basePath}/manifest.json`, { cache: 'no-store' })
      .then(validateManifest)
      .then(manifest => {
        if (manifestCache && manifest.revision !== manifestCache.revision
          && Date.parse(manifest.publishedAt) <= Date.parse(manifestCache.publishedAt))
          throw new Error('Stale snapshot manifest');
        manifestCache = manifest; manifestAt = now(); return manifest;
      })
      .finally(() => { manifestPending = null; });
    return manifestPending;
  };
  const readPublicSpotSnapshot = async (bounds, maxCount = 300) => {
    const viewportKeys = regionsForBounds(bounds);
    if (!viewportKeys) throw new Error('Invalid viewport bounds');
    await getRevocations();
    const manifest = await getManifest();
    const keys = coveredRegionsForViewport(viewportKeys, bounds, manifest.regions);
    const directory = snapshotRegionDirectory(manifest.format);
    const snapshots = await Promise.all(keys.map(async key => {
      const filename = manifest.regions[key];
      const url = `${basePath}/${directory}/${filename}`;
      if (!regions.has(url)) {
        const entry = { chars: 0, promise: null };
        entry.promise = requestJson(fetchJson, url, { cache: 'force-cache' }).then(async data => {
          const serializedChars = JSON.stringify(data).length;
          if (data.format !== manifest.format || data.region !== key || !Array.isArray(data.spots)
            || serializedChars > MAX_REGION_JSON_CHARS || data.spots.length > 10000
            || await hashJson(data) !== filename.slice(key.length + 1, -5)) throw new Error('Invalid snapshot region');
          let spots;
          try {
            spots = manifest.format === SNAPSHOT_FORMAT ? data.spots.map(decodeSnapshotSpot) : data.spots;
          } catch { throw new Error('Invalid snapshot region'); }
          if (spots.some(spot => !validSnapshotSpot(spot)
            || regionForPoint(spot.lat, spot.lng) !== key)) throw new Error('Invalid snapshot region');
          if (regions.get(url) === entry) {
            entry.chars = serializedChars;
            cachedChars += serializedChars;
            trimRegions();
          }
          return spots;
        }).catch(error => { if (regions.get(url) === entry) regions.delete(url); throw error; });
        regions.set(url, entry);
        trimRegions();
      } else {
        const entry = regions.get(url);
        regions.delete(url);
        regions.set(url, entry);
      }
      return regions.get(url).promise;
    }));
    const unique = new Map();
    snapshots.flat().filter(spot => !revokedEver.has(spot.id)
      && !activeRevocationSource?.isRevoked(spot.id) && spotInsideBounds(spot, bounds))
      .forEach(spot => unique.set(spot.id, spot));
    const safeCount = Math.min(500, Math.max(1, Math.floor(Number(maxCount) || 300)));
    return [...unique.values()].sort((a, b) => b.created_date.localeCompare(a.created_date)).slice(0, safeCount)
      .map(spot => ({ ...spot, image_url: spot.image_url
        ? new URL(spot.image_url, globalThis.location?.origin || 'https://spotfinder.invalid').href : null }));
  };
  readPublicSpotSnapshot.isRevoked = async id => {
    await getRevocations(true);
    return revokedEver.has(id);
  };
  return readPublicSpotSnapshot;
}

export const readPublicSpotSnapshot = createPublicSpotSnapshotReader({
  revocationSource: () => import('./publicSpotRevocationListener.js')
    .then(module => module.getPublicSpotRevocationListener()),
});

export async function readSnapshotSpots(bounds, maxCount = 300, readSnapshot = readPublicSpotSnapshot) {
  return (await readSnapshot(bounds, maxCount)).map(spot => ({ ...spot, _public_snapshot: true }));
}

export async function loadFullSnapshotSpot(spot, getFullSpot, isRevoked = readPublicSpotSnapshot.isRevoked) {
  if (!spot?._public_snapshot) return spot;
  if (await isRevoked(spot.id)) return null;
  return getFullSpot(spot.id);
}
