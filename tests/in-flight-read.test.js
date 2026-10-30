import test from 'node:test';
import assert from 'node:assert/strict';
import { createInFlightRead } from '../src/lib/inFlightRead.js';

test('concurrent identical reads share one request but completed detail reads refresh', async () => {
  const read = createInFlightRead();
  let calls = 0;
  const load = async () => { calls++; await new Promise(resolve => setImmediate(resolve)); return 'public'; };
  assert.deepEqual(await Promise.all([read('spot-1', load), read('spot-1', load)]), ['public', 'public']);
  assert.equal(calls, 1);
  await read('spot-1', load);
  assert.equal(calls, 2);
});

test('failed reads and invalidation do not retain an old request', async () => {
  const read = createInFlightRead();
  await assert.rejects(read('spot-1', () => { throw new Error('offline'); }));
  let calls = 0;
  await read('spot-1', () => { calls++; return null; });
  read.clear();
  await read('spot-1', () => { calls++; return null; });
  assert.equal(calls, 2);
});
