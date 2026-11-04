import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicSpotSnapshot, validateSnapshotArtifacts, writePublicSpotSnapshot } from '../scripts/public-spots/export.mjs';
import { assertPublisherTarget } from '../scripts/public-spots/publish.mjs';
import { snapshotFeatureEnabled, originalMapSnapshotFeatureEnabled } from '../src/new/snapshotFeatureFlag.js';
import { mkdtemp, readFile, readdir, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createPublicSpotSnapshotReader, loadFullSnapshotSpot, readSnapshotSpots } from '../src/new/publicSpotSnapshotClient.js';
import { MAX_VIEW_REGIONS, SNAPSHOT_FORMAT, decodeSnapshotSpot, encodeSnapshotSpot, publicSnapshotThumbnailUrl, regionForPoint, regionsForBounds, snapshotRegionDirectory, toPublicSnapshotSpot, validSnapshotSpot } from '../src/new/publicSpotSnapshotFormat.js';
import { cachedViewport, rememberViewport } from '../src/new/viewportCache.js';
import { applyTrustedSnapshotChange, currentSnapshotRecords } from '../scripts/public-spots/publicationState.mjs';

const approved = { id: 'approved', is_public: true, status: 'published', lat: 50.1, lng: 14.1, title: 'Castle',
  tags: ['castle'], rating: 4.5, rating_count: 2, created_date: '2026-10-29', description: 'private detail',
  created_by: 'person@example.test', created_by_uid: 'private-uid', moderation_notes: 'internal',
  image_url: 'https://example.test/private.jpg', public_thumbnail_url: '/public-thumbnails/opaque123.webp' };
const bounds = { south: 49.8, west: 13.8, north: 50.4, east: 14.4 };

function viewportAtZoom(zoom, lat = 50.1, lng = 14.1, width = 1280, height = 800) {
  const lngSpan = 360 * width / (512 * 2 ** zoom);
  const latSpan = lngSpan * height / width;
  return { south: lat - latSpan / 2, north: lat + latSpan / 2, west: lng - lngSpan / 2, east: lng + lngSpan / 2 };
}

