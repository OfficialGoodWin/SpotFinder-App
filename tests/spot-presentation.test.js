import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSpotDisplayName, getSpotImageInfo, getSpotLocationLabel, getVerifiedSpotCategory,
  isMeaningfulSpotTitle, resolveSpotTitle,
} from '../src/lib/spotPresentation.js';

test('keeps a meaningful user-provided title', () => {
  assert.equal(getSpotDisplayName({ title: 'Devil’s Bridge', tags: ['Viewpoint'] }), 'Devil’s Bridge');
});

test('replaces legacy generic titles with verified POI names', () => {
  assert.equal(getSpotDisplayName({ title: 'Spot', poi_match: { name: 'Old Quarry' } }), 'Old Quarry');
  assert.equal(getSpotDisplayName({ title: 'Unnamed viewpoint', poi_match: { name: 'Hrad Egerberk' } }), 'Hrad Egerberk');
  assert.equal(getSpotDisplayName({ displayName: 'Legacy tower', title: null }), 'Legacy tower');
});

test('uses an honest category fallback without inventing a proper name', () => {
  assert.equal(getSpotDisplayName({ title: '', tags: ['Viewpoint'] }), 'Unnamed viewpoint');
  assert.equal(getSpotDisplayName({ spot_type: 'general' }), 'Unnamed place');
  assert.equal(isMeaningfulSpotTitle(' Location '), false);
  assert.equal(isMeaningfulSpotTitle('Unnamed viewpoint'), false);
});

test('verified castle identity wins over a subjective viewpoint tag', () => {
  const castle = {
    title: 'Unnamed viewpoint',
    tags: ['Viewpoint'],
    poi_match: { categories: ['heritage.castle'], tags: { historic: 'castle' } },
  };
  assert.equal(getVerifiedSpotCategory(castle), 'castle');
  assert.deepEqual(resolveSpotTitle(castle), {
    title: 'Unnamed castle', source: 'verified_category_fallback', confidence: 'medium',
  });
});

test('uses localized OSM names and geographically verified Wikidata labels only', () => {
  assert.equal(getSpotDisplayName({ poi_match: { tags: { 'name:cs': 'Hrad Loket', 'name:en': 'Loket Castle' } } }, 'cs'), 'Hrad Loket');
  assert.equal(getSpotDisplayName({ poi_match: { wikidata_label: 'Distant Castle', wikidata: 'Q1', distance_m: 900 } }), 'Unnamed place');
  assert.equal(getSpotDisplayName({ poi_match: { wikidata_label: 'Matched Castle', wikidata: 'Q2', distance_m: 20 } }), 'Matched Castle');
  assert.equal(getSpotDisplayName({ tags: ['Viewpoint'], poi_match: { name: 'Nearby unrelated castle', match_confidence: 'review', tags: { historic: 'castle' } } }), 'Unnamed viewpoint');
});

test('prefers human location labels and keeps coordinates as a fallback', () => {
  assert.equal(getSpotLocationLabel({ city: 'Brno', lat: 49.2, lng: 16.6 }), 'Brno');
  assert.equal(getSpotLocationLabel({ lat: 49.1951, lng: 16.6068 }), '49.1951, 16.6068');
  assert.equal(getSpotLocationLabel({ location: '49.1, 16.6', poi_match: { locality: 'Loket' } }), 'Loket');
});

test('missing or invalid imagery produces no documentary image claim', () => {
  assert.equal(getSpotImageInfo({}), null);
  assert.equal(getSpotImageInfo({ image_url: 'javascript:alert(1)' }), null);
  assert.deepEqual(getSpotImageInfo({
    image_url: 'https://example.test/castle.jpg',
    photo_metadata: [{ url: 'https://example.test/castle.jpg', source: 'user_upload', permission_basis: 'uploader_attestation', location_match_confidence: 'user_placed' }],
  }), {
    url: 'https://example.test/castle.jpg', source: 'user_upload', creator: null,
    permissionBasis: 'uploader_attestation', attribution: null, sourceUrl: null,
    locationMatchConfidence: 'user_placed', needsReview: false,
  });
});
