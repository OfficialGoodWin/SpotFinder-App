const EARTH_RADIUS_KM = 6371.0088;

export function normalizeLatLng(value) {
  const lat = Number(Array.isArray(value) ? value[0] : value?.lat);
  const lng = Number(Array.isArray(value) ? value[1] : value?.lng ?? value?.lon);
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
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getSpotRating(spot) {
  const rating = Number(spot?.rating);
  const count = Number(spot?.rating_count);
  if (!Number.isFinite(rating) || rating <= 0 || (Number.isFinite(count) && count === 0)) return null;
  return Math.min(5, rating);
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
    if (Number.isFinite(radius) && (!Number.isFinite(distance) || distance > radius)) continue;
    if (minimum > 0 && (rating === null || rating < minimum)) continue;
    unique.set(key, { ...spot, _km: distance, _rating: rating });
  }

  return [...unique.values()].sort((a, b) => {
    if (sort === 'rating') return (b._rating ?? -1) - (a._rating ?? -1) || (a._km ?? Infinity) - (b._km ?? Infinity);
    if (sort === 'newest') return timestamp(b) - timestamp(a) || (a._km ?? Infinity) - (b._km ?? Infinity);
    return (a._km ?? Infinity) - (b._km ?? Infinity);
  });
}
