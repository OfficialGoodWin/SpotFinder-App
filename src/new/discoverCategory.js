import { categoryLabel, spotPrimaryCategory } from '../lib/spotCategories.js';

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
  const created = spot => {
    const value = spot.created_date;
    if (value?.seconds != null) return Number(value.seconds) * 1000;
    if (typeof value === 'number') return value;
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : 0;
  };
  return result.sort((a, b) => created(b) - created(a) || String(a.id).localeCompare(String(b.id)));
}
