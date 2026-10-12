import test from 'node:test';
import assert from 'node:assert/strict';
import { getMapExploreEnabled, MAP_EXPLORE_PREFERENCE_KEY, setMapExploreEnabled } from '../src/lib/mapExplorePreference.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('map discovery is enabled by default and persists both choices', () => {
  const storage = memoryStorage();
  assert.equal(getMapExploreEnabled(storage), true);

  setMapExploreEnabled(false, storage);
  assert.equal(storage.getItem(MAP_EXPLORE_PREFERENCE_KEY), '0');
  assert.equal(getMapExploreEnabled(storage), false);

  setMapExploreEnabled(true, storage);
  assert.equal(getMapExploreEnabled(storage), true);
});

test('map discovery remains available when browser storage is blocked', () => {
  const blockedStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(getMapExploreEnabled(blockedStorage), true);
  assert.doesNotThrow(() => setMapExploreEnabled(false, blockedStorage));
});
