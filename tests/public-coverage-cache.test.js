import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicCoverageCache } from '../src/lib/publicCoverageCache.js';

const bounds = { south: 50, west: 14, north: 51, east: 15 };
const rows = [
  { id: 'a', lat: 50.2, lng: 14.2, is_public: true, status: 'published' },
  { id: 'b', lat: 50.8, lng: 14.8, is_public: true, status: 'pending_trust' },
];

test('complete public viewport can serve contained map and Nearby rectangles', () => {
  const cache = createPublicCoverageCache();
  cache.remember(bounds, rows, 3);
  assert.deepEqual(cache.lookup({ south: 50, west: 14, north: 50.5, east: 14.5 }, 3), [rows[0]]);
  assert.deepEqual(cache.lookup(bounds, 3), rows);
  assert.equal(cache.lookup({ ...bounds, east: 15.1 }, 3), null);
});

test('saturated, expired, dateline and capped coverage cannot be reused', () => {
  let now = 0;
  const cache = createPublicCoverageCache({ ttlMs: 60, now: () => now });
  cache.remember(bounds, rows, 2);
  assert.equal(cache.lookup(bounds, 3), null);
  cache.remember(bounds, rows, 3);
  assert.equal(cache.lookup(bounds, 2), null);
  assert.equal(cache.lookup({ ...bounds, west: 179, east: -179 }, 3), null);
  now = 60;
  assert.equal(cache.lookup(bounds, 3), null);
});

test('public mutation invalidates coverage', () => {
  const cache = createPublicCoverageCache();
  cache.remember(bounds, rows, 3);
  cache.clear();
  assert.equal(cache.lookup(bounds, 3), null);
});

test('draft and unpublished rows are never accepted as reusable public coverage', () => {
  const cache = createPublicCoverageCache();
  cache.remember(bounds, [...rows, { ...rows[0], id: 'draft', status: 'draft' }], 5);
  assert.equal(cache.lookup(bounds, 5), null);
  cache.remember(bounds, [{ ...rows[0], is_public: false }], 5);
  assert.equal(cache.lookup(bounds, 5), null);
});
