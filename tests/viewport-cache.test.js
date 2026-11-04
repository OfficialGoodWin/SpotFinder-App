import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedViewport, createViewportRequestSequence, rememberViewport } from '../src/new/viewportCache.js';

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

test('stale asynchronous viewport responses cannot replace newer markers', async () => {
  const sequence = createViewportRequestSequence();
  let rows = [];
  const load = async (token, nextRows, delay) => {
    await new Promise(resolve => setTimeout(resolve, delay));
    if (sequence.isCurrent(token)) rows = nextRows;
  };
  const stale = sequence.next();
  const staleLoad = load(stale, [{ id: 'old' }], 20);
  const current = sequence.next();
  const currentLoad = load(current, [{ id: 'new' }], 0);
  await Promise.all([staleLoad, currentLoad]);
  assert.deepEqual(rows, [{ id: 'new' }]);
  sequence.cancel();
  assert.equal(sequence.isCurrent(current), false);
});
