import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpotSelection, filterAndSortNearbySpots, getSpotRating, haversineKm, nearbyBounds, normalizeLatLng, sortSpotCollection,
} from '../src/lib/spotDiscovery.js';

const origin = [50.0755, 14.4378];

test('normalizes latitude/longitude in the documented order and rejects invalid coordinates', () => {
  assert.deepEqual(normalizeLatLng({ lat: 50.1, lng: 14.4 }), [50.1, 14.4]);
  assert.deepEqual(normalizeLatLng([50.1, 14.4]), [50.1, 14.4]);
  assert.equal(normalizeLatLng([181, 50]), null);
  assert.ok(haversineKm(origin, origin) < 0.000001);
  assert.ok(haversineKm([50, 14], [50, 15]) > 71 && haversineKm([50, 14], [50, 15]) < 72);
});

test('enforces 1 km and 50 km boundaries while unlimited keeps distant results', () => {
  const spots = [
    { id: 'inside-1', lat: origin[0] + 0.0089, lng: origin[1] },
    { id: 'outside-1', lat: origin[0] + 0.0091, lng: origin[1] },
    { id: 'inside-50', lat: origin[0] + 0.449, lng: origin[1] },
    { id: 'outside-50', lat: origin[0] + 0.451, lng: origin[1] },
    { id: 'far', lat: origin[0] + 3.1, lng: origin[1] },
  ];
  assert.deepEqual(filterAndSortNearbySpots(spots, { origin, maxDistance: 1 }).map(s => s.id), ['inside-1']);
  assert.deepEqual(filterAndSortNearbySpots(spots, { origin, maxDistance: 50 }).map(s => s.id), ['inside-1', 'outside-1', 'inside-50']);
  assert.equal(filterAndSortNearbySpots(spots, { origin, maxDistance: Infinity }).at(-1).id, 'far');
});

test('a Czech-German border search uses geographic distance, not country or coordinate order', () => {
  const originNearAs = [50.223, 12.195];
  const acrossBorderNearSelb = { id: 'de', lat: 50.171, lng: 12.130, rating_count: 0 };
  const distance = haversineKm(originNearAs, acrossBorderNearSelb);
  assert.ok(distance > 7 && distance < 8);
  assert.deepEqual(filterAndSortNearbySpots([acrossBorderNearSelb], { origin: originNearAs, maxDistance: 8 }).map(spot => spot.id), ['de']);
  assert.deepEqual(filterAndSortNearbySpots([acrossBorderNearSelb], { origin: originNearAs, maxDistance: 7 }).map(spot => spot.id), []);
  const bounds = nearbyBounds(originNearAs, 8);
  assert.ok(bounds.south <= acrossBorderNearSelb.lat && bounds.north >= acrossBorderNearSelb.lat);
  assert.ok(bounds.west <= acrossBorderNearSelb.lng && bounds.east >= acrossBorderNearSelb.lng);
  assert.equal(Math.round(bounds.south * 100), bounds.south * 100);
});

test('distinguishes unrated spots from low ratings and filters before sorting', () => {
  const spots = [
    { id: 'unrated', lat: 50.08, lng: 14.44, rating: 0, rating_count: 0 },
    { id: 'low', lat: 50.09, lng: 14.44, rating: 2, rating_count: 3 },
    { id: 'high-farther', lat: 50.1, lng: 14.44, rating: 4.8, rating_count: 2 },
    { id: 'high-nearer', lat: 50.085, lng: 14.44, rating: 4.2, rating_count: 1 },
  ];
  assert.equal(getSpotRating(spots[0]), null);
  assert.deepEqual(filterAndSortNearbySpots(spots, { origin, maxDistance: 50, minRating: 4 }).map(s => s.id), ['high-nearer', 'high-farther']);
  assert.deepEqual(filterAndSortNearbySpots(spots, { origin, maxDistance: 50, minRating: 4, sort: 'rating' }).map(s => s.id), ['high-farther', 'high-nearer']);
});

