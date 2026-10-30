import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { verifyTurnstileToken, TurnstileUnavailableError } = require('../functions/turnstileSiteverify');

const now = Date.parse('2026-10-29T12:00:00Z');
const valid = { success: true, hostname: 'spotfinder.live', action: 'publish_spot', challenge_ts: '2026-10-29T11:59:00Z' };
const options = (result, extras = {}) => ({
  secret: 'test-secret', expectedAction: 'publish_spot', allowedHostnames: ['spotfinder.live'], now,
  fetchImpl: async (_url, request) => {
    assert.equal(request.method, 'POST');
    assert.equal(JSON.parse(request.body).secret, 'test-secret');
    return { ok: true, json: async () => result };
  },
  ...extras,
});

test('accepts a verified token with the expected hostname and action', async () => {
  assert.deepEqual(await verifyTurnstileToken('token', options(valid)), { ok: true });
});

test('rejects absent, oversized, failed, and replayed tokens', async () => {
  assert.equal((await verifyTurnstileToken('', options(valid))).reason, 'invalid_token');
  assert.equal((await verifyTurnstileToken('x'.repeat(2049), options(valid))).reason, 'invalid_token');
  assert.equal((await verifyTurnstileToken('token', options({ success: false }))).reason, 'invalid_token');
  assert.equal((await verifyTurnstileToken('token', options({ success: false, 'error-codes': ['timeout-or-duplicate'] }))).reason, 'expired_or_reused');
});

test('rejects wrong hostname, action, and challenge age', async () => {
  assert.equal((await verifyTurnstileToken('token', options({ ...valid, hostname: 'attacker.example' }))).reason, 'wrong_hostname');
  assert.equal((await verifyTurnstileToken('token', options({ ...valid, action: 'report' }))).reason, 'wrong_action');
  assert.equal((await verifyTurnstileToken('token', options({ ...valid, challenge_ts: '2026-10-29T11:54:00Z' }))).reason, 'expired_or_reused');
  assert.equal((await verifyTurnstileToken('token', options({ ...valid, challenge_ts: 'not-a-date' }))).reason, 'expired_or_reused');
});

test('fails closed for missing configuration or unavailable Siteverify', async () => {
  await assert.rejects(verifyTurnstileToken('token', options(valid, { secret: '' })), /not configured/);
  await assert.rejects(verifyTurnstileToken('token', options(valid, { fetchImpl: async () => { throw new Error('offline'); } })), TurnstileUnavailableError);
  await assert.rejects(verifyTurnstileToken('token', options(valid, { fetchImpl: async () => ({ ok: false }) })), TurnstileUnavailableError);
});
