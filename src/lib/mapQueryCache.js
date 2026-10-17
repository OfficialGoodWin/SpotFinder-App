import { haversineKm } from './spotDiscovery.js';

export function cachedViewportRows(cache, view, now = Date.now()) {
  if (!cache || now - cache.at >= 120000 || cache.rows.length >= 500 ||
      view.south < cache.bounds.south || view.north > cache.bounds.north ||
      view.west < cache.bounds.west || view.east > cache.bounds.east) return null;
  return filterViewportRows(cache.rows, view);
}

export function filterViewportRows(rows, view) {
  return rows.filter(spot => spot.lat >= view.south && spot.lat <= view.north &&
    [spot.lng, spot.lng + 360, spot.lng - 360].some(lng => lng >= view.west && lng <= view.east));
}

export function canReuseNearby(cache, origin, radius, now = Date.now()) {
  if (!cache?.result.complete || now - cache.at >= 120000) return false;
  const displacement = haversineKm(origin, cache.origin);
  if (Number.isFinite(radius) && Number.isFinite(cache.radius)) return displacement + radius <= cache.radius;
  return !Number.isFinite(radius) && !Number.isFinite(cache.radius) && displacement < 0.001;
}
