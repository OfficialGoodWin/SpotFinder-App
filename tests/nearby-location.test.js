import test from 'node:test';
import assert from 'node:assert/strict';
import { freshNearbyFix, nearbyLocationFailure, NEARBY_LOCATION_MAX_AGE_MS } from '../src/lib/nearbyLocation.js';

test('reuses only a valid recent one-time location fix', () => {
  const now = 1000000;
  assert.deepEqual(freshNearbyFix({ position: [50.2, 12.2], timestamp: now - 1000 }, now), [50.2, 12.2]);
  assert.equal(freshNearbyFix({ position: [50.2, 12.2], timestamp: now - NEARBY_LOCATION_MAX_AGE_MS - 1 }, now), null);
  assert.equal(freshNearbyFix({ position: [999, 12.2], timestamp: now }, now), null);
  assert.equal(freshNearbyFix(null, now), null);
});

test('location failures distinguish denied, unavailable, timeout, stale and unsupported', () => {
  assert.match(nearbyLocationFailure(1), /denied/);
  assert.match(nearbyLocationFailure(2), /could not determine/);
  assert.match(nearbyLocationFailure(3), /timed out/);
  assert.match(nearbyLocationFailure(0), /cannot provide/);
  assert.match(nearbyLocationFailure(3, true), /out of date/);
});
