import { normalizeLatLng } from './spotDiscovery.js';

let focusSequence = 0;

export function createSpotFocusRequest(spot, source = 'unknown') {
  const position = normalizeLatLng(spot);
  if (!position) return null;
  focusSequence += 1;
  return {
    requestId: focusSequence,
    spotId: spot?.id ? String(spot.id) : null,
    position,
    source,
  };
}

export function getSpotCameraOptions(request, {
  viewportWidth = 1024,
  viewportHeight = 768,
  currentZoom = 0,
  reducedMotion = false,
} = {}) {
  if (!request?.position) return null;
  const [lat, lng] = request.position;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const mobile = viewportWidth < 768;
  const desiredOffset = mobile
    ? Math.min(150, Math.max(72, viewportHeight * 0.18))
    : Math.min(110, Math.max(48, viewportHeight * 0.11));
  // A marker card is about 98px tall. Short embedded/in-app viewports can be
  // only ~300px high, so cap the offset before the card would be clipped.
  const safeOffset = Math.max(0, viewportHeight / 2 - 112);
  const verticalOffset = -Math.min(desiredOffset, safeOffset);
  return {
    center: [lng, lat],
    zoom: Math.min(16, Math.max(14.5, Number(currentZoom) || 0)),
    offset: [0, verticalOffset],
    duration: reducedMotion ? 0 : 700,
    essential: false,
  };
}
