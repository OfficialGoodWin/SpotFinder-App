import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadPublicSpotRevocations, validSignal } from '../src/new/publicSpotRevocationHttpClient.js';
import { createPublicSpotRevocationState } from '../src/new/publicSpotRevocationState.js';

const now = Date.parse('2026-11-02T12:00:00.000Z');
const signal = { format: 1, revoked: ['hidden'] };
const body = (revoked = ['hidden']) => ({ format: 1, revoked,
  revision: createHash('sha256').update(JSON.stringify(revoked)).digest('hex').slice(0, 20),
  generatedAt: new Date(now).toISOString() });
const request = (payload = body(), status = 200, cache = 'no-store, max-age=0') => async () => ({
  ok: status === 200, status, headers: { get: () => cache }, json: async () => payload,
});
const load = (row, options = {}) => loadPublicSpotRevocations(row,
  { request: request(), now: () => now, ...options });

test('accepts a complete format-1 feed and a format-2 signal', async () => {
  assert.deepEqual(await load(signal), { format: 1, revoked: ['hidden'] });
  const historical = { format: 2, revision: 3, segments: ['s0000'], recent: ['new'] };
  assert.deepEqual(await load(historical, { request: request(body(['hidden', 'new'])) }),
    { format: 1, revoked: ['hidden', 'new'] });
});

test('rejects missing, malformed and incomplete signals', async () => {
  assert.equal(validSignal({ format: 2, revision: 1, segments: ['s0001'], recent: [] }), false);
  await assert.rejects(load(null), /Invalid revocation signal/);
  await assert.rejects(load(signal, { request: request(body([])) }), /missing current IDs/);
});

test('fails closed on HTTP 500, missing feed and cacheable responses', async () => {
  await assert.rejects(load(signal, { request: request({}, 500) }), /unavailable/);
  await assert.rejects(load(signal, { request: request({}, 404) }), /unavailable/);
  await assert.rejects(load(signal, { request: request(body(), 200, 'public, max-age=60') }), /unavailable/);
});

test('rejects 403, 429 and 503 without parsing an error body', async () => {
  for (const status of [403, 429, 503]) {
    let parsed = false;
    await assert.rejects(load(signal, { request: async () => ({
      ok: false, status, headers: { get: () => 'no-store' },
      json: async () => { parsed = true; return body(); },
    }) }), /unavailable/);
    assert.equal(parsed, false);
  }
});

test('rejects corrupt JSON and an unavailable historical segment', async () => {
  await assert.rejects(load(signal, { request: async () => ({
    ok: true, status: 200, headers: { get: () => 'no-store' },
    json: async () => { throw new SyntaxError('Corrupt JSON'); },
  }) }), /Corrupt JSON/);
  const segmented = { format: 2, revision: 3, segments: ['s0000', 's0001'], recent: ['new'] };
  await assert.rejects(load(segmented, { request: request({ error: 'revocation-unavailable' }, 503) }), /unavailable/);
});

test('uses one bounded HTTP request per server signal and no polling', async () => {
  let calls = 0;
  const oneRequest = async (_url, options) => {
    calls += 1;
    assert.equal(options.method, 'GET');
    assert.equal(options.cache, 'no-store');
    return request()();
  };
  await load(signal, { request: oneRequest });
  assert.equal(calls, 1);
});

test('rejects stale, tampered and incomplete public feeds', async () => {
  await assert.rejects(load(signal, { request: request({ ...body(), generatedAt: new Date(now - 31000).toISOString() }) }), /Stale/);
  await assert.rejects(load(signal, { request: request({ ...body(), revision: 'bad' }) }), /revision/);
  await assert.rejects(load({ format: 2, revision: 3, segments: ['s0000'], recent: ['new'] },
    { request: request(body(['hidden'])) }), /missing current IDs/);
});

test('recovers after temporary backend unavailability and includes a new revocation', async () => {
  await assert.rejects(load(signal, { request: request({}, 500) }), /unavailable/);
  assert.deepEqual(await load({ format: 1, revoked: ['hidden', 'new'] },
    { request: request(body(['hidden', 'new'])) }), { format: 1, revoked: ['hidden', 'new'] });
});

test('holds an initial read until HTTP validation completes', async () => {
  let accept;
  const state = createPublicSpotRevocationState({ listen: callback => { accept = callback; return () => {}; } });
  const pending = state.current();
  state.hold();
  accept({ exists: true, fromCache: false, data: await load(signal) });
  assert.deepEqual([...await pending], ['hidden']);
  state.stop();
});

test('hides spots during refresh and recovers only after a valid feed', async () => {
  let accept;
  const states = [];
  const state = createPublicSpotRevocationState({ listen: callback => { accept = callback; return () => {}; } });
  state.subscribe(value => states.push(value.healthy));
  accept({ exists: true, fromCache: false, data: await load(signal) });
  assert.equal(states.at(-1), true);
  state.hold();
  assert.equal(states.at(-1), false);
  await assert.rejects(load(signal, { request: request({}, 500) }));
  state.invalidate();
  assert.equal(states.at(-1), false);
  state.restart();
  accept({ exists: true, fromCache: false, data: await load(signal) });
  assert.equal(states.at(-1), true);
  assert.equal(state.isRevoked('hidden'), true);
  state.stop();
});
