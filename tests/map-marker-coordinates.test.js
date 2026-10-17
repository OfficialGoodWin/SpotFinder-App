import test from 'node:test';
import assert from 'node:assert/strict';
import { attachMarkerAt, validMarkerLngLat } from '../src/lib/mapMarkerCoordinates.js';

test('marker coordinates validate range, finiteness, ordering and zero', () => {
  assert.deepEqual(validMarkerLngLat(0, 0), [0, 0]);
  assert.deepEqual(validMarkerLngLat(14.4, 50.1), [14.4, 50.1]);
  assert.deepEqual(validMarkerLngLat('14.4', '50.1'), [14.4, 50.1]);
  for (const pair of [[undefined, 50], [14, undefined], [null, 50], ['', 50], [181, 50], [14, 91], [NaN, 50], [Infinity, 50]]) {
    assert.equal(validMarkerLngLat(...pair), null);
  }
});

test('a marker is positioned before attachment and invalid GPS never attaches', () => {
  const calls = [];
  const marker = {
    setLngLat(value) { calls.push(['setLngLat', value]); return this; },
    addTo(map) { calls.push(['addTo', map]); assert.equal(calls[0][0], 'setLngLat'); return this; },
  };
  const map = {};
  assert.equal(attachMarkerAt(marker, map, null), null);
  assert.equal(attachMarkerAt(marker, map, [undefined, 50]), null);
  assert.deepEqual(calls, []);
  assert.equal(attachMarkerAt(marker, map, [14, 50]), marker);
  assert.deepEqual(calls, [['setLngLat', [14, 50]], ['addTo', map]]);
  marker.setLngLat([14.01, 50.01]);
  assert.equal(calls.filter(([name]) => name === 'addTo').length, 1);
});
