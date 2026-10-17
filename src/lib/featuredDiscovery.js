import { getPublicSpotPhotos, getVerifiedSpotCategory } from './spotPresentation.js';

const PROMOTABLE_CATEGORIES = new Set(['viewpoint', 'castle', 'historic site', 'historic ruin', 'mountain', 'mountain spot', 'waterfall', 'sunset spot', 'sunrise spot', 'photo spot', 'hiking spot']);
const PROMOTABLE_STATES = new Set(['approved', 'featured', 'public', 'discoverable']);

export function isFeaturedEligible(spot) {
  if (!spot?.id || spot.is_public !== true || spot.status !== 'published') return false;
  if (spot.lat == null || (spot.lng ?? spot.lon) == null) return false;
  const lat = Number(spot.lat), lng = Number(spot.lng ?? spot.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if ((spot.discovery_state && !PROMOTABLE_STATES.has(String(spot.discovery_state).toLowerCase()))
    || spot.sensitive_location === true || spot.location_sensitive === true) return false;
  const category = getVerifiedSpotCategory(spot);
  if (!PROMOTABLE_CATEGORIES.has(category)) return false;
  return true;
}

export function selectFeaturedSpots(spots, maxCount = 3) {
  return spots.filter(isFeaturedEligible)
    .sort((a, b) => Number(getPublicSpotPhotos(b).length > 0) - Number(getPublicSpotPhotos(a).length > 0))
    .slice(0, maxCount);
}
