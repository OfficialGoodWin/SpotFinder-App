import test from 'node:test';
import assert from 'node:assert/strict';
import { clampMapZoom, createSpotFocusRequest, getSpotCameraOptions, MAP_MAX_ZOOM } from '../src/lib/mapSpotFocus.js';

test('spot focus preserves latitude/longitude input and emits MapLibre longitude/latitude center', () => {
  const request = createSpotFocusRequest({ id: 'castle-1', lat: 50.357, lng: 13.251 }, 'my-spots');
  assert.deepEqual(request.position, [50.357, 13.251]);
  assert.equal(request.spotId, 'castle-1');
  assert.equal(request.source, 'my-spots');
  assert.deepEqual(getSpotCameraOptions(request, { currentZoom: 12 }).center, [13.251, 50.357]);
  assert.equal(createSpotFocusRequest({ id: 'broken', lat: 13, lng: 500 }), null);
  for (const source of ['marker', 'my-spots', 'nearby', 'search', 'shared-link']) {
    assert.deepEqual(createSpotFocusRequest({ id: 'castle-1', lat: 50.357, lng: 13.251 }, source).position, [50.357, 13.251]);
  }
});

test('spot camera is restrained, offsets the marker above the detail sheet, and respects reduced motion', () => {
  const request = createSpotFocusRequest({ id: 'one', lat: 50, lng: 14 }, 'marker');
  const mobile = getSpotCameraOptions(request, { viewportWidth: 390, viewportHeight: 844, currentZoom: 10 });
  assert.equal(mobile.zoom, 14.5);
  assert.ok(mobile.offset[1] < 0);
  assert.ok(mobile.offset[1] >= -150);
  const shortViewport = getSpotCameraOptions(request, { viewportWidth: 800, viewportHeight: 300, currentZoom: 15 });
  assert.ok(shortViewport.offset[1] >= -38, 'marker card remains inside a short in-app map viewport');
  const close = getSpotCameraOptions(request, { viewportWidth: 1200, viewportHeight: 800, currentZoom: 19, reducedMotion: true });
  assert.equal(close.zoom, MAP_MAX_ZOOM);
  assert.equal(close.duration, 0);
});

test('all requested camera zooms are capped at the supported map maximum', () => {
  assert.equal(MAP_MAX_ZOOM, 19);
  assert.equal(clampMapZoom(22), 19);
  assert.equal(clampMapZoom('18.5'), 18.5);
  assert.equal(clampMapZoom(Number.POSITIVE_INFINITY), 19);

  const request = createSpotFocusRequest({ id: 'close', lat: 50, lng: 14 }, 'nearby');
  assert.equal(getSpotCameraOptions(request, { currentZoom: 18 }).zoom, 18);
  assert.equal(getSpotCameraOptions(request, { currentZoom: 22 }).zoom, 19);
});
