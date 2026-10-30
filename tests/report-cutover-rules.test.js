import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { processReport } from '../api/reportPilot.js';

test('report cutover denies direct flags and reports while trusted moderation and spot edits remain available', async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Use the Firestore emulator with a demo project');
  const env = await initializeTestEnvironment({
    projectId: 'demo-spotfinder-report-cutover',
    firestore: { rules: readFileSync(new URL('../firestore.report-cutover.rules', import.meta.url), 'utf8') },
  });
  const owner = env.authenticatedContext('owner', { email: 'owner@example.test', email_verified: true }).firestore();
  const admin = env.authenticatedContext('admin', { admin: true }).firestore();
  const guest = env.unauthenticatedContext().firestore();
  const app = initializeApp({ projectId: 'demo-spotfinder-report-cutover' }, 'report-cutover-api');
  const flag = { spot_id: 'spot-one', reporter_email: 'owner@example.test', reason: 'spam',
    note: 'Synthetic', status: 'open', created_date: '2026-10-29T00:00:00Z' };
  try {
    await env.withSecurityRulesDisabled(async context => {
      const trusted = context.firestore();
      await setDoc(doc(trusted, 'spots', 'spot-one'), { title: 'Original', description: '',
        created_by_uid: 'owner', is_public: true, status: 'published', flag_count: 0 });
      await setDoc(doc(trusted, 'flags', 'existing'), flag);
      await setDoc(doc(trusted, 'reports', 'existing'), { reporter_uid: 'owner', status: 'open' });
    });
    await assertSucceeds(updateDoc(doc(owner, 'spots', 'spot-one'), { title: 'Edited' }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { flag_count: 9 }));
    await assertFails(setDoc(doc(owner, 'flags', 'spot-one_owner@example.test'), flag));
    await assertFails(setDoc(doc(admin, 'flags', 'admin-forgery'), flag));
    await assertFails(setDoc(doc(guest, 'flags', 'guest-forgery'), flag));
    await assertFails(setDoc(doc(owner, 'reports', 'forgery'), { reporter_uid: 'owner', status: 'open' }));
    await assertSucceeds(getDoc(doc(admin, 'flags', 'existing')));
    await assertSucceeds(getDoc(doc(admin, 'reports', 'existing')));
    await assertFails(getDoc(doc(owner, 'reports', 'existing')));
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'flags', 'trusted-server'), flag);
      await setDoc(doc(context.firestore(), 'reports', 'trusted-server'), { reporter_uid: 'owner', status: 'open' });
    });
    await assertSucceeds(getDoc(doc(admin, 'flags', 'trusted-server')));
    await assertSucceeds(getDoc(doc(admin, 'reports', 'trusted-server')));
    const created = await processReport({ method: 'POST', headers: { authorization: 'Bearer synthetic' }, body: {
      category: 'spam_scam', subject: 'Synthetic', message: '', targetType: 'spot',
      targetId: 'spot-one', idempotencyKey: 'cutover_request_123456', targetSnapshot: {},
    } }, { db: getFirestore(app), now: () => Date.parse('2026-10-29T12:00:00Z'),
      verifyAuth: async () => ({ uid: 'owner', email: 'owner@example.test', email_verified: true,
        firebase: { sign_in_provider: 'password' } }), challengeSecret: 'test-secret',
      allowedHostnames: ['spotfinder.live'], verifyChallenge: async () => ({ ok: true }) });
    assert.equal(created.body.code, 'REPORT_CREATED');
    await assertSucceeds(getDoc(doc(admin, 'reports', created.body.id)));
  } finally {
    await deleteApp(app);
    await env.cleanup();
  }
});

test('cutover candidate differs from active rules only at direct flag creation', () => {
  const active = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const candidate = readFileSync(new URL('../firestore.report-cutover.rules', import.meta.url), 'utf8');
  const oldCreate = /      allow create: if canSubmit\(\) && request\.auth\.token\.email_verified == true\s+&& request\.resource\.data\.spot_id is string[\s\S]*?\['private_property', 'dangerous', 'duplicate', 'spam', 'inaccurate_location'\];/;
  assert.match(active, oldCreate);
  const expected = active.replace(oldCreate,
    '      // Report creation is server-only after the API cutover. Cached clients use submitReport.\n      allow create: if false;');
  assert.equal(candidate, expected);
});
