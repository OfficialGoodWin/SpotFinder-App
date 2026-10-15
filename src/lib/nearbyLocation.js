import { normalizeLatLng } from './spotDiscovery.js';

export const NEARBY_LOCATION_MAX_AGE_MS = 5 * 60 * 1000;

export function freshNearbyFix(fix, now = Date.now()) {
  if (!normalizeLatLng(fix?.position) || !Number.isFinite(fix?.timestamp)) return null;
  return now >= fix.timestamp && now - fix.timestamp <= NEARBY_LOCATION_MAX_AGE_MS ? fix.position : null;
}

export function nearbyLocationFailure(code, hadStaleFix = false) {
  const prefix = hadStaleFix ? 'Your previous location is out of date. ' : '';
  if (code === 1) return `${prefix}Location permission was denied. Allow access in your browser settings, or choose the map center.`;
  if (code === 2) return `${prefix}The device could not determine your location. Try again or choose the map center.`;
  if (code === 3) return `${prefix}Location timed out. Try again or choose the map center.`;
  return `${prefix}This browser cannot provide your location. Choose the map center instead.`;
}