function fakeFetch(snapshot) {
  const calls = [];
  const fetchJson = async url => {
    calls.push(url);
    const file = url.endsWith('/spot-snapshot-revocations') ? { format: 1, revoked: [] }
      : url.endsWith('/manifest.json') ? snapshot.manifest : snapshot.files.get(url.split('/').at(-1));
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

test('legacy map visibility includes pending trust while snapshots exclude it', () => {
  const records = [approved, { ...approved, id: 'pending', status: 'pending_trust' },
    { ...approved, id: 'draft', is_public: false, status: 'draft' }];
  const legacyVisible = records.filter(spot => spot.is_public
    && ['published', 'pending_trust'].includes(spot.status));
  const snapshotVisible = [...buildPublicSpotSnapshot(records).files.values()]
    .flatMap(file => file.spots);
  assert.deepEqual(legacyVisible.map(spot => spot.id), ['approved', 'pending']);
  assert.deepEqual(snapshotVisible.map(spot => spot.id), ['approved']);
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
  assert.equal(buildPublicSpotSnapshot([approved]).manifest.revision, published.manifest.revision);
  assert.throws(() => buildPublicSpotSnapshot([approved, { ...approved, lat: 52 }]), /Duplicate visible spot ID/);
});

test('moving a visible spot changes regions and an admin unhide restores only the approved marker', () => {
  const before = buildPublicSpotSnapshot([approved]);
  const moved = buildPublicSpotSnapshot([{ ...approved, lng: 16.1 }]);
  assert.notEqual(regionForPoint(approved.lat, approved.lng), regionForPoint(approved.lat, 16.1));
  assert.equal(Object.hasOwn(moved.manifest.regions, regionForPoint(approved.lat, approved.lng)), false);
  assert.equal(Object.hasOwn(moved.manifest.regions, regionForPoint(approved.lat, 16.1)), true);
  const hidden = buildPublicSpotSnapshot([{ ...approved, status: 'hidden' }]);
  const unhidden = buildPublicSpotSnapshot([approved]);
  assert.equal(Object.keys(hidden.manifest.regions).length, 0);
  assert.equal(unhidden.manifest.revision, before.manifest.revision);
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
  assert.equal(calls.filter(url => url.includes(`/${snapshotRegionDirectory(SNAPSHOT_FORMAT)}/`)).length, 1);
  const marked = await readSnapshotSpots(bounds, 1, read);
  assert.equal(marked[0]._public_snapshot, true);
  let detailReads = 0;
  const full = await loadFullSnapshotSpot(marked[0], async id => { detailReads += 1; return { ...approved, id }; }, read.isRevoked);
  assert.equal(full.description, 'private detail');
  assert.equal(detailReads, 1);
  assert.equal(await loadFullSnapshotSpot(marked[0], async () => { detailReads += 1; }, async () => true), null);
  assert.equal(detailReads, 1);
});

test('zoom levels 5 through 18 keep approved markers visible', async () => {
  const snapshot = buildPublicSpotSnapshot([approved]);
  const { fetchJson } = fakeFetch(snapshot);
  const read = createPublicSpotSnapshotReader({ fetchJson });
  for (let zoom = 5; zoom <= 18; zoom += 1) {
    const view = viewportAtZoom(zoom);
    if (zoom === 5) assert.ok(regionsForBounds(view).length > MAX_VIEW_REGIONS);
    assert.deepEqual((await read(view)).map(spot => spot.id), ['approved'], `zoom ${zoom}`);
  }
});

test('partial snapshot coverage returns every covered marker in a wide viewport', async () => {
  const second = { ...approved, id: 'second', lat: 50.1, lng: 16.1 };
  const snapshot = buildPublicSpotSnapshot([approved, second]);
  const { fetchJson, calls } = fakeFetch(snapshot);
  const read = createPublicSpotSnapshotReader({ fetchJson });
  const view = viewportAtZoom(5, 50.1, 15.1);
  assert.ok(regionsForBounds(view).length > MAX_VIEW_REGIONS);
  assert.deepEqual((await read(view)).map(spot => spot.id).sort(), ['approved', 'second']);
  assert.equal(calls.filter(url => url.includes('/v3/')).length, 2);
});

test('wide viewports cap covered region requests without failing', async () => {
  const spots = Array.from({ length: 20 }, (_, index) => ({ ...approved, id: `spot-${index}`,
    lat: 50.1, lng: -10.5 + index * 2 }));
  const snapshot = buildPublicSpotSnapshot(spots);
  const { fetchJson, calls } = fakeFetch(snapshot);
  const read = createPublicSpotSnapshotReader({ fetchJson });
  const view = { south: 49, west: -11.5, north: 51, east: 28.5 };
  const rows = await read(view);
  assert.equal(rows.length, MAX_VIEW_REGIONS);
  assert.equal(calls.filter(url => url.includes('/v3/')).length, MAX_VIEW_REGIONS);
});

test('uncovered wide viewports return no markers without failing or fetching regions', async () => {
  const snapshot = buildPublicSpotSnapshot([approved]);
  const { fetchJson, calls } = fakeFetch(snapshot);
  const read = createPublicSpotSnapshotReader({ fetchJson });
  const view = viewportAtZoom(5, -20, -60);
  assert.ok(regionsForBounds(view).length > MAX_VIEW_REGIONS);
  assert.deepEqual(await read(view), []);
  assert.equal(calls.some(url => url.includes('/v3/')), false);
  const closed = createPublicSpotSnapshotReader({ fetchJson: async url => {
    if (url.endsWith('/spot-snapshot-revocations')) return { ok: false, status: 503 };
    return { ok: true, json: async () => snapshot.manifest };
  } });
  await assert.rejects(closed(view), /Snapshot HTTP 503/);
});

test('revocation removes cached markers and survives an older snapshot revision', async () => {
  let time = 0;
  let revoked = [];
  let snapshot = buildPublicSpotSnapshot([approved], { publishedAt: '2026-10-30T00:00:00.000Z' });
  const read = createPublicSpotSnapshotReader({ now: () => time, fetchJson: async url => {
    const data = url.endsWith('/spot-snapshot-revocations') ? { format: 1, revoked }
      : url.endsWith('/manifest.json') ? snapshot.manifest : snapshot.files.get(url.split('/').at(-1));
    return { ok: Boolean(data), json: async () => data };
  } });
  assert.equal((await read(bounds)).length, 1);
  revoked = [approved.id]; time += 10001;
  assert.deepEqual(await read(bounds), []);
  snapshot = buildPublicSpotSnapshot([approved], { publishedAt: '2026-10-30T00:00:00.001Z' });
  time += 10001; revoked = [];
  assert.deepEqual(await read(bounds), []);
});

test('missing revocation feed fails closed and recovery requires a valid feed', async () => {
  const snapshot = buildPublicSpotSnapshot([approved]);
  let available = false;
  let time = 0;
  const read = createPublicSpotSnapshotReader({ now: () => time, fetchJson: async url => {
    if (url.endsWith('/spot-snapshot-revocations') && !available) return { ok: false, status: 503 };
    const data = url.endsWith('/spot-snapshot-revocations') ? { format: 1, revoked: [] }
      : url.endsWith('/manifest.json') ? snapshot.manifest : snapshot.files.get(url.split('/').at(-1));
    return { ok: true, json: async () => data };
  } });
  await assert.rejects(read(bounds), /Snapshot HTTP 503/);
  available = true; time += 10001;
  assert.equal((await read(bounds)).length, 1);
});

test('missing snapshot fails after bounded retries without a Firestore read', async () => {
  const snapshot = buildPublicSpotSnapshot([approved]);
  let requests = 0;
  const read = createPublicSpotSnapshotReader({ fetchJson: async url => {
    requests += 1;
    return { ok: false, status: 503, json: async () => snapshot.manifest };
  } });
  await assert.rejects(readSnapshotSpots(bounds, 300, read), /Snapshot HTTP 503/);
  assert.equal(requests, 2);
  const rows = [approved];
  const cache = rememberViewport(null, 'view-a', rows, 1000);
  assert.deepEqual(cachedViewport(cache, 'view-a', 2000), rows);
  assert.equal(cachedViewport(cache, 'view-a', 121000), null);
});

test('manifest switch invalidates edited and removed markers while old version stays immutable', async () => {
  let snapshot = buildPublicSpotSnapshot([approved], { publishedAt: '2026-10-30T00:00:00.000Z' });
  const oldFile = snapshot.manifest.regions[regionForPoint(approved.lat, approved.lng)];
  const available = new Map(snapshot.files);
  const calls = [];
  let time = 10000;
  const read = createPublicSpotSnapshotReader({ fetchJson: async url => {
    calls.push(url);
    const data = url.endsWith('/spot-snapshot-revocations') ? { format: 1, revoked: [] }
      : url.endsWith('manifest.json') ? snapshot.manifest : available.get(url.split('/').at(-1));
    return { ok: Boolean(data), json: async () => data };
  }, now: () => time });
  assert.equal((await read(bounds))[0].title, 'Castle');
  snapshot = buildPublicSpotSnapshot([{ ...approved, title: 'Edited' }], { publishedAt: '2026-10-30T00:00:00.001Z' });
  for (const [name, data] of snapshot.files) available.set(name, data);
  time += 5001;
  assert.equal((await read(bounds))[0].title, 'Edited');
  snapshot = buildPublicSpotSnapshot([], { publishedAt: '2026-10-30T00:00:00.002Z' });
  time += 5001;
  assert.deepEqual(await read(bounds), []);
  assert.equal(available.get(oldFile).spots[0].title, 'Castle');
  assert.equal(calls.filter(url => url.endsWith('manifest.json')).length, 3);
  snapshot = buildPublicSpotSnapshot([approved], { publishedAt: '2026-10-30T00:00:00.000Z' });
  time += 5001;
  await assert.rejects(read(bounds), /Stale snapshot manifest/);
});

test('malicious region payload fails closed and bounded retry recovers a transient failure', async () => {
  const snapshot = buildPublicSpotSnapshot([approved]);
  const filename = [...snapshot.files.keys()][0];
  const file = snapshot.files.get(filename);
  let attempts = 0;
  const read = createPublicSpotSnapshotReader({ fetchJson: async url => {
    if (url.endsWith('/spot-snapshot-revocations')) return { ok: true, json: async () => ({ format: 1, revoked: [] }) };
    if (url.endsWith('manifest.json')) return { ok: true, json: async () => snapshot.manifest };
    attempts += 1;
    if (attempts === 1) return { ok: false, status: 503 };
    return { ok: true, json: async () => file };
  } });
  assert.equal((await read(bounds))[0].id, approved.id);
  assert.equal(attempts, 2);
  const malicious = createPublicSpotSnapshotReader({ fetchJson: async url => ({ ok: true, json: async () => url.endsWith('/spot-snapshot-revocations')
    ? { format: 1, revoked: [] } : url.endsWith('manifest.json')
      ? snapshot.manifest : { ...file, spots: [{ ...file.spots[0], created_by_uid: 'private' }] } }) });
  await assert.rejects(malicious(bounds), /Invalid snapshot region/);
});

test('duplicate and out-of-order trusted events cannot resurrect a tombstoned spot', () => {
  const state = new Map();
  assert.equal(applyTrustedSnapshotChange(state, { id: approved.id, revision: 1, spot: approved }), true);
  assert.equal(applyTrustedSnapshotChange(state, { id: approved.id, revision: 3, spot: null }), true);
  assert.equal(applyTrustedSnapshotChange(state, { id: approved.id, revision: 2, spot: approved }), false);
  assert.equal(applyTrustedSnapshotChange(state, { id: approved.id, revision: 3, spot: approved }), false);
  assert.deepEqual(buildPublicSpotSnapshot(currentSnapshotRecords(state)).manifest.regions, {});
});

test('reported, flagged, private and malformed records are excluded and artifacts are content verified', () => {
  const snapshot = buildPublicSpotSnapshot([approved, { ...approved, id: 'open-flag' },
    { ...approved, id: 'flag-count', flag_count: 1 }, { ...approved, id: 'bad-location', lat: 500 },
    { ...approved, id: 'pending', status: 'pending_trust' }], { excludedIds: new Set(['open-flag']) });
  assert.equal(snapshot.stats.included, 1);
  assert.equal(validateSnapshotArtifacts(snapshot), true);
  const filename = [...snapshot.files.keys()][0];
  const corrupted = new Map(snapshot.files);
  corrupted.set(filename, { ...corrupted.get(filename), spots: [{ ...corrupted.get(filename).spots[0], title: 'Tampered' }] });
  assert.throws(() => validateSnapshotArtifacts({ manifest: snapshot.manifest, files: corrupted }), /Corrupt or oversized region file/);
});

test('staging target guard rejects production, missing approval and non-loopback emulator', () => {
  assert.doesNotThrow(() => assertPublisherTarget({ mode: 'emulator', projectId: 'demo-spotfinder-snapshots', emulatorHost: '127.0.0.1:8080' }));
  assert.throws(() => assertPublisherTarget({ mode: 'emulator', projectId: 'spotfinderapp-cdc7b', emulatorHost: '127.0.0.1:8080' }));
  assert.throws(() => assertPublisherTarget({ mode: 'emulator', projectId: 'demo-spotfinder-snapshots', emulatorHost: 'firestore.googleapis.com:443' }));
  assert.throws(() => assertPublisherTarget({ mode: 'staging', projectId: 'spotfinderapp-cdc7b', approved: true }));
  assert.throws(() => assertPublisherTarget({ mode: 'staging', projectId: 'spotfinder-2-staging' }));
});

test('snapshot feature is isolated to emulator development or explicit staging builds', () => {
  assert.equal(snapshotFeatureEnabled({ dev: true, stage: 'emulator', emulatorOnly: 'true', flag: 'true' }), true);
  assert.equal(snapshotFeatureEnabled({ dev: false, mode: 'snapshot-staging', stage: 'staging', flag: 'true' }), true);
  assert.equal(snapshotFeatureEnabled({ dev: false, mode: 'production', stage: 'production', flag: 'true' }), false);
  assert.equal(snapshotFeatureEnabled({ dev: true, stage: 'production', emulatorOnly: 'false', flag: 'true' }), false);
  assert.equal(snapshotFeatureEnabled({ dev: false, mode: 'snapshot-staging', stage: 'production', flag: 'true' }), false);
  assert.equal(snapshotFeatureEnabled({ dev: false, mode: 'snapshot-production', stage: 'production', flag: 'true' }), false);
  assert.equal(snapshotFeatureEnabled({ dev: false, mode: 'snapshot-production', stage: 'production', flag: 'true', productionRelease: 'true' }), true);
});

test('original map requires its separate flag and an isolated snapshot target', () => {
  const staging = { dev: false, mode: 'snapshot-staging', stage: 'staging', flag: 'true' };
  assert.equal(originalMapSnapshotFeatureEnabled({ ...staging, originalFlag: 'true' }), true);
  assert.equal(originalMapSnapshotFeatureEnabled({ ...staging, originalFlag: 'false' }), false);
  assert.equal(originalMapSnapshotFeatureEnabled({ ...staging, flag: 'false', originalFlag: 'true' }), false);
  assert.equal(originalMapSnapshotFeatureEnabled({ dev: false, mode: 'production', stage: 'production',
    flag: 'true', originalFlag: 'true' }), false);
});

test('publisher stages and validates before switching, skips unchanged regions and rejects concurrent writes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spotfinder-snapshot-test-'));
  const output = join(root, 'spot-snapshots');
  try {
    const first = await writePublicSpotSnapshot([approved], output);
    const original = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
    assert.equal(first.stats.changedRegions, 1);
    const repeat = await writePublicSpotSnapshot([approved], output);
    assert.equal(repeat.stats.changedRegions, 0);
    assert.equal(repeat.manifest.publishedAt, original.publishedAt);
    const originalFile = Object.values(original.regions)[0];
    const directory = snapshotRegionDirectory(original.format);
    await unlink(join(output, directory, originalFile));
    const repaired = await writePublicSpotSnapshot([approved], output);
    assert.equal(repaired.stats.changedRegions, 1);
    assert.equal(repaired.manifest.revision, original.revision);
    await assert.rejects(writePublicSpotSnapshot([approved, { ...approved, id: approved.id }], output), /Duplicate visible spot ID/);
    assert.deepEqual(JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')), original);
    const [a, b] = await Promise.allSettled([
      writePublicSpotSnapshot([{ ...approved, title: 'Edited A' }], output),
      writePublicSpotSnapshot([{ ...approved, title: 'Edited B' }], output),
    ]);
    assert.equal([a, b].filter(result => result.status === 'fulfilled').length, 1);
    assert.equal([a, b].filter(result => result.status === 'rejected').length, 1);
    const published = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
    const region = published.regions[regionForPoint(approved.lat, approved.lng)];
    assert.ok((await readdir(join(output, directory))).includes(region));
    assert.equal(validateSnapshotArtifacts({ manifest: published,
      files: new Map([[region, JSON.parse(await readFile(join(output, directory, region), 'utf8'))]]) }), true);
    assert.ok(repeat.stats.backup);
  } finally {
    if (!resolve(root).startsWith(resolve(tmpdir(), 'spotfinder-snapshot-test-'))) throw new Error('Unsafe test cleanup');
    await rm(root, { recursive: true, force: true });
  }
});

