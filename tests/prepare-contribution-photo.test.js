import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareContributionPhoto } from '../src/lib/prepareContributionPhoto.js';
import { isPreparedImage } from '../src/lib/imagePreparation.js';

test('supported HEIC/HEIF picker stills use the shared JPEG preparation path', async () => {
  const originalImage = globalThis.Image;
  const originalBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  globalThis.Image = class {
    naturalWidth = 4032;
    naturalHeight = 3024;
    set src(_) { queueMicrotask(() => this.onload?.()); }
  };
  globalThis.createImageBitmap = async () => ({ width: 4032, height: 3024, close() {} });
  globalThis.document = { createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({ drawImage() {} }),
    toBlob: callback => callback(new Blob([jpeg], { type: 'image/jpeg' })),
  }) };
  try {
    for (const [brand, type] of [['heic', 'image/heic'], ['mif1', 'image/heif']]) {
      const header = Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112, ...brand.split('').map(char => char.charCodeAt(0)), 0, 0, 0, 0]);
      const picked = new File([header], `picker.${brand}`, { type });
      const result = await prepareContributionPhoto(picked);
      assert.deepEqual([result.width, result.height], [3072, 2304]);
      assert.equal(result.file.type, 'image/jpeg');
      assert.equal(isPreparedImage(result.file), true);
      assert.deepEqual(result.original, { type, size: picked.size, width: 4032, height: 3024 });
    }
  } finally {
    globalThis.Image = originalImage;
    globalThis.createImageBitmap = originalBitmap;
    globalThis.document = originalDocument;
  }
});
