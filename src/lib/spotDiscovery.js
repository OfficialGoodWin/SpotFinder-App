const EARTH_RADIUS_KM = 6371.0088;

export function normalizeLatLng(value) {
  const rawLat = Array.isArray(value) ? value[0] : value?.lat;
  const rawLng = Array.isArray(value) ? value[1] : value?.lng ?? value?.lon;
  if (rawLat == null || rawLng == null || String(rawLat).trim() === '' || String(rawLng).trim() === '') return null;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180
    ? [lat, lng]
    : null;
}

export function haversineKm(origin, destination) {
  const from = normalizeLatLng(origin);
  const to = normalizeLatLng(destination);
  if (!from || !to) return Infinity;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(to[0] - from[0]);
  const dLng = toRad(to[1] - from[1]);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(from[0])) * Math.cos(toRad(to[0])) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}

export function nearbyBounds(origin, radiusKm) {
  const normalized = normalizeLatLng(origin);
  const radius = Number(radiusKm);
  if (!normalized || !Number.isFinite(radius) || radius < 0) return null;
  const [lat, lng] = normalized;
  // A generous rectangle selects candidates; Haversine applies the exact circle.
  const latDelta = radius / 110.5;
  const lngDelta = Math.min(180, radius / (111.32 * Math.max(0.001, Math.cos(lat * Math.PI / 180))));
  // Coarse outward rounding avoids sending an exact GPS-derived rectangle to Firestore.
  const floor = value => Math.floor(value * 100) / 100;
  const ceil = value => Math.ceil(value * 100) / 100;
  return {
    south: Math.max(-90, floor(lat - latDelta)), north: Math.min(90, ceil(lat + latDelta)),
    west: floor(lng - lngDelta), east: ceil(lng + lngDelta),
  };
}

export function getSpotRating(spot) {
  const rating = Number(spot?.rating);
  const count = Number(spot?.rating_count);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5 || !Number.isInteger(count) || count < 1) return null;
  return rating;
}

export function createSpotSelection(spot) {
  const position = normalizeLatLng(spot);
  return spot?.id && position ? { id: spot.id, spot, position } : null;
}

const timestamp = (spot) => {
  const value = spot?.created_date || spot?.created_at;
  const parsed = value?.toDate?.() || (value ? new Date(value) : null);
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
};

export function sortSpotCollection(spots, sort = 'newest', { relationFirst = false, getTitle = spot => spot?.title || spot?.name || '' } = {}) {
  const itemTime = spot => {
    if (!relationFirst) return timestamp(spot);
    return timestamp({ ...spot, created_date: spot?._relation_created_date || spot?.created_date });
  };
  return [...(spots || [])].sort((a, b) => {
    if (sort === 'oldest') return itemTime(a) - itemTime(b);
    if (sort === 'rating') return (getSpotRating(b) ?? -1) - (getSpotRating(a) ?? -1);
    if (sort === 'liked') return Number(b?.likes_count || 0) - Number(a?.likes_count || 0);
    if (sort === 'alphabetical') return String(getTitle(a)).localeCompare(String(getTitle(b)));
    return itemTime(b) - itemTime(a);
  });
}

export function filterAndSortNearbySpots(spots, {
  origin,
  maxDistance = Infinity,
  minRating = 0,
  sort = 'distance',
} = {}) {
  const normalizedOrigin = normalizeLatLng(origin);
  const radius = Number(maxDistance);
  const minimum = Math.max(0, Number(minRating) || 0);
  const unique = new Map();

  for (const spot of spots || []) {
    const coordinates = normalizeLatLng(spot);
    if (!coordinates) continue;
    const key = spot.id || `${coordinates[0].toFixed(6)}:${coordinates[1].toFixed(6)}`;
    if (unique.has(key)) continue;
    const distance = normalizedOrigin ? haversineKm(normalizedOrigin, coordinates) : null;
    const rating = getSpotRating(spot);
    if (Number.isFinite(radius) && (!Number.isFinite(distance) || distance > radius + 0.001)) continue;
    if (minimum > 0 && (rating === null || rating < minimum)) continue;
    unique.set(key, { ...spot, _km: distance, _rating: rating });
  }

  return [...unique.values()].sort((a, b) => {
    if (sort === 'rating') return (b._rating ?? -1) - (a._rating ?? -1) || (a._km ?? Infinity) - (b._km ?? Infinity) || String(a.id || '').localeCompare(String(b.id || ''));
    if (sort === 'newest') return timestamp(b) - timestamp(a) || (a._km ?? Infinity) - (b._km ?? Infinity) || String(a.id || '').localeCompare(String(b.id || ''));
    return (a._km ?? Infinity) - (b._km ?? Infinity) || String(a.id || '').localeCompare(String(b.id || ''));
  });
}