test('format 3 omits invariant and default fields but decodes to the same summary', () => {
  const summary = toPublicSnapshotSpot(approved);
  const compact = encodeSnapshotSpot(summary);
  assert.deepEqual(Object.keys(compact).sort(), ['created_date', 'id', 'image_url', 'lat', 'lng', 'rating', 'rating_count', 'tags', 'title'].sort());
  assert.equal(Object.hasOwn(compact, 'is_public'), false);
  assert.equal(Object.hasOwn(compact, 'status'), false);
  assert.equal(Object.hasOwn(compact, 'resolved_title'), false);
  assert.equal(Object.hasOwn(compact, 'resolved_category'), false);
  assert.equal(Object.hasOwn(compact, 'locality'), false);
  assert.equal(Buffer.byteLength(JSON.stringify(compact)) < Buffer.byteLength(JSON.stringify(summary)), true);
  assert.deepEqual(decodeSnapshotSpot(compact), summary);
});

test('format 3 keeps title and category fallbacks after rehydration', () => {
  const fallback = { ...approved, id: 'fallback', title: '', tags: [], category: undefined,
    spot_type: 'castle', resolved_category: undefined, rating: 0, rating_count: 0 };
  const summary = toPublicSnapshotSpot(fallback);
  assert.equal(summary.title, '');
  assert.equal(summary.resolved_title, 'Castle');
  assert.equal(summary.resolved_category, 'castle');
  const compact = encodeSnapshotSpot(summary);
  const decoded = decodeSnapshotSpot(compact);
  assert.equal(decoded.title, '');
  assert.equal(decoded.resolved_title, 'Castle');
  assert.equal(decoded.resolved_category, 'castle');
  assert.equal(decoded.is_public, true);
  assert.equal(decoded.status, 'published');
  assert.equal(decoded.locality, '');
  assert.equal(decoded.access_difficulty, '');
  assert.equal(decoded.has_social, false);
  assert.deepEqual(decoded.tags, []);
});

