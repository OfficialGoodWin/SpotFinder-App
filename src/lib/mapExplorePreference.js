export const MAP_EXPLORE_PREFERENCE_KEY = 'spotfinder_map_explore_enabled_v1';

export function getMapExploreEnabled(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(MAP_EXPLORE_PREFERENCE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setMapExploreEnabled(enabled, storage = globalThis.localStorage) {
  try {
    storage?.setItem(MAP_EXPLORE_PREFERENCE_KEY, enabled ? '1' : '0');
  } catch {
    // The in-memory preference still applies when storage is unavailable.
  }
}
