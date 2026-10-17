import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveLocationController, normalizeDeviceFix, shouldDisplayFix } from '../src/lib/liveLocation.js';
import { cachedViewportRows, canReuseNearby, filterViewportRows } from '../src/lib/mapQueryCache.js';

const position = (lat, lng, timestamp = Date.now(), accuracy = 12) => ({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp });

test('one watcher is shared, paused in background, resumed once, and stopped', async () => {
  const watches = new Map();
  let nextId = 0;
  let peak = 0;
  const document = { hidden: false };
  const fixes = [];
  const geolocation = {
    watchPosition(success, error) { watches.set(++nextId, { success, error }); peak = Math.max(peak, watches.size); return nextId; },
    clearWatch(id) { watches.delete(id); },
  };
  const tracker = createLiveLocationController({ geolocation, document, onFix: fix => fixes.push(fix), onError: () => {} });
  const first = tracker.start();
  const second = tracker.start();
  assert.equal(watches.size, 1);
  watches.values().next().value.success(position(50, 14));
  assert.deepEqual((await first).position, [50, 14]);
  assert.deepEqual((await second).position, [50, 14]);
  const firstTimestamp = tracker.getLatest().timestamp;
  watches.values().next().value.success(position(51, 14, firstTimestamp + 1000));
  assert.equal(fixes.length, 1);
  watches.values().next().value.success(position(50.0001, 14, firstTimestamp + 2000));
  assert.equal(fixes.length, 2);
  document.hidden = true;
  tracker.onVisibilityChange();
  assert.equal(watches.size, 0);
  document.hidden = false;
  tracker.onVisibilityChange();
  tracker.onVisibilityChange();
  assert.equal(watches.size, 1);
  tracker.stop();
  assert.equal(watches.size, 0);
  assert.equal(peak, 1);
  assert.equal(fixes.length, 2);
});

test('invalid, stale and implausible fixes are rejected; denial stops tracking', async () => {
  const now = Date.now();
  assert.equal(normalizeDeviceFix(position(50, 14, now - 61_000), now), null);
  assert.equal(normalizeDeviceFix(position(91, 14, now), now), null);
  assert.equal(normalizeDeviceFix(position(50, 14, now, -1), now), null);
  const prior = normalizeDeviceFix(position(50, 14, now - 1000), now);
  assert.equal(shouldDisplayFix(normalizeDeviceFix(position(50.000001, 14, now), now), prior), false);
  assert.equal(shouldDisplayFix(normalizeDeviceFix(position(50.001, 14, now), now), prior), true);
  let cleared = false;
  let deny;
  const tracker = createLiveLocationController({
    geolocation: { watchPosition(_success, error) { deny = error; return 1; }, clearWatch() { cleared = true; } },
    document: { hidden: false }, onFix: () => {}, onError: () => {},
  });
  const waiting = tracker.start();
  deny({ code: 1 });
  assert.equal(await waiting, null);
  assert.equal(cleared, true);
  assert.equal(tracker.isWatching(), false);
});

test('viewport and Nearby caches reuse only complete, fresh geographic coverage', () => {
  const now = Date.now();
  const view = { south: 49, west: 13, north: 51, east: 15 };
  const viewport = { at: now, bounds: { south: 48, west: 12, north: 52, east: 16 }, rows: [{ lat: 50, lng: 14 }, { lat: 47, lng: 14 }] };
  assert.equal(cachedViewportRows(viewport, view, now).length, 1);
  assert.equal(filterViewportRows([{ lat: 50, lng: -179 }], { south: 49, north: 51, west: 180, east: 182 }).length, 1);
  assert.equal(cachedViewportRows({ ...viewport, at: now - 120_000 }, view, now), null);
  assert.equal(cachedViewportRows({ ...viewport, rows: Array(500).fill({ lat: 50, lng: 14 }) }, view, now), null);
  const nearby = { origin: [50, 14], radius: 6, at: now, result: { complete: true } };
  assert.equal(canReuseNearby(nearby, [50, 14], 5, now), true);
  assert.equal(canReuseNearby(nearby, [50.001, 14], 5, now), true);
  assert.equal(canReuseNearby(nearby, [50.05, 14], 5, now), false);
  assert.equal(canReuseNearby({ ...nearby, result: { complete: false } }, [50, 14], 5, now), false);
});