test('format 3 output is deterministic and omits invariant fields from raw artifacts', () => {
  const first = buildPublicSpotSnapshot([approved]);
  const second = buildPublicSpotSnapshot([approved]);
  assert.equal(first.manifest.format, 3);
  assert.equal(first.manifest.revision, second.manifest.revision);
  const raw = JSON.stringify(first.files);
  assert.equal(raw.includes('"is_public"'), false);
  assert.equal(raw.includes('"status"'), false);
  assert.equal(raw.includes('"resolved_title"'), false);
  assert.equal(validateSnapshotArtifacts(first), true);
});

test('format 2 artifacts remain readable and mixed formats are rejected', async () => {
  const legacy = buildPublicSpotSnapshot([approved], { format: 2 });
  assert.equal(legacy.manifest.format, 2);
  const legacySpot = [...legacy.files.values()][0].spots[0];
  assert.equal(legacySpot.status, 'published');
  assert.equal(Object.hasOwn(legacySpot, 'resolved_title'), true);
  assert.equal(validateSnapshotArtifacts(legacy), true);
  assert.deepEqual(Object.keys(legacy.manifest.regions), Object.keys(buildPublicSpotSnapshot([approved]).manifest.regions));
  const read = createPublicSpotSnapshotReader({ fetchJson: fakeFetch(legacy).fetchJson });
  const rows = await read(bounds);
  assert.deepEqual(rows.map(spot => spot.id), ['approved']);
  assert.equal(rows[0].resolved_title, 'Castle');

  const current = buildPublicSpotSnapshot([approved]);
  const filename = [...current.files.keys()][0];
  const mixed = new Map([[filename, { ...current.files.get(filename), format: 2 }]]);
  assert.throws(() => validateSnapshotArtifacts({ manifest: current.manifest, files: mixed }), /Corrupt or oversized region file/);
  const mixedRead = createPublicSpotSnapshotReader({ fetchJson: async url => {
    const data = url.endsWith('/spot-snapshot-revocations') ? { format: 1, revoked: [] }
      : url.endsWith('/manifest.json') ? current.manifest : mixed.get(url.split('/').at(-1));
    return { ok: Boolean(data), json: async () => data };
  } });
  await assert.rejects(mixedRead(bounds), /Invalid snapshot region/);
});

