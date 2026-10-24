import { getSpotRating, normalizeLatLng } from '../lib/spotDiscovery.js';

const DISCOVERABLE_STATES = new Set(['approved', 'featured', 'public', 'discoverable']);

export function isDiscoverEligible(spot) {
  if (!spot?.id || spot.is_public !== true || !['published', 'pending_trust'].includes(spot.status)) return false;
  if (!normalizeLatLng(spot)) return false;
  if (spot.discovery_state && !DISCOVERABLE_STATES.has(String(spot.discovery_state).toLowerCase())) return false;
  return spot.sensitive_location !== true && spot.location_sensitive !== true;
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
