'use strict';

const crypto = require('node:crypto');
const { resolveLegacyIdentity } = require('./officialPoiIdentity');
const { MAX_UPLOAD_BYTES, isJpegBytes } = require('./imageFilePolicy');

function poiReference(input) {
  const tileId = String(input?.tileId ?? '');
  const category = input?.category;
  const identity = resolveLegacyIdentity(tileId, category);
  return { canonicalId: identity.canonicalId, tileId, category,
    provenance: identity.provenance, archiveSha256: identity.legacyArchiveSha256 };
}

function ownedPhotoPath(url, uid, bucketName) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new TypeError('Invalid photo URL'); }
  const prefix = `/v0/b/${encodeURIComponent(bucketName)}/o/`;
  if (parsed.origin !== 'https://firebasestorage.googleapis.com' ||
      !parsed.pathname.startsWith(prefix) || parsed.searchParams.get('alt') !== 'media' ||
      !parsed.searchParams.get('token')) throw new TypeError('Photo must be an owned Firebase Storage upload');
  const encodedPath = parsed.pathname.slice(prefix.length);
  const path = decodeURIComponent(encodedPath);
  if (encodeURIComponent(path) !== encodedPath ||
      !path.startsWith(`community/${uid}/`) ||
      !/^[A-Za-z0-9-]+\.jpg$/.test(path.slice(`community/${uid}/`.length)))
    throw new TypeError('Photo must belong to this account');
  return path;
}

async function verifyUploadedPhoto(storage, path) {
  const object = storage.bucket().file(path);
  const [metadata] = await object.getMetadata();
  const size = Number(metadata.size);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES || metadata.contentType !== 'image/jpeg')
    throw new TypeError('Photo must be a validated JPEG under 5 MB');
  const [bytes] = await object.download();
  if (!isJpegBytes(bytes)) throw new TypeError('Photo content is not JPEG');
}

function submissionId(path) {
  return `photo_${crypto.createHash('sha256').update(path).digest('hex')}`;
}

module.exports = { poiReference, ownedPhotoPath, verifyUploadedPhoto, submissionId };
