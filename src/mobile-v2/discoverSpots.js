import { getSpotRating, normalizeLatLng } from '../lib/spotDiscovery.js';

const DISCOVERABLE_STATES = new Set(['', 'approved', 'featured', 'public', 'discoverable']);

export function isDiscoverEligible(spot) {
  if (!spot?.id || spot.is_public !== true || spot.status !== 'published') return false;
  if (spot.needs_review === true || (spot.flag_count != null && spot.flag_count !== 0)) return false;
  if (!DISCOVERABLE_STATES.has(spot.discovery_state ?? '')) return false;
  if (spot.sensitive_location === true || spot.location_sensitive === true) return false;
  if (!normalizeLatLng(spot)) return false;
  return true;
}

export function discoverRatingLabel(spot) {
  const rating = getSpotRating(spot);
  return rating === null ? 'Zatím bez hodnocení' : `★ ${rating.toFixed(1)} (${Number(spot.rating_count)})`;
}

export function appendDiscoverPage(previous, next) {
  const byId = new Map((previous || []).map(spot => [spot.id, spot]));
  for (const spot of next || []) byId.set(spot.id, spot);
  return [...byId.values()];
}