test('unsupported snapshot versions and unknown compact keys are rejected', async () => {
  assert.throws(() => buildPublicSpotSnapshot([approved], { format: 4 }), /Unsupported snapshot format/);
  const current = buildPublicSpotSnapshot([approved]);
  const filename = [...current.files.keys()][0];
  const file = current.files.get(filename);
  const injected = new Map([[filename, { ...file,
    spots: [{ ...file.spots[0], created_by_uid: 'private-uid' }] }]]);
  assert.throws(() => validateSnapshotArtifacts({ manifest: current.manifest, files: injected }), /Corrupt or oversized region file/);
  assert.throws(() => decodeSnapshotSpot({ ...file.spots[0], created_by_uid: 'private-uid' }), /Invalid compact snapshot spot/);
  const unsupported = createPublicSpotSnapshotReader({ fetchJson: async url => {
    const data = url.endsWith('/spot-snapshot-revocations') ? { format: 1, revoked: [] }
      : { ...current.manifest, format: 4 };
    return { ok: true, json: async () => data };
  } });
  await assert.rejects(unsupported(bounds), /Invalid snapshot manifest/);
});

test('Vite emits validated candidate only for explicit staging snapshot builds', async () => {
  const root = await mkdtemp(join(tmpdir(), 'spotfinder-snapshot-test-'));
  const output = join(root, 'spot-snapshots');
  const prior = process.env.SPOTFINDER_SNAPSHOT_CANDIDATE_DIRECTORY;
  try {
    await writePublicSpotSnapshot([approved], output);
    process.env.SPOTFINDER_SNAPSHOT_CANDIDATE_DIRECTORY = output;
    const { loadConfigFromFile } = await import('vite');
    const loaded = await loadConfigFromFile({ command: 'build', mode: 'snapshot-staging' }, resolve('vite.config.js'));
    const plugin = loaded.config.plugins.find(candidate => candidate.name === 'spotfinder-staging-snapshot-candidate');
    const emitted = [];
    plugin.configResolved({ command: 'build', mode: 'snapshot-staging', env: { VITE_SPOTFINDER_STAGE: 'staging' } });
    plugin.generateBundle.call({ emitFile: file => emitted.push(file) });
    assert.deepEqual(emitted.map(file => file.fileName).sort(), [
      'spot-snapshots/manifest.json',
      `spot-snapshots/v3/${[...buildPublicSpotSnapshot([approved]).files.keys()][0]}`,
    ].sort());
    plugin.configResolved({ command: 'build', mode: 'production', env: { VITE_SPOTFINDER_STAGE: 'production' } });
    const productionEmitted = [];
    plugin.generateBundle.call({ emitFile: file => productionEmitted.push(file) });
    assert.deepEqual(productionEmitted, []);
  } finally {
    if (prior === undefined) delete process.env.SPOTFINDER_SNAPSHOT_CANDIDATE_DIRECTORY;
    else process.env.SPOTFINDER_SNAPSHOT_CANDIDATE_DIRECTORY = prior;
    if (!resolve(root).startsWith(resolve(tmpdir(), 'spotfinder-snapshot-test-'))) throw new Error('Unsafe test cleanup');
    await rm(root, { recursive: true, force: true });
  }
});
