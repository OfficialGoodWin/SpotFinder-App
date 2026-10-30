import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedViewport, rememberViewport } from '../src/new/viewportCache.js';

test('recent map views are reused and invalidation clears every view', () => {
  let cache = rememberViewport(null, 'A', [{ id: 'a' }], 1000);
  cache = rememberViewport(cache, 'B', [{ id: 'b' }], 2000);
  assert.deepEqual(cachedViewport(cache, 'A', 3000), [{ id: 'a' }]);
  assert.equal(cachedViewport(null, 'A', 3000), null);
  assert.equal(cachedViewport(cache, 'A', 121000), null);
});

test('cache retains at most four views', () => {
  let cache = null;
  for (let i = 0; i < 5; i++) cache = rememberViewport(cache, String(i), [i], i * 1000);
  assert.equal(cachedViewport(cache, '0', 5000), null);
  assert.deepEqual(cachedViewport(cache, '4', 5000), [4]);
});
