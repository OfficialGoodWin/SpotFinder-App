import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublicSpotPhotos, getSpotDisplayName, normalizeSpotPhotos, spotPhotoIdentity } from '../src/lib/spotPresentation.js';
import { normalizePoiPhotos, openingHoursLabel, safeWebsite } from '../src/lib/poiPresentation.js';
import { getSpotRating } from '../src/lib/spotDiscovery.js';

const photo = 'https://firebasestorage.googleapis.com/v0/b/spotfinder/o/community%2Fuser%2Fone.jpg?alt=media&token=old';
const duplicate = photo.replace('old', 'new');
const second = photo.replace('one.jpg', 'two.jpg');
const base = { is_public: true, status: 'published', image_urls: [photo, duplicate], image_url: photo };

test('community gallery keeps one distinct public image and preserves its metadata', () => {
  const spot = { ...base, photo_metadata: [{ url: photo, attribution: 'A contributor', license: 'CC BY' }] };
  assert.equal(spotPhotoIdentity(photo), spotPhotoIdentity(duplicate));
  assert.deepEqual(getPublicSpotPhotos(spot), [{ url: photo, metadata: spot.photo_metadata[0] }]);
  assert.equal(getPublicSpotPhotos({ ...spot, image_urls: [photo, second] }).length, 2);
  assert.deepEqual(getPublicSpotPhotos({ ...spot, image_urls: [], image_url: null }), []);
});

test('legacy photos render but private drafts and restricted metadata stay out of public galleries', () => {
  assert.deepEqual(getPublicSpotPhotos({ ...base, image_urls: [], image_url: photo, photo_metadata: [] }).map(item => item.url), [photo]);
  assert.equal(getPublicSpotPhotos({ ...base, is_public: false }).length, 0);
  assert.equal(getPublicSpotPhotos({ ...base, status: 'draft' }).length, 0);
  assert.equal(getPublicSpotPhotos({ ...base, image_urls: ['https://example.test/drafts%2Fuser%2Fphoto.jpg'], image_url: null }).length, 0);
  assert.equal(getPublicSpotPhotos({ ...base, photo_metadata: [{ url: photo, restricted: true }] }).length, 0);
  assert.equal(normalizeSpotPhotos({ ...base, image_urls: [photo, second] }).length, 2);
});

test('long Czech names and genuine unnamed fallbacks use one shared title helper', () => {
  assert.equal(getSpotDisplayName({ title: 'Vyhlídka na Podměstský rybník (Čáslav)' }), 'Vyhlídka na Podměstský rybník (Čáslav)');
  assert.equal(getSpotDisplayName({ title: 'Unnamed place', place_name: 'Galerie Leica' }), 'Galerie Leica');
  assert.equal(getSpotDisplayName({ title: 'Unnamed viewpoint', spot_type: 'viewpoint' }), 'Viewpoint');
  assert.equal(getSpotDisplayName({}), 'Community spot');
});

test('POI hours stay factual and links accept only websites', () => {
  assert.equal(openingHoursLabel('Mo-Fr 09:00-18:00; PH off'), 'Mo-Fr 09:00-18:00; PH off');
  assert.equal(openingHoursLabel('24/7'), 'Open 24/7');
  assert.equal(openingHoursLabel(null), null);
  assert.equal(safeWebsite('galerieleica.cz'), 'https://galerieleica.cz/');
  assert.equal(safeWebsite('javascript:alert(1)'), null);
  assert.equal(safeWebsite('data:text/html,x'), null);
});

test('Wikimedia credit and source survive POI gallery normalization without invented ratings', () => {
  const commons = { url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Photo.jpg?width=1200', credit: 'Photo: Author (CC BY-SA)', source: 'https://commons.wikimedia.org/wiki/File:Photo.jpg', license: 'CC BY-SA' };
  assert.deepEqual(normalizePoiPhotos([commons], []), [{ ...commons, kind: 'remote' }]);
  assert.equal(getSpotRating({ rating: 0, rating_count: 0 }), null);
  assert.equal(getSpotRating({ rating: 4.5, rating_count: 2 }), 4.5);
});
