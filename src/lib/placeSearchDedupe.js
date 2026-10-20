const validPosition = position => Number.isFinite(Number(position?.lat)) && Number.isFinite(Number(position?.lon ?? position?.lng));

const normalizedName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function samePlace(a, b) {
  if (a.id && a.id === b.id) return true;
  const lat = (a.position.lat + b.position.lat) / 2 * Math.PI / 180;
  const north = (a.position.lat - b.position.lat) * 111_320;
  const east = (a.position.lon - b.position.lon) * 111_320 * Math.cos(lat);
  if (Math.hypot(north, east) > 25) return false;
  const first = normalizedName(a.name);
  const second = normalizedName(b.name);
  return first.length >= 6 && second.length >= 6
    && (first === second || first.includes(` ${second}`) || second.includes(` ${first}`));
}

export function dedupePlaceResults(items) {
  const unique = [];
  for (const item of items) {
    if (!item.name || !validPosition(item.position)) continue;
    if (!unique.some(previous => samePlace(previous, item))) unique.push(item);
  }
  return unique;
}
