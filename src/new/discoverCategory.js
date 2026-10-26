import { getVerifiedSpotCategory } from '@/lib/spotPresentation';

const normalize = value => String(value || '').trim().normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ');
const hasAny = (values, options) => options.some(option => values.has(option));

export function discoverCategoryOf(spot) {
  const tags = new Set((Array.isArray(spot?.tags) ? spot.tags : []).map(normalize));
  const verified = normalize(getVerifiedSpotCategory(spot));
  const resolved = normalize(spot?.resolved_category);
  const type = normalize(spot?.spot_type);
  const values = new Set([verified, resolved, type]);

  // Inspect every discovery tag; getVerifiedSpotCategory only returns the first.
  if (hasAny(tags, ['ruin', 'ruins', 'zricenina', 'zriceniny'])) return 'Zříceniny';
  if (verified === 'historic ruin' || resolved === 'historic ruin') return 'Zříceniny';
  if (verified === 'castle' || resolved === 'castle') return 'Hrady';
  if (hasAny(values, ['ruin', 'ruins', 'historic ruin', 'zricenina', 'zriceniny'])) return 'Zříceniny';
  if (hasAny(tags, ['castle', 'hrad', 'hrady']) || hasAny(values, ['castle', 'hrad', 'hrady'])) return 'Hrady';
  if (hasAny(tags, ['viewpoint', 'sunset', 'sunrise', 'photospot', 'vyhlidka', 'vyhlidky']) || hasAny(values, ['viewpoint', 'sunset spot', 'sunrise spot', 'photo spot', 'vyhlidka', 'vyhlidky'])) return 'Vyhlídky';
  if (hasAny(tags, ['mountain', 'hike', 'swimspot', 'waterfall', 'nature', 'priroda']) || hasAny(values, ['mountain', 'mountain spot', 'hiking spot', 'waterfall', 'nature', 'priroda'])) return 'Příroda';
  if (hasAny(tags, ['secretcafe', 'cafe', 'coffee', 'food', 'restaurant', 'kavarna', 'kavarny']) || hasAny(values, ['cafe', 'café', 'food', 'food stop', 'restaurant', 'kavarna', 'kavarny'])) return 'Kavárny';
  return 'Ostatní';
}

export function matchesDiscoverCategory(spot, category) {
  return category === 'Vše' || discoverCategoryOf(spot) === category;
}

export function appendUniqueDiscoverSpots(previous, next) {
  const seen = new Set((previous || []).map(spot => String(spot.id)));
  const result = [...(previous || [])];
  for (const spot of next || []) {
    const id = String(spot.id);
    if (!seen.has(id)) { seen.add(id); result.push(spot); }
  }
  return result;
}
