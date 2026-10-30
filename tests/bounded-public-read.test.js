import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoundedPublicRead } from '../src/lib/boundedPublicRead.js';

const syntheticRows = [{ id: 'public-spot', lat: 50, lng: 14 }];
const tick = () => new Promise(resolve => setImmediate(resolve));

test('synthetic viewport movement and A-B-A reuse reduce query invocations', async () => {
  let before = 0;
  const raw = async () => { before += 1; await tick(); return syntheticRows; };
  await Promise.all([raw(), raw(), raw(), raw()]);
  await raw(); await raw(); await raw();
  let after = 0;
  const read = createBoundedPublicRead();
  const query = key => read(key, async () => { after += 1; await tick(); return syntheticRows; });
  const sameViewport = await Promise.all([query('A'), query('A'), query('A'), query('A')]);
  assert(sameViewport.every(rows => rows === syntheticRows));
  await query('A'); await query('B'); await query('A');
  assert.deepEqual({ before, after }, { before: 7, after: 2 });
});

test('synthetic Nearby and Discover remounts reuse a bounded read', async () => {
  let before = 0;
  const raw = async () => { before += 1; return syntheticRows; };
  await raw(); await raw(); await raw(); await raw();
  let after = 0;
  const read = createBoundedPublicRead();
  const query = key => read(key, async () => { after += 1; return syntheticRows; });
  await query('near:50:14'); await query('near:50:14');
  await query('discover:first'); await query('discover:first');
  assert.deepEqual({ before, after }, { before: 4, after: 2 });
});

test('concurrency is bounded, failures are retriable only on a new call', async () => {
  let running = 0;
  let peak = 0;
  const read = createBoundedPublicRead({ maxConcurrent: 2 });
  await Promise.all(['A', 'B', 'C', 'D'].map(key => read(key, async () => {
    running += 1;
    peak = Math.max(peak, running);
    await tick();
    running -= 1;
    return syntheticRows;
  })));
  assert.equal(peak, 2);
  let calls = 0;
  await assert.rejects(read('failed', () => { calls += 1; throw Error('offline'); }));
  assert.equal(calls, 1);
  await read('failed', () => { calls += 1; return syntheticRows; });
  assert.equal(calls, 2);
});

test('rapid distinct movement drops queued obsolete reads before starting them', async () => {
  const read = createBoundedPublicRead({ maxConcurrent: 1, maxQueued: 1 });
  const started = [];
  let release;
  const first = read('A', () => new Promise(resolve => { started.push('A'); release = resolve; }));
  await tick();
  const obsolete = read('B', () => { started.push('B'); return syntheticRows; });
  const latest = read('C', () => { started.push('C'); return syntheticRows; });
  await assert.rejects(obsolete, /Superseded/);
  release(syntheticRows);
  await Promise.all([first, latest]);
  assert.deepEqual(started, ['A', 'C']);
});

test('a stalled active read cannot leave a later read queued forever', async () => {
  const read = createBoundedPublicRead({ maxConcurrent: 1, maxQueueWaitMs: 5 });
  let release;
  const first = read('A', () => new Promise(resolve => { release = resolve; }));
  await tick();
  const queued = read('B', () => syntheticRows);
  await assert.rejects(queued, /timed out/);
  release(syntheticRows);
  await first;
});

test('bounded failure backoff suppresses immediate repeat requests and resets on success', async () => {
  let now = 0;
  let calls = 0;
  const read = createBoundedPublicRead({ failureBackoffMs: 250, maxFailureBackoffMs: 1000, now: () => now });
  const load = () => { calls++; throw new Error('offline'); };
  await assert.rejects(read('A', load), /offline/);
  await assert.rejects(read('A', load), /offline/);
  assert.equal(calls, 1);
  now = 250;
  await assert.rejects(read('A', load), /offline/);
  assert.equal(calls, 2);
  now = 749;
  await assert.rejects(read('A', load), /offline/);
  assert.equal(calls, 2);
  now = 750;
  await read('A', () => { calls++; return syntheticRows; });
  assert.equal(calls, 3);
  assert.equal(await read('A', load), syntheticRows);
  assert.equal(calls, 3);
});

test('invalidation prevents an older in-flight result from filling the new cache', async () => {
  const read = createBoundedPublicRead({ maxConcurrent: 2 });
  let release;
  const old = read('A', () => new Promise(resolve => { release = resolve; }));
  await tick();
  read.clear();
  const freshRows = [{ id: 'fresh' }];
  const fresh = await read('A', () => freshRows);
  release([{ id: 'old' }]);
  await old;
  assert.equal(await read('A', () => { throw new Error('cache was lost'); }), fresh);
});
