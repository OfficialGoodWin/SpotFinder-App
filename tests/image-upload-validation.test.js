import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SOURCE_IMAGE_BYTES,
  detectImageType,
  readImageDimensions,
  validateImageDimensions,
  validateImageFileMetadata,
} from '../src/lib/imageUploadValidation.js';

test('detects only the supported image signatures', () => {
  assert.equal(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
  assert.equal(detectImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), 'image/png');
  assert.equal(detectImageType(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), 'image/webp');
  assert.equal(detectImageType(Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])), 'image/heic');
  assert.equal(detectImageType(Uint8Array.from([0x3c, 0x73, 0x76, 0x67, 0, 0, 0, 0, 0, 0, 0, 0])), null);
});

test('rejects misleading types, empty files, and oversized sources', () => {
  assert.throws(() => validateImageFileMetadata({ type: 'image/svg+xml', size: 20 }), /JPEG, PNG, WebP, or HEIC/);
  assert.throws(() => validateImageFileMetadata({ type: 'image/jpeg', size: 0 }), /empty/);
  assert.throws(() => validateImageFileMetadata({ type: 'image/jpeg', size: MAX_SOURCE_IMAGE_BYTES + 1 }), /40 MB/);
  assert.doesNotThrow(() => validateImageFileMetadata({ type: 'image/png', size: 1024 }));
});

test('rejects decompression-bomb dimensions', () => {
  assert.doesNotThrow(() => validateImageDimensions(1200, 1200));
  assert.doesNotThrow(() => validateImageDimensions(11_000, 1000));
  assert.throws(() => validateImageDimensions(32_769, 10), /safe decoding limit/);
  assert.throws(() => validateImageDimensions(20_000, 6000), /safe decoding limit/);
});

test('reads JPEG dimensions without decoding a panoramic bitmap', async () => {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0x03, 0xe8, 0x2a, 0xf8, ...Array(10).fill(0)]);
  const file = new Blob([bytes], { type: 'image/jpeg' });
  assert.deepEqual(await readImageDimensions(file, 'image/jpeg'), { width: 11000, height: 1000 });
});
