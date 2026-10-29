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
  if (parsed.origin !== 'https://firebasestorage.googleapis.com' || parsed.username || parsed.password || parsed.hash ||
      !parsed.pathname.startsWith(prefix) || parsed.searchParams.get('alt') !== 'media' ||
      !parsed.searchParams.get('token') || [...parsed.searchParams].length !== 2)
    throw new TypeError('Photo must be an owned Firebase Storage upload');
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
  return metadata;
}

async function validatedCommunityPhoto(storage, url, uid) {
  const bucket = storage.bucket();
  const path = ownedPhotoPath(url, uid, bucket.name);
  const metadata = await verifyUploadedPhoto(storage, path);
  const requestedToken = new URL(url).searchParams.get('token');
  const issuedTokens = String(metadata.metadata?.firebaseStorageDownloadTokens || '')
    .split(',').map(token => token.trim()).filter(Boolean);
  if (!issuedTokens.includes(requestedToken)) throw new TypeError('Photo token does not belong to the uploaded object');
  return {
    path,
    url: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(path)}?alt=media&token=${encodeURIComponent(requestedToken)}`,
  };
}

function validLegacyPoiId(value) {
  if (typeof value !== 'string') return false;
  const match = /^(-?\d{1,3}\.\d{4})_(-?\d{1,3}\.\d{4})_([a-z0-9]{0,20})$/.exec(value);
  return Boolean(match && Math.abs(Number(match[1])) <= 90 && Math.abs(Number(match[2])) <= 180);
}

function submissionId(path) {
  return `photo_${crypto.createHash('sha256').update(path).digest('hex')}`;
}

module.exports = { poiReference, ownedPhotoPath, verifyUploadedPhoto, validatedCommunityPhoto, validLegacyPoiId, submissionId };
