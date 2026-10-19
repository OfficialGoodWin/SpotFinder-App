// Optional z10 detail shards. Missing shards are empty; other errors reach callers.
export function poiDetailTile(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  const n = 2 ** 10;
  const x = Math.min(n - 1, Math.max(0, Math.floor((lon + 180) / 360 * n)));
  const radians = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
  const y = Math.min(n - 1, Math.max(0, Math.floor((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * n)));
  return { x, y };
}

export function createPoiDetailShardReader(fetchImpl = fetch) {
  const cache = new Map();
  return async function readPoiDetailShard(lon, lat, baseUrl = '/poi-details/10') {
    const tile = poiDetailTile(lon, lat);
    if (!tile) return null;
    const url = `${String(baseUrl).replace(/\/$/, '')}/${tile.x}/${tile.y}.json`;
    if (!cache.has(url)) {
      const request = (async () => {
        const response = await fetchImpl(url, { cache: 'force-cache', signal: AbortSignal.timeout?.(5000) });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`POI detail shard ${url} returned HTTP ${response.status}`);
        const body = await response.json();
        if (!body || !Array.isArray(body.items)) throw new Error(`Invalid POI detail shard: ${url}`);
        return body.items;
      })();
      cache.set(url, request);
      request.catch(() => { if (cache.get(url) === request) cache.delete(url); });
    }
    return cache.get(url);
  };
}

export const readPoiDetailShard = createPoiDetailShardReader();
