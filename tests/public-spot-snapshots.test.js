import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicSpotSnapshot } from '../scripts/public-spots/export.mjs';
import { createPublicSpotSnapshotReader, loadFullSnapshotSpot, readSnapshotOrFirestore } from '../src/new/publicSpotSnapshotClient.js';
import { publicSnapshotThumbnailUrl, regionForPoint, regionsForBounds } from '../src/new/publicSpotSnapshotFormat.js';
import { cachedViewport, rememberViewport } from '../src/new/viewportCache.js';

const approved = { id: 'approved', is_public: true, status: 'published', lat: 50.1, lng: 14.1, title: 'Castle',
  tags: ['castle'], rating: 4.5, rating_count: 2, created_date: '2026-10-29', description: 'private detail',
  created_by: 'person@example.test', created_by_uid: 'private-uid', moderation_notes: 'internal',
  image_url: 'https://example.test/private.jpg', public_thumbnail_url: '/public-thumbnails/opaque123.webp' };
const bounds = { south: 49.8, west: 13.8, north: 50.4, east: 14.4 };

function fakeFetch(snapshot) {
  const calls = [];
  const fetchJson = async url => {
    calls.push(url);
    const file = url.endsWith('/manifest.json') ? snapshot.manifest : snapshot.files.get(url.split('/').at(-1));
    return { ok: Boolean(file), json: async () => file };
  };
  return { fetchJson, calls };
}

test('only approved public allowlisted fields leave the exporter', () => {
  const snapshot = buildPublicSpotSnapshot([approved, { ...approved, id: 'draft', is_public: false },
    { ...approved, id: 'flagged', status: 'flagged' }, { ...approved, id: 'review', needs_review: true },
    { ...approved, id: 'sensitive', sensitive_location: true },
    { ...approved, id: 'email-title', title: 'person@example.test' },
    { ...approved, id: 'missing-coordinates', lat: null }]);
  const spots = [...snapshot.files.values()].flatMap(file => file.spots);
  assert.equal(spots.length, 1);
  assert.equal(spots[0].image_url, '/public-thumbnails/opaque123.webp');
  assert.equal(JSON.stringify(snapshot).includes('person@example.test'), false);
  assert.equal(JSON.stringify(spots).includes('moderation_notes'), false);
  assert.equal(JSON.stringify(spots).includes('private.jpg'), false);
});

test('publishing, editing, hiding and deleting change the manifest version and visible records', () => {
  const empty = buildPublicSpotSnapshot([]);
  const published = buildPublicSpotSnapshot([approved]);
  const edited = buildPublicSpotSnapshot([{ ...approved, title: 'New Castle' }]);
  const hidden = buildPublicSpotSnapshot([{ ...approved, status: 'flagged' }]);
  const deleted = buildPublicSpotSnapshot([]);
  assert.notEqual(empty.manifest.version, published.manifest.version);
  assert.notEqual(published.manifest.version, edited.manifest.version);
  assert.equal(hidden.manifest.version, empty.manifest.version);
  assert.equal(deleted.manifest.version, empty.manifest.version);
  assert.deepEqual(buildPublicSpotSnapshot([approved]).manifest, published.manifest);
  assert.throws(() => buildPublicSpotSnapshot([approved, { ...approved, lat: 52 }]), /Duplicate spot ID/);
});

test('two-degree boundaries and the antimeridian retain spots once', async () => {
  const west = { ...approved, id: 'west', lat: 50, lng: -179.9 };
  const east = { ...approved, id: 'east', lat: 50, lng: 179.9 };
  const snapshot = buildPublicSpotSnapshot([west, east]);
  const { fetchJson } = fakeFetch(snapshot);
  const read = createPublicSpotSnapshotReader({ fetchJson });
  assert.notEqual(regionForPoint(west.lat, west.lng), regionForPoint(east.lat, east.lng));
  assert.equal(regionsForBounds({ south: 49.9, north: 50.1, west: 179.7, east: 180.3 }).length, 4);
  assert.deepEqual(regionsForBounds({ south: 90, north: 90, west: 0, east: 0 }), [regionForPoint(90, 0)]);
  assert.deepEqual((await read({ south: 49.9, north: 50.1, west: 179.7, east: 180.3 })).map(spot => spot.id).sort(), ['east', 'west']);
});

test('reader clips bounds, limits output, reuses region requests and loads full detail on click', async () => {
  const snapshot = buildPublicSpotSnapshot([approved, { ...approved, id: 'outside', lat: 50.8 }]);
  const { fetchJson, calls } = fakeFetch(snapshot);
  const read = createPublicSpotSnapshotReader({ fetchJson });
  const [first, second] = await Promise.all([read(bounds, 1), read(bounds, 1)]);
  assert.deepEqual(first.map(spot => spot.id), ['approved']);
  assert.equal(first[0].image_url, 'https://spotfinder.invalid/public-thumbnails/opaque123.webp');
  assert.equal(publicSnapshotThumbnailUrl({ ...first[0], _public_snapshot: true }, 'https://spotfinder.invalid'), first[0].image_url);
  assert.equal(publicSnapshotThumbnailUrl({ ...first[0], image_url: 'https://other.test/private.jpg', _public_snapshot: true }, 'https://spotfinder.invalid'), '');
  assert.deepEqual(second, first);
  assert.equal(calls.filter(url => url.endsWith('/manifest.json')).length, 1);
  assert.equal(calls.filter(url => url.includes('/v1/')).length, 1);
  const marked = await readSnapshotOrFirestore(bounds, 1, read, () => { throw new Error('Unexpected Firestore read'); });
  assert.equal(marked[0]._public_snapshot, true);
  let detailReads = 0;
  const full = await loadFullSnapshotSpot(marked[0], async id => { detailReads += 1; return { ...approved, id }; });
  assert.equal(full.description, 'private detail');
  assert.equal(detailReads, 1);
});

test('missing snapshot falls back to Firestore and existing viewport cache still expires', async () => {
  let firestoreReads = 0;
  const rows = await readSnapshotOrFirestore(bounds, 300, async () => { throw new Error('404'); }, async () => {
    firestoreReads += 1; return [approved];
  });
  assert.equal(rows[0]._public_snapshot, undefined);
  assert.equal(firestoreReads, 1);
  const cache = rememberViewport(null, 'view-a', rows, 1000);
  assert.deepEqual(cachedViewport(cache, 'view-a', 2000), rows);
  assert.equal(cachedViewport(cache, 'view-a', 121000), null);
});
