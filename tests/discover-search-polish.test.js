import test from 'node:test';
import assert from 'node:assert/strict';
import { appendUniqueDiscoverSpots, matchesDiscoverCategory } from '../src/new/discoverCategory.js';
import { spotMatchesSearch } from '../src/lib/spotPresentation.js';
import { isDiscoverEligible } from '../src/mobile-v2/discoverSpots.js';

test('Discover pages remain unique and deterministically ordered', () => {
  const first = [{ id: 'b', created_date: '2026-01-01' }, { id: 'a', created_date: '2026-01-01' }];
  const second = [{ id: 'b', created_date: '2026-01-01' }, { id: 'c', created_date: '2025-12-31' }];
  assert.deepEqual(appendUniqueDiscoverSpots(first, second).map(spot => spot.id), ['a', 'b', 'c']);
});

test('category matches a stable primary category', () => {
  const spot = { id: '1', category: 'viewpoint' };
  assert.equal(matchesDiscoverCategory(spot, 'viewpoint'), true);
  assert.equal(matchesDiscoverCategory(spot, 'castle'), false);
});

test('search ignores Czech accents, punctuation, case and extra space', () => {
  const spot = { title: 'Český Krumlov', city: 'Praha' };
  for (const query of ['cesky krumlov', ' CESKY,  KRUMLOV ', 'pra', 'cesky krumlo']) {
    assert.equal(spotMatchesSearch(spot, query, 'cs'), true, query);
  }
  assert.equal(spotMatchesSearch(spot, 'brno', 'cs'), false);
});

test('private and revoked spots cannot enter Discover results', () => {
  const spot = { id: '1', status: 'published', is_public: true, lat: 50, lng: 14 };
  assert.equal(isDiscoverEligible(spot), true);
  assert.equal(isDiscoverEligible({ ...spot, is_public: false }), false);
  assert.equal(isDiscoverEligible({ ...spot, status: 'rejected' }), false);
  assert.equal(isDiscoverEligible({ ...spot, discovery_state: 'revoked' }), false);
});
