// Shared helpers for the "Nearby spots" distance slider.
// The slider runs 1..50 km, plus one explicit wider-discovery notch.
// Infinity removes the client radius filter, while the Firestore read cap still applies.
export const NEARBY_DEFAULT_KM = 50;
export const NEARBY_SLIDER_MAX = 51; // 51 = wider-discovery notch

export const sliderToKm = (v) => (Number(v) >= NEARBY_SLIDER_MAX ? Infinity : Number(v));
export const kmToSlider = (km) => (km === Infinity || km == null || km > 50 ? NEARBY_SLIDER_MAX : Math.max(1, Number(km)));
export const formatMaxDistance = (km) => (km === Infinity ? 'Explore farther' : `${km} km`);
export const isDefaultNearbyFilters = (f) =>
  (f?.maxDistance ?? NEARBY_DEFAULT_KM) === NEARBY_DEFAULT_KM && (f?.minRating ?? 0) === 0;