test('every minimum-rating threshold excludes lower and malformed community ratings', () => {
  const spots = [
    { id: 'unrated', lat: 50, lng: 14, rating: 0, rating_count: 0 },
    { id: 'missing-count', lat: 50, lng: 14, rating: 5 },
    { id: 'malformed', lat: 50, lng: 14, rating: 5, rating_count: 'unknown' },
    ...[2.9, 3, 3.5, 4, 4.5].map((rating, index) => ({ id: String(rating), lat: 50 + index / 100, lng: 14, rating, rating_count: index + 1 })),
  ];
  assert.equal(filterAndSortNearbySpots(spots, { origin: [50, 14], maxDistance: 50 }).length, spots.length);
  for (const threshold of [3, 3.5, 4, 4.5]) {
    const results = filterAndSortNearbySpots(spots, { origin: [50, 14], maxDistance: 50, minRating: threshold });
    assert.deepEqual(results.map(spot => spot.id), [3, 3.5, 4, 4.5].filter(value => value >= threshold).map(String));
  }
  assert.equal(getSpotRating(spots[1]), null);
  assert.equal(getSpotRating(spots[2]), null);
});

test('deduplicates stale list entries and produces the exact list selection', () => {
  const spot = { id: 'castle-1', lat: 50.2, lng: 14.3, title: 'Castle' };
  const results = filterAndSortNearbySpots([spot, { ...spot, title: 'stale' }], { origin, maxDistance: Infinity });
  assert.equal(results.length, 1);
  assert.deepEqual(createSpotSelection(spot), { id: 'castle-1', spot, position: [50.2, 14.3] });
  assert.equal(createSpotSelection({ id: 'broken', lat: 999, lng: 14 }), null);
});

test('nearby sorting uses actual distance, rating and newest date before client paging', () => {
  const spots = [
    { id: 'near', lat: 50.001, lng: 14, rating: 3.5, rating_count: 1, created_date: '2026-01-01' },
    { id: 'far', lat: 50.03, lng: 14, rating: 4.5, rating_count: 2, created_date: '2026-03-01' },
    { id: 'middle', lat: 50.02, lng: 14, rating: 4, rating_count: 1, created_date: '2026-02-01' },
  ];
  assert.deepEqual(filterAndSortNearbySpots(spots, { origin: [50, 14], maxDistance: 10 }).map(spot => spot.id), ['near', 'middle', 'far']);
  assert.deepEqual(filterAndSortNearbySpots(spots, { origin: [50, 14], maxDistance: 10, sort: 'rating' }).map(spot => spot.id), ['far', 'middle', 'near']);
  assert.deepEqual(filterAndSortNearbySpots(spots, { origin: [50, 14], maxDistance: 10, sort: 'newest' }).map(spot => spot.id), ['far', 'middle', 'near']);
});

test('collection sorting follows the selected order and relation date where applicable', () => {
  const spots = [
    { id: 'b', title: 'Beta', rating: 4.8, rating_count: 2, likes_count: 1, created_date: '2026-01-01', _relation_created_date: '2026-03-01' },
    { id: 'a', title: 'Alpha', rating: 3.5, rating_count: 2, likes_count: 8, created_date: '2026-02-01', _relation_created_date: '2026-01-01' },
  ];
  assert.deepEqual(sortSpotCollection(spots, 'alphabetical').map(s => s.id), ['a', 'b']);
  assert.deepEqual(sortSpotCollection(spots, 'rating').map(s => s.id), ['b', 'a']);
  assert.deepEqual(sortSpotCollection(spots, 'liked').map(s => s.id), ['a', 'b']);
  assert.deepEqual(sortSpotCollection(spots, 'newest').map(s => s.id), ['a', 'b']);
  assert.deepEqual(sortSpotCollection(spots, 'newest', { relationFirst: true }).map(s => s.id), ['b', 'a']);
});
