import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSpotDisplayName, getSpotImageInfo, getSpotImagePresentation, getSpotLocationLabel,
  getVerifiedSpotCategory, isMeaningfulSpotTitle, isUsableSpotImageUrl, resolveSpotTitle,
  spotMatchesSearch,
} from '../src/lib/spotPresentation.js';
import { applyReviewedLegacyIdentity } from '../src/lib/reviewedLegacySpots.js';

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

test('reviewed legacy identities repair known generic records without replacing real names', () => {
  const hlavatice = applyReviewedLegacyIdentity({ id: 'K20qivFHwrGzBgBoYZW2', title: 'Spot', tags: ['Viewpoint'] });
  assert.equal(getSpotDisplayName(hlavatice), 'Hlavatice');
  assert.equal(hlavatice.locality, 'Turnov');
  assert.equal(hlavatice.identity_evidence.distance_m, 2);
  assert.equal(applyReviewedLegacyIdentity({ id: 'K20qivFHwrGzBgBoYZW2', title: 'My own tower' }).title, 'My own tower');
  assert.equal(getSpotDisplayName(applyReviewedLegacyIdentity({ id: 'unknown', title: 'Spot', spot_type: 'general' })), 'Unnamed place');
  assert.equal(spotMatchesSearch(hlavatice, 'Hlavatice'), true);
  assert.equal(spotMatchesSearch(hlavatice, 'Turnov'), true);
  for (const [id, expected] of Object.entries({
    AIyFTk1eTE7gD5INyomX: 'Blejski grad',
    N9TILMoRCl4dN5Ah7plP: 'Zugspitze',
    REfS8qWjqf1HSaRIoSju: 'Schloss Neuschwanstein',
    T0yooHmhTpf4xS0NjAXm: 'Zamek w Malborku',
    YfzdxI4GvZqCGDdR4BnG: 'Pyramidenkogel',
  })) assert.equal(getSpotDisplayName(applyReviewedLegacyIdentity({ id, title: 'Unnamed spot' })), expected);
});

test('legacy raster data images render while unsafe or oversized data URLs fall back', () => {
  const jpeg = `data:image/jpeg;base64,${'a'.repeat(128)}`;
  assert.equal(isUsableSpotImageUrl(jpeg), true);
  assert.equal(isUsableSpotImageUrl('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(isUsableSpotImageUrl('javascript:alert(1)'), false);
  assert.equal(isUsableSpotImageUrl(`data:image/jpeg;base64,${'a'.repeat(2 * 1024 * 1024)}`), false);
  assert.deepEqual(getSpotImageInfo({ image_url: jpeg }), {
    url: jpeg, source: 'legacy_embedded_upload', creator: null, permissionBasis: null,
    attribution: null, sourceUrl: null, locationMatchConfidence: 'unreviewed', needsReview: true,
  });
  assert.equal(getSpotImagePresentation({ image_url: jpeg }).kind, 'image');
  assert.deepEqual(getSpotImagePresentation({ image_url: jpeg }, { loadFailed: true }), { kind: 'fallback', reason: 'load-error' });
  assert.deepEqual(getSpotImagePresentation({}), { kind: 'fallback', reason: 'missing' });
  assert.deepEqual(getSpotImagePresentation({ image_url: 'broken-url' }), { kind: 'fallback', reason: 'invalid' });
});
