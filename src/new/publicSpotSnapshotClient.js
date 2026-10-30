import { MAX_VIEW_REGIONS, SNAPSHOT_FORMAT, regionsForBounds, regionForPoint, spotInsideBounds, validSnapshotSpot } from './publicSpotSnapshotFormat.js';

const VERSION = /^[a-f0-9]{20}$/;
const FILE = /^r\d+-\d+-[a-f0-9]{20}\.json$/;

export function createPublicSpotSnapshotReader({ fetchJson = fetch, basePath = '/spot-snapshots' } = {}) {
  const pending = new Map();
  let manifestPending = null;
  return async function readPublicSpotSnapshot(bounds, maxCount = 300) {
    const keys = regionsForBounds(bounds);
    if (!keys || keys.length > MAX_VIEW_REGIONS) throw new Error('Viewport exceeds snapshot coverage');
    if (!manifestPending) manifestPending = fetchJson(`${basePath}/manifest.json`, { cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('Snapshot manifest unavailable'); return response.json(); })
      .finally(() => { manifestPending = null; });
    const manifest = await manifestPending;
    if (manifest.format !== SNAPSHOT_FORMAT || !VERSION.test(manifest.version) || typeof manifest.regions !== 'object' || !manifest.regions) throw new Error('Invalid snapshot manifest');
    const snapshots = await Promise.all(keys.filter(key => manifest.regions[key]).map(async key => {
      const filename = manifest.regions[key];
      if (!FILE.test(filename) || !filename.startsWith(`${key}-`)) throw new Error('Invalid snapshot region name');
      const url = `${basePath}/v1/${manifest.version}/${filename}`;
      if (!pending.has(url)) {
        pending.set(url, fetchJson(url, { cache: 'force-cache' }).then(async response => {
          if (!response.ok) throw new Error('Snapshot region unavailable');
          const data = await response.json();
          if (data.format !== SNAPSHOT_FORMAT || data.region !== key || !Array.isArray(data.spots)
            || !data.spots.every(spot => validSnapshotSpot(spot) && regionForPoint(spot.lat, spot.lng) === key)) throw new Error('Invalid snapshot region');
          return data.spots;
        }).catch(error => { pending.delete(url); throw error; }));
      }
      return pending.get(url);
    }));
    const unique = new Map();
    snapshots.flat().filter(spot => spotInsideBounds(spot, bounds)).forEach(spot => unique.set(spot.id, spot));
    return [...unique.values()].sort((a, b) => b.created_date.localeCompare(a.created_date)).slice(0, maxCount)
      .map(spot => ({ ...spot, image_url: spot.image_url
        ? new URL(spot.image_url, globalThis.location?.origin || 'https://spotfinder.invalid').href : null }));
  };
}

export const readPublicSpotSnapshot = createPublicSpotSnapshotReader();

export async function readSnapshotOrFirestore(bounds, maxCount, readSnapshot, readFirestore) {
  try {
    return (await readSnapshot(bounds, maxCount)).map(spot => ({ ...spot, _public_snapshot: true }));
  } catch {
    return readFirestore(bounds, maxCount);
  }
}

export async function loadFullSnapshotSpot(spot, getFullSpot) {
  return spot?._public_snapshot ? getFullSpot(spot.id) : spot;
}
