import { categoryLabel, spotPrimaryCategory } from '@/lib/spotCategories';

export const DISCOVER_ALL = 'all';

export function discoverCategoryOf(spot) {
  return spotPrimaryCategory(spot);
}

export function discoverCategoryLabel(spot, language = 'cs') {
  const key = discoverCategoryOf(spot);
  return key ? categoryLabel(key, language, { short: true }) : (String(language || '').startsWith('cs') ? 'Místo' : 'Spot');
}

export function matchesDiscoverCategory(spot, category) {
  if (!category || category === DISCOVER_ALL || category === 'Vše') return true;
  return discoverCategoryOf(spot) === category;
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
