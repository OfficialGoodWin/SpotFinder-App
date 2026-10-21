import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { uploadImageError } from '../src/lib/imagePreparation.js';
import { waitForUploadTask } from '../src/lib/uploadTask.js';

const require = createRequire(import.meta.url);
const { isJpegBytes } = require('../functions/imageFilePolicy.js');

test('interruption and Storage authorization failures give actionable errors', () => {
  assert.match(uploadImageError({ code: 'storage/canceled' }).message, /Upload interrupted/);
  assert.match(uploadImageError({ code: 'storage/unauthorized' }).message, /Storage permission denied/);
  assert.match(uploadImageError({ code: 'storage/retry-limit-exceeded' }).message, /connection/);
});

test('trusted JPEG policy rejects MIME-spoofed and malformed bytes', () => {
  assert.equal(isJpegBytes(Buffer.from('not really a JPEG')), false);
  assert.equal(isJpegBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0xff, 0xd9])), false);
  assert.equal(isJpegBytes(Buffer.alloc(5 * 1024 * 1024 + 1)), false);
});

test('upload progress reports bytes and navigation abort cancels the Storage task', async () => {
  const controller = new AbortController();
  const progress = [];
  let next;
  let canceled = false;
  const task = {
    on(_event, onNext) { next = onNext; },
    cancel() { canceled = true; },
  };
  const pending = waitForUploadTask(task, { signal: controller.signal, onProgress: value => progress.push(value) });
  next({ bytesTransferred: 50, totalBytes: 100 });
  controller.abort();
  await assert.rejects(pending, /Upload interrupted/);
  assert.deepEqual(progress, [0.5]);
  assert.equal(canceled, true);
});
