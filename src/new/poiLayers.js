const STORAGE_KEY = 'spotfinder_new_poi_layers_v1';

export const DEFAULT_NEW_POI_LAYERS = Object.freeze({ community: true, interesting: true, parking: true, practical: false, food: false });

const INTERESTING = new Set(['heritage', 'viewpoint', 'museum', 'camp_site', 'picnic_site']);
const FOOD = new Set(['restaurant', 'cafe', 'bar', 'bakery']);

export function poiGroupForCategory(key) {
  if (INTERESTING.has(key)) return 'interesting';
  if (key === 'parking') return 'parking';
  if (FOOD.has(key)) return 'food';
  return 'practical';
}

export function getNewPoiLayersPreference(storage) {
  try {
    const saved = JSON.parse((storage ?? globalThis.localStorage)?.getItem(STORAGE_KEY) || '{}');
    return Object.fromEntries(Object.entries(DEFAULT_NEW_POI_LAYERS).map(([key, fallback]) => [key, typeof saved[key] === 'boolean' ? saved[key] : fallback]));
  } catch { return { ...DEFAULT_NEW_POI_LAYERS }; }
}

export function saveNewPoiLayersPreference(layers, storage) {
  const next = Object.fromEntries(Object.keys(DEFAULT_NEW_POI_LAYERS).map(key => [key, Boolean(layers[key])]));
  try { (storage ?? globalThis.localStorage)?.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Session preference still applies. */ }
  return next;
}
