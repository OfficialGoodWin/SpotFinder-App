export const NAVIGATION_PROVIDERS = [
  { id: 'google', label: 'Google Maps' },
  { id: 'mapy', label: 'Mapy.com' },
  { id: 'apple', label: 'Apple Maps' },
];

export function navigationCoordinates(destination) {
  const rawLat = destination?.lat;
  const rawLng = destination?.lng ?? destination?.lon;
  if (rawLat == null || rawLng == null || String(rawLat).trim() === '' || String(rawLng).trim() === '') return null;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function buildExternalNavigationUrl(providerId, destination) {
  const coordinates = navigationCoordinates(destination);
  if (!coordinates) return null;
  const { lat, lng } = coordinates;
  let url;
  switch (providerId) {
    case 'google':
      url = new URL('https://www.google.com/maps/dir/');
      url.searchParams.set('api', '1');
      url.searchParams.set('destination', `${lat},${lng}`);
      url.searchParams.set('dir_action', 'navigate');
      break;
    case 'mapy':
      url = new URL('https://mapy.com/fnc/v1/route');
      url.searchParams.set('end', `${lng},${lat}`);
      url.searchParams.set('routeType', 'car_fast_traffic');
      url.searchParams.set('navigate', 'true');
      break;
    case 'apple':
      url = new URL('https://maps.apple.com/directions');
      url.searchParams.set('destination', `${lat},${lng}`);
      break;
    default:
      return null;
  }
  return url.toString();
}
