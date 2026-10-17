// MapLibre Marker#addTo immediately projects its coordinates. Never attach a
// marker until setLngLat has received a valid longitude/latitude pair.
export function validMarkerLngLat(lng, lat) {
  const parsedLng = typeof lng === 'number' || (typeof lng === 'string' && lng.trim()) ? Number(lng) : NaN;
  const parsedLat = typeof lat === 'number' || (typeof lat === 'string' && lat.trim()) ? Number(lat) : NaN;
  return Number.isFinite(parsedLng) && Number.isFinite(parsedLat) &&
    parsedLng >= -180 && parsedLng <= 180 && parsedLat >= -90 && parsedLat <= 90
    ? [parsedLng, parsedLat] : null;
}

export function attachMarkerAt(marker, map, lngLat) {
  const valid = validMarkerLngLat(lngLat?.[0], lngLat?.[1]);
  if (!valid || !map) return null;
  return marker.setLngLat(valid).addTo(map);
}
