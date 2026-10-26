import { normalizeLatLng } from '@/lib/spotDiscovery';

export function publicMySpots(groups) {
  const unique = new Map();
  for (const group of groups) for (const spot of group) {
    if (!spot?.id || spot.is_public !== true || !['published', 'pending_trust'].includes(spot.status) || !normalizeLatLng(spot)) continue;
    unique.set(String(spot.id), spot);
  }
  return [...unique.values()];
}

export function fitMySpotsOnMap(map, spots) {
  const coordinates = spots.map(normalizeLatLng).filter(Boolean);
  if (!map || !coordinates.length) return;
  map.resize();
  const rect = map.getContainer().getBoundingClientRect();
  const shell = map.getContainer().closest('.mobile-v2');
  const top = shell?.querySelector('.sf-new-top')?.getBoundingClientRect();
  const sheet = shell?.querySelector('.sf-new-nearby')?.getBoundingClientRect();
  const padding = {
    top: Math.max(24, Math.ceil((top?.bottom ?? rect.top) - rect.top) + 20),
    bottom: Math.max(24, Math.ceil(rect.bottom - (sheet?.top ?? rect.bottom)) + 20),
    left: 28,
    right: 28,
  };
  const bounds = coordinates.reduce((result, [lat, lng]) => ({
    west: Math.min(result.west, lng), south: Math.min(result.south, lat),
    east: Math.max(result.east, lng), north: Math.max(result.north, lat),
  }), { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity });
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  map.fitBounds([[bounds.west, bounds.south], [bounds.east, bounds.north]], {
    padding,
    maxZoom: coordinates.length === 1 ? 12 : 16,
    duration: reducedMotion ? 0 : 650,
  });
}
