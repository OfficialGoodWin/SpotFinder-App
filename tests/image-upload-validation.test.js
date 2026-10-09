import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SOURCE_IMAGE_BYTES,
  detectImageType,
  validateImageDimensions,
  validateImageFileMetadata,
} from '../src/lib/imageUploadValidation.js';

test('detects only the supported image signatures', () => {
  assert.equal(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
  assert.equal(detectImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), 'image/png');
  assert.equal(detectImageType(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), 'image/webp');
  assert.equal(detectImageType(Uint8Array.from([0x3c, 0x73, 0x76, 0x67, 0, 0, 0, 0, 0, 0, 0, 0])), null);
});

test('rejects misleading types, empty files, and oversized sources', () => {
  assert.throws(() => validateImageFileMetadata({ type: 'image/svg+xml', size: 20 }), /JPEG, PNG, or WebP/);
  assert.throws(() => validateImageFileMetadata({ type: 'image/jpeg', size: 0 }), /empty/);
  assert.throws(() => validateImageFileMetadata({ type: 'image/jpeg', size: MAX_SOURCE_IMAGE_BYTES + 1 }), /12 MB/);
  assert.doesNotThrow(() => validateImageFileMetadata({ type: 'image/png', size: 1024 }));
});

test('rejects decompression-bomb dimensions', () => {
  assert.doesNotThrow(() => validateImageDimensions(1200, 1200));
  assert.throws(() => validateImageDimensions(10_001, 10), /too large/);
  assert.throws(() => validateImageDimensions(5000, 5000), /too large/);
});
