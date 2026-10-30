import test from 'node:test';
import assert from 'node:assert/strict';
import { processReport } from '../api/reportPilot.js';
import handler, { createReportHandler } from '../api/submit-report.js';

function fakeDb() {
  const docs = new Map();
  const stats = { writes: 0 };
  let sequence = 0;
  let queue = Promise.resolve();
  const reference = path => ({ path, id: path.split('/').at(-1), async get() { return snapshot(this); } });
  const snapshot = ref => ({ exists: docs.has(ref.path), id: ref.id, data: () => docs.get(ref.path) });
  const db = {
    docs, stats,
    collection(name) {
      return {
        doc(id) { return reference(`${name}/${id || ++sequence}`); },
        where(field, _operator, value) {
          const filters = [[field, value]];
          const query = {
            where(key, _op, expected) { filters.push([key, expected]); return query; },
            limit() { return query; },
            async get() {
              const matches = [...docs.entries()].filter(([path, data]) => path.startsWith(`${name}/`) && filters.every(([key, expected]) => data[key] === expected));
              return { empty: !matches.length, docs: matches.map(([path]) => snapshot(reference(path))) };
            },
          };
          return query;
        },
      };
    },
    async runTransaction(fn) {
      const previous = queue;
      let release;
      queue = new Promise(resolve => { release = resolve; });
      await previous;
      try {
        const writes = [];
        const tx = {
          async get(ref) { return snapshot(ref); },
          set(ref, value) { writes.push([ref.path, value]); },
        };
        const outcome = await fn(tx);
        for (const [path, value] of writes) { docs.set(path, value); stats.writes += 1; }
        return outcome;
      } finally { release(); }
    },
  };
  return db;
}

