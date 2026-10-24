import test from 'node:test';
import assert from 'node:assert/strict';
import { appendDiscoverPage, discoverRatingLabel, isDiscoverEligible } from '../src/mobile-v2/discoverSpots.js';
import { getPublicSpotPhotos } from '../src/lib/spotPresentation.js';

const base = { id: 'legacy', is_public: true, status: 'published', lat: 50, lng: 14, created_date: '2026-01-01' };
const photo = 'https://example.test/spot.jpg';

test('Discover includes valid old, current, and unrated public spots without depending on photos', () => {
  const rows = [
    { ...base, rating: 4.2, rating_count: 7 },
    { ...base, id: 'current', rating_schema: 2, rating: 3.8, rating_count: 2 },
    { ...base, id: 'new-unrated', status: 'pending_trust', rating_schema: 2, rating: 0, rating_count: 0 },
    { ...base, id: 'missing-rating' },
    { ...base, id: 'photo', image_url: photo, image_urls: [photo] },
    { ...base, id: 'no-photo', image_url: null, image_urls: [] },
  ];
  assert.deepEqual(rows.filter(isDiscoverEligible).map(spot => spot.id), rows.map(spot => spot.id));
  assert.deepEqual(rows.map(discoverRatingLabel), [
    '★ 4.2 (7)', '★ 3.8 (2)', 'Zatím bez hodnocení',
    'Zatím bez hodnocení', 'Zatím bez hodnocení', 'Zatím bez hodnocení',
  ]);
  assert.equal(getPublicSpotPhotos(rows[4])[0].url, photo);
  assert.deepEqual(getPublicSpotPhotos(rows[5]), []);
});

test('Discover excludes private, draft, rejected, removed, flagged, and hidden spots', () => {
  const rejected = [
    { ...base, id: 'private', is_public: false },
    ...['draft', 'removed', 'rejected', 'flagged', 'hidden'].map(status => ({ ...base, id: status, status })),
    { ...base, id: 'hidden-state', discovery_state: 'hidden' },
    { ...base, id: 'sensitive', sensitive_location: true },
    { ...base, id: 'invalid-location', lat: null },
  ];
  assert.deepEqual(rejected.filter(isDiscoverEligible), []);
});

test('appending an overlapping cursor page preserves page order without duplicates', () => {
  const first = [{ ...base, id: 'new' }, { ...base, id: 'legacy' }];
  const second = [{ ...base, id: 'legacy', title: 'Updated' }, { ...base, id: 'older' }];
  const result = appendDiscoverPage(first, second);
  assert.deepEqual(result.map(spot => spot.id), ['new', 'legacy', 'older']);
  assert.equal(result[1].title, 'Updated');
});
