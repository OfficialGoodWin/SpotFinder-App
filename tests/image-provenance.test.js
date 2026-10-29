import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validatedCommunityPhoto, validLegacyPoiId } = require('../functions/poiEnrichment.js');
const bucketName = 'spotfinderapp-cdc7b.firebasestorage.app';
const uid = 'owner';
const path = 'community/owner/photo-1.jpg';
const token = 'dummy-token';
const photoUrl = (bucket = bucketName, objectPath = path, issuedToken = token) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media&token=${issuedToken}`;

// The server policy checks the JPEG container, dimensions, and forbidden metadata.
const jpeg = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 1, 0, 1, 3, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0,
    0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0]),
  Buffer.alloc(8, 1), Buffer.from([0xff, 0xd9]),
]);

function storage({ exists = true, metadata = {}, bytes = jpeg } = {}) {
  return { bucket: () => ({ name: bucketName, file: objectPath => ({
    getMetadata: async () => {
      if (!exists || objectPath !== path) throw new Error('not found');
      return [{ size: bytes.length, contentType: 'image/jpeg',
        metadata: { firebaseStorageDownloadTokens: token }, ...metadata }];
    },
    download: async () => [bytes],
  }) }) };
}

test('community photo provenance binds bucket, author, object, bytes and download token', async () => {
  const valid = await validatedCommunityPhoto(storage(), photoUrl(), uid);
  assert.deepEqual(valid, { path, url: photoUrl() });
  await assert.rejects(validatedCommunityPhoto(storage(), photoUrl('other-bucket'), uid));
  await assert.rejects(validatedCommunityPhoto(storage(), photoUrl(bucketName, 'community/other/photo-1.jpg'), uid));
  await assert.rejects(validatedCommunityPhoto(storage({ exists: false }), photoUrl(), uid));
  await assert.rejects(validatedCommunityPhoto(storage(), photoUrl(bucketName, 'community/owner/../other.jpg'), uid));
  await assert.rejects(validatedCommunityPhoto(storage(), `${photoUrl()}&extra=1`, uid));
  await assert.rejects(validatedCommunityPhoto(storage(), photoUrl(bucketName, path, 'other-token'), uid));
  await assert.rejects(validatedCommunityPhoto(storage({ metadata: { contentType: 'image/png' } }), photoUrl(), uid));
  await assert.rejects(validatedCommunityPhoto(storage({ bytes: Buffer.from('not JPEG') }), photoUrl(), uid));
  await assert.rejects(validatedCommunityPhoto(storage({ metadata: { size: 5 * 1024 * 1024 + 1 } }), photoUrl(), uid));
  assert.equal(validLegacyPoiId('50.0000_14.0000_test'), true);
  assert.equal(validLegacyPoiId('999.0000_14.0000_test'), false);
});
