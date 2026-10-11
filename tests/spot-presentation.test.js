import test from 'node:test';
import assert from 'node:assert/strict';
import { getSpotDisplayName, getSpotLocationLabel, isMeaningfulSpotTitle } from '../src/lib/spotPresentation.js';

test('keeps a meaningful user-provided title', () => {
  assert.equal(getSpotDisplayName({ title: 'Devil’s Bridge', tags: ['Viewpoint'] }), 'Devil’s Bridge');
});

test('replaces legacy generic titles with verified POI names', () => {
  assert.equal(getSpotDisplayName({ title: 'Spot', poi_match: { name: 'Old Quarry' } }), 'Old Quarry');
});

test('uses an honest category fallback without inventing a proper name', () => {
  assert.equal(getSpotDisplayName({ title: '', tags: ['Viewpoint'] }), 'Unnamed viewpoint');
  assert.equal(getSpotDisplayName({ spot_type: 'general' }), 'Unnamed place');
  assert.equal(isMeaningfulSpotTitle(' Location '), false);
});

test('prefers human location labels and keeps coordinates as a fallback', () => {
  assert.equal(getSpotLocationLabel({ city: 'Brno', lat: 49.2, lng: 16.6 }), 'Brno');
  assert.equal(getSpotLocationLabel({ lat: 49.1951, lng: 16.6068 }), '49.195, 16.607');
});
