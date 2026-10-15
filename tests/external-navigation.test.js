import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NAVIGATION_PROVIDERS, buildExternalNavigationUrl, navigationCoordinates } from '../src/lib/externalNavigation.js';

const destination = { lat: 50.0755, lng: 14.4378, title: 'Chosen viewpoint' };

test('all three external providers receive the selected coordinates', () => {
  assert.deepEqual(NAVIGATION_PROVIDERS.map(provider => provider.label), ['Google Maps', 'Mapy.com', 'Apple Maps']);
  const google = new URL(buildExternalNavigationUrl('google', destination));
  assert.equal(google.host, 'www.google.com');
  assert.equal(google.searchParams.get('destination'), '50.0755,14.4378');
  assert.equal(google.searchParams.get('dir_action'), 'navigate');

  const mapy = new URL(buildExternalNavigationUrl('mapy', destination));
  assert.equal(mapy.host, 'mapy.com');
  assert.equal(mapy.searchParams.get('end'), '14.4378,50.0755');
  assert.equal(mapy.searchParams.get('navigate'), 'true');

  const apple = new URL(buildExternalNavigationUrl('apple', destination));
  assert.equal(apple.host, 'maps.apple.com');
  assert.equal(apple.searchParams.get('destination'), '50.0755,14.4378');
});

test('longitude aliases work and invalid destinations never make a handoff URL', () => {
  assert.deepEqual(navigationCoordinates({ lat: 0, lon: 0 }), { lat: 0, lng: 0 });
  assert.equal(new URL(buildExternalNavigationUrl('mapy', { lat: 0, lon: 0 })).searchParams.get('end'), '0,0');
  for (const invalid of [{}, { lat: null, lng: 14 }, { lat: '', lng: 14 }, { lat: 50, lng: ' ' }, { lat: 91, lng: 14 }, { lat: 50, lng: 181 }]) {
    assert.equal(buildExternalNavigationUrl('google', invalid), null);
  }
  assert.equal(buildExternalNavigationUrl('unknown', destination), null);
});

test('Home presents external choices without mounting internal guidance or route drawing', () => {
  const home = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
  const map = readFileSync(new URL('../src/components/map/MapLibreMap.jsx', import.meta.url), 'utf8');
  const chooser = readFileSync(new URL('../src/components/navigation/NavigationProviderSheet.jsx', import.meta.url), 'utf8');
  assert.match(home, /<NavigationProviderSheet destination=\{navigationDestination\}/);
  assert.doesNotMatch(home, /NavigationPanel|navRouteData|navTarget/);
  assert.doesNotMatch(map, /route-outline|route-line/);
  assert.doesNotMatch(chooser, /nearestParking|onInternalNavigate|SpotFinder navigation/);
  assert.match(chooser, /href=\{buildExternalNavigationUrl\(provider.id, destination\)\}/);
});
