import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAppCheckRequest, requireVercelAppCheck } from '../api/appCheckGuard.js';
import { validAppCheckConfig, readAppCheckToken, observeAppCheckStatus } from '../src/lib/appCheckCore.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const config = overrides => ({
  verifyToken: async token => token === 'valid' ? { appId: '1:123:web:abc' } : Promise.reject(new Error('expired or invalid')),
  allowedAppIds: ['1:123:web:abc'], expectedProjectId: 'demo-spotfinder', adminProjectId: 'demo-spotfinder',
  ...overrides,
});
const request = token => ({ headers: token ? { 'x-firebase-appcheck': token } : {} });

test('valid, missing, expired and wrong-app tokens', async () => {
  assert.equal((await verifyAppCheckRequest(request('valid'), config())).ok, true);
  assert.equal((await verifyAppCheckRequest(request(), config())).code, 'APP_CHECK_REQUIRED');
  assert.equal((await verifyAppCheckRequest(request('expired'), config())).code, 'APP_CHECK_INVALID');
  assert.equal((await verifyAppCheckRequest(request('valid'), config({ allowedAppIds: ['1:123:web:other'] }))).code, 'APP_CHECK_INVALID');
});

test('incorrect project and missing allowlist fail closed without verifying token', async () => {
  let called = false;
  const verifyToken = async () => { called = true; return { appId: '1:123:web:abc' }; };
  assert.equal((await verifyAppCheckRequest(request('valid'), config({ verifyToken, adminProjectId: 'other' }))).code, 'APP_CHECK_NOT_CONFIGURED');
  assert.equal((await verifyAppCheckRequest(request('valid'), config({ verifyToken, allowedAppIds: [] }))).status, 503);
  assert.equal(called, false);
});

test('provider validation and token cache/refresh delegation', async () => {
  assert.equal(validAppCheckConfig('public-key', 'enterprise'), true);
  assert.equal(validAppCheckConfig('', 'enterprise'), false);
  assert.equal(validAppCheckConfig('public-key', 'recaptcha-v3'), false);
  let calls = 0;
  const getToken = async (_instance, forceRefresh) => {
    assert.equal(forceRefresh, false);
    return { token: ++calls === 1 ? 'cached-token' : 'refreshed-token' };
  };
  assert.equal(await readAppCheckToken({}, getToken), 'cached-token');
  assert.equal(await readAppCheckToken({}, getToken), 'refreshed-token');
  await assert.rejects(readAppCheckToken(null, getToken), /unavailable/);
  await assert.rejects(readAppCheckToken({}, async () => { throw new Error('secret'); }), /reload and try again/);
});

test('staging attestation diagnostics never include token or provider error details', () => {
  const events = [];
  const unsubscribe = () => {};
  const instance = {};
  const result = observeAppCheckStatus(instance, (appCheck, success, failure) => {
    assert.equal(appCheck, instance);
    success({ token: 'sensitive-token-value' });
    success({ token: '' });
    failure(new Error('sensitive-provider-response'));
    return unsubscribe;
  }, status => events.push(status));
  assert.equal(result, unsubscribe);
  assert.deepEqual(events, ['ready', 'unavailable', 'failed']);
  assert.doesNotMatch(JSON.stringify(events), /sensitive|token-value/);
});

test('Vercel guard can be rolled out separately and never echoes a token', async () => {
  const previous = { enforce: process.env.VERCEL_APPCHECK_ENFORCE, ids: process.env.FIREBASE_ALLOWED_APP_IDS,
    project: process.env.FIREBASE_PROJECT_ID };
  const res = () => ({ setHeader() {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } });
  const deps = { adminApp: { options: { projectId: 'demo-spotfinder' } },
    adminAppCheck: { verifyToken: async token => token === 'valid' ? { appId: '1:123:web:abc' } : Promise.reject(new Error('invalid')) } };
  try {
    delete process.env.VERCEL_APPCHECK_ENFORCE;
    assert.equal(await requireVercelAppCheck(request(), res(), deps), true);
    process.env.VERCEL_APPCHECK_ENFORCE = 'true';
    process.env.FIREBASE_PROJECT_ID = 'demo-spotfinder';
    process.env.FIREBASE_ALLOWED_APP_IDS = '1:123:web:abc';
    const missing = res();
    assert.equal(await requireVercelAppCheck(request(), missing, deps), false);
    assert.equal(missing.statusCode, 401);
    assert.equal(await requireVercelAppCheck(request('valid'), res(), deps), true);
    const invalid = res();
    assert.equal(await requireVercelAppCheck(request('secret-token'), invalid, deps), false);
    assert.doesNotMatch(JSON.stringify(invalid.body), /secret-token/);
  } finally {
    for (const [key, value] of Object.entries({ VERCEL_APPCHECK_ENFORCE: previous.enforce,
      FIREBASE_ALLOWED_APP_IDS: previous.ids, FIREBASE_PROJECT_ID: previous.project })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('route-specific enforcement switch leaves other routes available', async () => {
  const previous = { report: process.env.VERCEL_APPCHECK_ENFORCE_REPORT,
    checkout: process.env.VERCEL_APPCHECK_ENFORCE_CHECKOUT,
    ids: process.env.FIREBASE_ALLOWED_APP_IDS, project: process.env.FIREBASE_PROJECT_ID };
  const response = () => ({ setHeader() {}, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } });
  const deps = { adminApp: { options: { projectId: 'demo-spotfinder' } },
    adminAppCheck: { verifyToken: async () => ({ appId: '1:123:web:abc' }) } };
  try {
    process.env.VERCEL_APPCHECK_ENFORCE_REPORT = 'true';
    delete process.env.VERCEL_APPCHECK_ENFORCE_CHECKOUT;
    process.env.FIREBASE_PROJECT_ID = 'demo-spotfinder';
    process.env.FIREBASE_ALLOWED_APP_IDS = '1:123:web:abc';
    const blocked = response();
    assert.equal(await requireVercelAppCheck(request(), blocked, { ...deps, enforceEnv: 'VERCEL_APPCHECK_ENFORCE_REPORT' }), false);
    assert.equal(blocked.body.code, 'APP_CHECK_REQUIRED');
    assert.equal(await requireVercelAppCheck(request(), response(), { ...deps, enforceEnv: 'VERCEL_APPCHECK_ENFORCE_CHECKOUT' }), true);
  } finally {
    for (const [key, value] of Object.entries({ VERCEL_APPCHECK_ENFORCE_REPORT: previous.report,
      VERCEL_APPCHECK_ENFORCE_CHECKOUT: previous.checkout, FIREBASE_ALLOWED_APP_IDS: previous.ids,
      FIREBASE_PROJECT_ID: previous.project })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('all callable Functions have prepared v1 App Check runtime options', () => {
  const index = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
  const bootstrap = readFileSync(new URL('../functions/setAdminClaim.js', import.meta.url), 'utf8');
  new vm.Script(index);
  new vm.Script(bootstrap);
  assert.doesNotMatch(index, /functions\.https\.onCall\(/);
  assert.doesNotMatch(bootstrap, /functions\.https\.onCall\(/);
  assert.equal((index.match(/\.https\.onCall\(/g) || []).length + (bootstrap.match(/\.https\.onCall\(/g) || []).length, 29);
  assert.match(index, /enforceAppCheck: false/);
});
