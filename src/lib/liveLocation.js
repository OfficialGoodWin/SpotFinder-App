import { haversineKm, normalizeLatLng } from './spotDiscovery.js';

export const LIVE_FIX_MAX_AGE_MS = 60_000;

export function normalizeDeviceFix(position, now = Date.now()) {
  const coords = position?.coords;
  const point = normalizeLatLng([coords?.latitude, coords?.longitude]);
  const timestamp = Number(position?.timestamp);
  const accuracy = Number(coords?.accuracy);
  if (!point || !Number.isFinite(timestamp) || timestamp > now + 10_000 || now - timestamp > LIVE_FIX_MAX_AGE_MS ||
      !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100_000) return null;
  return { position: point, timestamp, accuracy };
}

export function shouldDisplayFix(next, previous) {
  if (!previous) return true;
  if (next.timestamp <= previous.timestamp) return false;
  const distanceMeters = haversineKm(previous.position, next.position) * 1000;
  return distanceMeters >= 3 || Math.abs(next.accuracy - previous.accuracy) >= Math.max(5, previous.accuracy * 0.1);
}

function isImplausibleJump(next, previous) {
  if (!previous) return false;
  const seconds = (next.timestamp - previous.timestamp) / 1000;
  return seconds > 0 && haversineKm(previous.position, next.position) * 1000 >
    previous.accuracy + next.accuracy + 250 * seconds;
}

export function createLiveLocationController({ geolocation, document, onFix, onError }) {
  let watchId = null;
  let enabled = false;
  let latest = null;
  let pending = null;
  let resolvePending = null;
  const settle = value => { resolvePending?.(value); resolvePending = null; pending = null; };
  const clear = () => { if (watchId !== null) geolocation?.clearWatch(watchId); watchId = null; };
  const watch = () => {
    if (!enabled || watchId !== null || document?.hidden || !geolocation) return;
    try { watchId = geolocation.watchPosition(position => {
      const fix = normalizeDeviceFix(position);
      if (!fix || (latest && (fix.timestamp <= latest.timestamp || isImplausibleJump(fix, latest)))) return;
      const display = shouldDisplayFix(fix, latest);
      latest = fix;
      if (display) onFix(fix);
      settle(fix);
    }, error => {
      onError(error);
      settle(null);
      if (error?.code === 1 || error?.code === 2 || !latest) { enabled = false; clear(); }
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }); }
    catch (error) { enabled = false; onError(error); settle(null); }
  };
  return {
    start() {
      if (!geolocation) { onError({ code: 0 }); return Promise.resolve(null); }
      enabled = true;
      if (latest && Date.now() - latest.timestamp <= LIVE_FIX_MAX_AGE_MS) {
        watch();
        return Promise.resolve(latest);
      }
      if (!pending) pending = new Promise(resolve => { resolvePending = resolve; });
      watch();
      return pending;
    },
    onVisibilityChange() { if (document?.hidden) { clear(); settle(null); } else watch(); },
    stop() { enabled = false; clear(); settle(null); latest = null; },
    getLatest() { return latest; },
    isWatching() { return watchId !== null; },
  };
}