const now = Date.parse('2026-10-29T12:00:00Z');
const validBody = (targetId = 'one', idempotencyKey = 'request_1234567890') => ({
  category: 'spam_scam', subject: 'Report: spot', message: 'Spam', targetType: 'spot', targetId,
  targetSnapshot: { title: 'A spot' }, deviceId: 'device', idempotencyKey,
});
const req = (body = validBody(), authorization = 'Bearer good') => ({ method: 'POST', headers: { authorization }, body });
function setup() {
  const db = fakeDb();
  for (const id of ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']) docsSet(db, `spots/${id}`, { status: 'published', is_public: true });
  const deps = {
    db, now: () => now, challengeSecret: 'test-secret', allowedHostnames: ['spotfinder.live'],
    verifyAuth: async token => token === 'good' ? { uid: 'u1', email: 'a@example.test', email_verified: true, firebase: { sign_in_provider: 'password' } } : null,
    verifyChallenge: async token => token === 'valid' ? { ok: true } : { ok: false, reason: 'expired_or_reused' },
  };
  return { db, deps };
}
function docsSet(db, path, value) { db.docs.set(path, value); }
const submit = (deps, body, authorization) => processReport(req(body, authorization), deps);

test('valid report preserves moderator fields and derives identity', async () => {
  const { db, deps } = setup();
  const response = await submit(deps, validBody());
  assert.equal(response.body.code, 'REPORT_CREATED');
  const report = db.docs.get(`reports/${response.body.id}`);
  assert.equal(report.reporter_uid, 'u1');
  assert.equal(report.target_key, 'spot:one');
  assert.equal(report.status, 'open');
});

test('anonymous, invalid token and spoofed UID are rejected before storage', async () => {
  const { db, deps } = setup();
  assert.equal((await submit(deps, validBody(), '')).status, 401);
  assert.equal((await submit(deps, validBody(), 'Bearer bad')).status, 401);
  assert.equal((await submit(deps, { ...validBody(), uid: 'admin' })).status, 400);
  deps.verifyAuth = async () => ({ uid: 'anon', email_verified: false, firebase: { sign_in_provider: 'anonymous' } });
  assert.equal((await submit(deps, validBody())).body.code, 'VERIFIED_AUTH_REQUIRED');
  assert.equal([...db.docs.keys()].filter(key => key.startsWith('reports/')).length, 0);
});

test('invalid target, reason, method and oversized payload are rejected', async () => {
  const { deps } = setup();
  assert.equal((await submit(deps, validBody('missing'))).body.code, 'INVALID_TARGET');
  deps.db.docs.set('spots/private', { status: 'published', is_public: false });
  assert.equal((await submit(deps, validBody('private'))).body.code, 'INVALID_TARGET');
  assert.equal((await submit(deps, { ...validBody(), category: 'fake' })).status, 400);
  assert.equal((await processReport({ ...req(), method: 'GET' }, deps)).status, 405);
  assert.equal((await submit(deps, { ...validBody(), message: 'x'.repeat(9000) })).status, 413);
});

test('same key and same target are idempotent, including parallel calls', async () => {
  const { db, deps } = setup();
  const [a, b] = await Promise.all([submit(deps, validBody()), submit(deps, validBody())]);
  assert.equal([a.body.code, b.body.code].filter(code => code === 'REPORT_CREATED').length, 1);
  assert.equal([...db.docs.keys()].filter(key => key.startsWith('reports/')).length, 1);
  assert.equal((await submit(deps, validBody('one', 'different_request_123'))).body.code, 'ALREADY_REPORTED');
});

test('API recognizes an existing open report created by the legacy callable', async () => {
  const { db, deps } = setup();
  docsSet(db, 'reports/legacy-open', { reporter_uid: 'u1', target_key: 'spot:one', status: 'open' });
  const response = await submit(deps, validBody());
  assert.equal(response.body.code, 'ALREADY_REPORTED');
  assert.equal(db.stats.writes, 0);
  assert.equal([...db.docs.keys()].filter(path => path.startsWith('reports/')).length, 1);
});

test('third report requires a challenge; valid challenge permits only one bounded report', async () => {
  const { deps } = setup();
  await submit(deps, validBody('one', 'request_1234567891'));
  await submit(deps, validBody('two', 'request_1234567892'));
  assert.equal((await submit(deps, validBody('three', 'request_1234567893'))).body.code, 'CHALLENGE_REQUIRED');
  assert.equal((await submit(deps, { ...validBody('three', 'request_1234567893'), turnstileToken: 'valid' })).body.code, 'REPORT_CREATED');
  assert.equal((await submit(deps, { ...validBody('four', 'request_1234567894'), turnstileToken: 'expired' })).body.code, 'INVALID_CHALLENGE');
});

test('wrong host/action, replay and unavailable challenge fail closed', async () => {
  const { deps } = setup();
  for (const reason of ['wrong_hostname', 'wrong_action', 'expired_or_reused']) {
    deps.verifyChallenge = async () => ({ ok: false, reason });
    assert.equal((await submit(deps, { ...validBody(), turnstileToken: reason })).body.code, 'INVALID_CHALLENGE');
  }
  deps.verifyChallenge = async () => { throw new Error('offline'); };
  assert.equal((await submit(deps, { ...validBody(), turnstileToken: 'token' })).body.code, 'CHALLENGE_UNAVAILABLE');
  deps.challengeSecret = '';
  assert.equal((await submit(deps, { ...validBody(), turnstileToken: 'token' })).body.code, 'CHALLENGE_UNAVAILABLE');
});

test('hard hourly cap stays enforced after a passed challenge', async () => {
  const { deps } = setup();
  // Seed a genuine prior counter to test the boundary independently of the short cooldown.
  const first = await submit(deps, validBody());
  assert.equal(first.body.code, 'REPORT_CREATED');
  const key = [...deps.db.docs.keys()].find(path => path.startsWith('server_rate_limits/report_'));
  deps.db.docs.set(key, { hourStart: now, hourCount: 8, shortStart: now, shortCount: 0 });
  const response = await submit(deps, { ...validBody('two', 'request_1234567892'), turnstileToken: 'valid' });
  assert.equal(response.status, 429);
  assert.equal(response.body.code, 'REPORT_HARD_LIMIT');
  assert.ok(Number(response.headers['Retry-After']) > 0);
});

test('short cooldown rejects a fifth rapid report with no extra write', async () => {
  const { db, deps } = setup();
  for (const [index, target] of ['one', 'two', 'three', 'four'].entries()) {
    const body = { ...validBody(target, `request_123456789${index}`),
      ...(index >= 2 ? { turnstileToken: 'valid' } : {}) };
    assert.equal((await submit(deps, body)).body.code, 'REPORT_CREATED');
  }
  assert.equal(db.stats.writes, 8);
  const fifth = await submit(deps, { ...validBody('five', 'request_1234567895'), turnstileToken: 'valid' });
  assert.equal(fifth.body.code, 'REPORT_COOLDOWN');
  assert.equal(fifth.status, 429);
  assert.equal(db.stats.writes, 8);
});

test('server account block is honored; client device identity cannot grant access', async () => {
  const { db, deps } = setup();
  docsSet(db, 'submission_blocks/u1', { expires_at: { toDate: () => new Date(now + 60000) } });
  assert.equal((await submit(deps, validBody())).body.code, 'REPORTER_BLOCKED');
  assert.equal([...db.docs.keys()].filter(key => key.startsWith('reports/')).length, 0);
});

test('deployed wrapper stays disabled without explicit switches and never reveals secrets', async () => {
  const saved = { enabled: process.env.REPORT_API_ENABLED, approved: process.env.REPORT_API_PRODUCTION_APPROVED,
    secret: process.env.TURNSTILE_SECRET_KEY, env: process.env.VERCEL_ENV };
  const response = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } });
  try {
    delete process.env.REPORT_API_ENABLED;
    const disabled = response();
    await handler(req(), disabled);
    assert.equal(disabled.statusCode, 503);
    assert.equal(disabled.body.code, 'REPORT_API_DISABLED');
    process.env.REPORT_API_ENABLED = 'true';
    process.env.VERCEL_ENV = 'production';
    delete process.env.REPORT_API_PRODUCTION_APPROVED;
    const unapproved = response();
    await handler(req(), unapproved);
    assert.equal(unapproved.body.code, 'REPORT_API_DISABLED');
    process.env.REPORT_API_PRODUCTION_APPROVED = 'true';
    delete process.env.TURNSTILE_SECRET_KEY;
    const unconfigured = response();
    await handler(req(), unconfigured);
    assert.equal(unconfigured.body.code, 'REPORT_API_NOT_CONFIGURED');
    assert.doesNotMatch(JSON.stringify(unconfigured.body), /private.key|Bearer|test-secret/);
  } finally {
    for (const [key, value] of Object.entries({ REPORT_API_ENABLED: saved.enabled,
      REPORT_API_PRODUCTION_APPROVED: saved.approved, TURNSTILE_SECRET_KEY: saved.secret, VERCEL_ENV: saved.env })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('enabled report route requires App Check independently of Auth and Turnstile', async () => {
  const saved = Object.fromEntries(['REPORT_API_ENABLED', 'VERCEL_ENV', 'FIREBASE_PROJECT_ID',
    'FIREBASE_ALLOWED_APP_IDS', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_ALLOWED_HOSTNAMES']
    .map(key => [key, process.env[key]]));
  const { db } = setup();
  const response = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } });
  const admin = { adminDb: db, adminApp: { options: { projectId: 'demo-spotfinder-report-pilot' } },
    adminAppCheck: { verifyToken: async token => {
      if (token !== 'valid-app') throw new Error('invalid or expired');
      return { appId: '1:123:web:abc' };
    } },
    adminAuth: { verifyIdToken: async token => {
      if (token !== 'good') throw new Error('invalid auth');
      return { uid: 'u1', email: 'a@example.test', email_verified: true, firebase: { sign_in_provider: 'password' } };
    } } };
  const route = createReportHandler({ loadAdmin: async () => admin,
    verifyChallenge: async token => token === 'valid-turnstile' ? { ok: true } : { ok: false, reason: 'expired_or_reused' } });
  const call = async (body, appToken = 'valid-app', authToken = 'good') => {
    const result = response();
    await route({ method: 'POST', headers: { authorization: `Bearer ${authToken}`,
      ...(appToken ? { 'x-firebase-appcheck': appToken } : {}) }, body }, result);
    return result;
  };
  try {
    Object.assign(process.env, { REPORT_API_ENABLED: 'true', VERCEL_ENV: 'preview',
      FIREBASE_PROJECT_ID: 'demo-spotfinder-report-pilot', FIREBASE_ALLOWED_APP_IDS: '1:123:web:abc',
      TURNSTILE_SECRET_KEY: 'synthetic-secret', TURNSTILE_ALLOWED_HOSTNAMES: 'spotfinder.live' });
    assert.equal((await call(validBody(), '')).body.code, 'APP_CHECK_REQUIRED');
    assert.equal((await call(validBody(), 'expired-app')).body.code, 'APP_CHECK_INVALID');
    process.env.FIREBASE_ALLOWED_APP_IDS = '1:123:web:other';
    assert.equal((await call(validBody())).body.code, 'APP_CHECK_INVALID');
    process.env.FIREBASE_ALLOWED_APP_IDS = '1:123:web:abc';
    delete process.env.FIREBASE_ALLOWED_APP_IDS;
    assert.equal((await call(validBody())).body.code, 'APP_CHECK_NOT_CONFIGURED');
    process.env.FIREBASE_ALLOWED_APP_IDS = '1:123:web:abc';
    assert.equal((await call(validBody(), 'valid-app', 'invalid-auth')).body.code, 'VERIFIED_AUTH_REQUIRED');
    process.env.TURNSTILE_ALLOWED_HOSTNAMES = ' , ';
    assert.equal((await call(validBody())).body.code, 'REPORT_API_NOT_CONFIGURED');
    process.env.TURNSTILE_ALLOWED_HOSTNAMES = 'spotfinder.live';
    assert.equal([...db.docs.keys()].filter(key => key.startsWith('reports/')).length, 0);
    assert.equal(db.stats.writes, 0);
    assert.equal((await call(validBody('one', 'request_1234567891'))).body.code, 'REPORT_CREATED');
    assert.equal((await call(validBody('two', 'request_1234567892'))).body.code, 'REPORT_CREATED');
    assert.equal((await call(validBody('three', 'request_1234567893'))).body.code, 'CHALLENGE_REQUIRED');
    assert.equal((await call({ ...validBody('three', 'request_1234567893'), turnstileToken: 'expired-turnstile' })).body.code, 'INVALID_CHALLENGE');
    assert.equal((await call({ ...validBody('three', 'request_1234567893'), turnstileToken: 'valid-turnstile' })).body.code, 'REPORT_CREATED');
    assert.equal([...db.docs.keys()].filter(key => key.startsWith('reports/')).length, 3);
    assert.equal(db.stats.writes, 6);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('preview gate blocks production project before loading Admin credentials', async () => {
  const saved = Object.fromEntries(['REPORT_API_ENABLED', 'VERCEL_ENV', 'FIREBASE_PROJECT_ID']
    .map(key => [key, process.env[key]]));
  let loaded = false;
  const route = createReportHandler({ loadAdmin: async () => { loaded = true; throw new Error('must not load'); } });
  const response = { setHeader() {}, status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; } };
  try {
    Object.assign(process.env, { REPORT_API_ENABLED: 'true', VERCEL_ENV: 'preview', FIREBASE_PROJECT_ID: 'spotfinderapp-cdc7b' });
    await route(req(), response);
    assert.equal(response.body.code, 'PREVIEW_PRODUCTION_PROJECT_BLOCKED');
    assert.equal(loaded, false);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
