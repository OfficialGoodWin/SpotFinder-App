import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadSelectedPhotos } from '../src/lib/contributionPhotos.js';

test('a failed selected photo blocks publication and successful uploads are reused on retry', async () => {
  const files = [{ name: 'one' }, { name: 'two' }, { name: 'three' }];
  const attempts = new Map();
  const cache = new Map();
  const upload = async file => {
    attempts.set(file.name, (attempts.get(file.name) || 0) + 1);
    if (file.name === 'two' && attempts.get(file.name) === 1) throw new Error('offline');
    return `https://example.test/${file.name}`;
  };
  await assert.rejects(() => uploadSelectedPhotos(files, upload, cache), /One or more photos could not be uploaded/);
  assert.equal(cache.size, 2);
  assert.deepEqual(await uploadSelectedPhotos(files, upload, cache), files.map(file => `https://example.test/${file.name}`));
  assert.deepEqual([...attempts.values()], [1, 2, 1]);
});

test('no selected photos performs no uploads', async () => {
  assert.deepEqual(await uploadSelectedPhotos([], () => { throw new Error('unexpected'); }), []);
});
