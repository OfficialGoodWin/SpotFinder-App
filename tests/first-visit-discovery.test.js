import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowWelcome } from '../src/lib/discoveryExperience.js';
import { isFeaturedEligible, selectFeaturedSpots } from '../src/lib/featuredDiscovery.js';
import { getPublicSpotPhotos } from '../src/lib/spotPresentation.js';
import { canonicalSpotUrl, shareSpotLink, spotIdFromLocation, validSpotId } from '../src/lib/spotLinks.js';
import { createSpotFocusRequest, getSpotCameraOptions } from '../src/lib/mapSpotFocus.js';

const photo = 'https://example.test/spot.webp';
const spot = {
  id: 'castle_01', is_public: true, status: 'published', lat: 50.1, lng: 14.4,
  spot_type: 'castle', title: 'Castle', image_url: photo,
  photo_metadata: [{ url: photo, source: 'user_upload', permission_basis: 'uploader_attestation', location_match_confidence: 'user_placed', attribution: 'A contributor' }],
};

test('welcome is shown once after consent, and can be dismissed', () => {
  assert.equal(shouldShowWelcome({ dismissed: false, consentDecided: true }), true);
  assert.equal(shouldShowWelcome({ dismissed: true, consentDecided: true }), false);
  assert.equal(shouldShowWelcome({ dismissed: false, consentDecided: false }), false);
});

test('featured selection keeps real published public destinations and approved photos first', () => {
  const noPhoto = { ...spot, id: 'ruin_02', spot_type: 'historic', image_url: null, photo_metadata: [] };
  const candidates = [
    { ...spot, id: 'private', is_public: false },
    { ...spot, id: 'pending', status: 'pending_trust' },
    { ...spot, id: 'hidden', status: 'hidden' },
    { ...spot, id: 'sensitive', discovery_state: 'sensitive' },
    { ...spot, id: 'toilet', spot_type: 'toilet' },
    noPhoto, spot,
  ];
  assert.equal(isFeaturedEligible(spot), true);
  assert.deepEqual(selectFeaturedSpots(candidates).map(item => item.id), ['castle_01', 'ruin_02']);
  assert.equal(getPublicSpotPhotos(selectFeaturedSpots([{ ...spot, id: 'legacy', photo_metadata: [] }])[0])[0].url, photo);
});

test('featured photographs follow the public gallery order, including legacy data', () => {
  const legacy = { ...spot, id: 'legacy', image_urls: ['javascript:bad', photo], photo_metadata: [] };
  assert.deepEqual(getPublicSpotPhotos(legacy).map(item => item.url), [photo]);
  assert.equal(getPublicSpotPhotos({ ...spot, image_url: null, image_urls: [] }).length, 0);
  assert.equal(getPublicSpotPhotos({ ...spot, is_public: false }).length, 0);
  assert.equal(getPublicSpotPhotos({ ...spot, status: 'draft' }).length, 0);
  assert.equal(getPublicSpotPhotos({ ...spot, image_url: 'https://example.test/drafts%2Fowner%2Fprivate.jpg', image_urls: [] }).length, 0);
  assert.equal(getPublicSpotPhotos({ ...spot, photo_metadata: [{ url: photo, source: 'poi_enrichment' }] }).length, 0);
  assert.equal(getPublicSpotPhotos({ ...spot, photo_metadata: [{ url: photo, source: 'user_upload', restricted: true }] }).length, 0);
});

test('canonical and legacy links identify the immutable spot ID across reloads', () => {
  assert.equal(canonicalSpotUrl('castle_01'), 'https://spot-finder-app.vercel.app/spot/castle_01');
  assert.deepEqual(spotIdFromLocation('/spot/castle_01', ''), { id: 'castle_01', isSpotLink: true });
  assert.deepEqual(spotIdFromLocation('/', '?spot=castle_01'), { id: 'castle_01', isSpotLink: true });
  assert.equal(validSpotId('../private'), false);
  assert.equal(canonicalSpotUrl('../private'), null);
  assert.equal(validSpotId(''), false);
});

test('guest sharing uses Web Share or copies only the canonical URL', async () => {
  const payloads = [];
  assert.equal(await shareSpotLink({ id: spot.id, title: spot.title, navigatorApi: { share: async payload => payloads.push(payload) } }), 'shared');
  assert.equal(payloads[0].url, canonicalSpotUrl(spot.id));
  assert.equal(payloads[0].title, spot.title);
  let copied;
  assert.equal(await shareSpotLink({ id: spot.id, title: spot.title, navigatorApi: { clipboard: { writeText: async value => { copied = value; } } } }), 'copied');
  assert.equal(copied, canonicalSpotUrl(spot.id));
  assert.equal(await shareSpotLink({ id: spot.id, title: spot.title, navigatorApi: {} }), 'unavailable');
});

test('a spot loaded later still creates one camera request at its own coordinates', () => {
  const focus = createSpotFocusRequest(spot, 'shared-link');
  assert.deepEqual(getSpotCameraOptions(focus, { currentZoom: 13 }).center, [14.4, 50.1]);
  assert.equal(createSpotFocusRequest({ ...spot, lat: 999 }, 'shared-link'), null);
});
