import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { processReport } from '../api/reportPilot.js';
import reportClaim from '../functions/reportClaim.js';

const { createLegacyReportWithClaim } = reportClaim;

test('Firestore emulator denies direct report creation and limits report reads to admins', async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Start the Firestore emulator with a demo project');
  const env = await initializeTestEnvironment({
    projectId: 'demo-spotfinder-report-pilot',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
  try {
    const user = env.authenticatedContext('reporter', { email: 'reporter@example.test', email_verified: true }).firestore();
    const admin = env.authenticatedContext('moderator', { admin: true }).firestore();
    const reference = doc(user, 'reports', 'synthetic');
    await assertFails(setDoc(reference, { reporter_uid: 'reporter', status: 'open' }));
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'reports', 'synthetic'), { reporter_uid: 'reporter', status: 'open' });
    });
    await assertFails(getDoc(reference));
    await assertSucceeds(getDoc(doc(admin, 'reports', 'synthetic')));
  } finally { await env.cleanup(); }
});

test('real Firestore emulator transaction permits one of two racing reports', async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Start the Firestore emulator with a demo project');
  const app = initializeApp({ projectId: 'demo-spotfinder-report-pilot' }, 'report-pilot-integration');
  try {
    const db = getFirestore(app);
    await db.collection('spots').doc('race-target').set({ status: 'published', is_public: true, title: 'Synthetic spot' });
    const deps = { db, now: () => Date.parse('2026-10-29T12:00:00Z'),
      challengeSecret: 'test-secret', allowedHostnames: ['spotfinder.live'],
      verifyAuth: async () => ({ uid: 'race-user', email_verified: true, firebase: { sign_in_provider: 'password' } }),
      verifyChallenge: async () => ({ ok: true }) };
    const body = idempotencyKey => ({ category: 'spam_scam', subject: 'Synthetic report', message: '',
      targetType: 'spot', targetId: 'race-target', idempotencyKey, targetSnapshot: {} });
    const request = value => ({ method: 'POST', headers: { authorization: 'Bearer synthetic' }, body: value });
    const [first, second] = await Promise.all([
      processReport(request(body('racing_request_111111')), deps),
      processReport(request(body('racing_request_222222')), deps),
    ]);
    assert.equal([first.body.code, second.body.code].filter(code => code === 'REPORT_CREATED').length, 1);
    assert.equal([first.body.code, second.body.code].filter(code => code === 'ALREADY_REPORTED').length, 1);
  } finally { await deleteApp(app); }
});

test('legacy callable claim and API transaction cannot create parallel open reports', async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Start the Firestore emulator with a demo project');
  const app = initializeApp({ projectId: 'demo-spotfinder-report-cross-path' }, 'report-cross-path');
  try {
    const db = getFirestore(app);
    const uid = 'cross-user';
    const targetKey = 'spot:cross-target';
    await db.collection('spots').doc('cross-target').set({ status: 'published', is_public: true });
    const now = Date.parse('2026-10-29T12:00:00Z');
    const api = processReport({ method: 'POST', headers: { authorization: 'Bearer synthetic' }, body: {
      category: 'spam_scam', subject: 'Synthetic', message: '', targetType: 'spot',
      targetId: 'cross-target', idempotencyKey: 'cross_path_request_12345', targetSnapshot: {},
    } }, { db, now: () => now, challengeSecret: 'test-secret', allowedHostnames: ['spotfinder.live'],
      verifyAuth: async () => ({ uid, email_verified: true, firebase: { sign_in_provider: 'password' } }),
      verifyChallenge: async () => ({ ok: true }) });
    const legacy = createLegacyReportWithClaim({ db, uid, targetKey, now, report: {
      category: 'spam_scam', subject: 'Synthetic', message: '', target_type: 'spot',
      target_id: 'cross-target', target_key: targetKey, status: 'open', reporter_uid: uid,
    } });
    const [apiResult, legacyResult] = await Promise.all([api, legacy]);
    const outcomes = [apiResult.body.code, legacyResult.alreadyReported ? 'ALREADY_REPORTED' : 'REPORT_CREATED'];
    assert.equal(outcomes.filter(code => code === 'REPORT_CREATED').length, 1);
    assert.equal(outcomes.filter(code => code === 'ALREADY_REPORTED').length, 1);
    const reports = await db.collection('reports').where('reporter_uid', '==', uid)
      .where('target_key', '==', targetKey).get();
    assert.equal(reports.size, 1);
  } finally { await deleteApp(app); }
});
