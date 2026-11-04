import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { snapshotRevocationTargetEnabled } from '../api/spot-snapshot-revocations.js';

const production = {
  VERCEL_ENV: 'production',
  FIREBASE_PROJECT_ID: 'spotfinderapp-cdc7b',
  SPOTFINDER_SNAPSHOT_PRODUCTION_APPROVED: 'true',
  VITE_SNAPSHOT_PRODUCTION_RELEASE: 'true',
  VITE_PUBLIC_SPOT_SNAPSHOTS: 'true',
};

test('production revocation endpoint requires the approved snapshot target', () => {
  assert.equal(snapshotRevocationTargetEnabled(production), true);
  for (const key of Object.keys(production))
    assert.equal(snapshotRevocationTargetEnabled({ ...production, [key]: '' }), false, key);
  assert.equal(snapshotRevocationTargetEnabled({ ...production, FIREBASE_PROJECT_ID: 'other' }), false);
});

test('preview revocation endpoint stays isolated to its staging project', () => {
  assert.equal(snapshotRevocationTargetEnabled({ VERCEL_ENV: 'preview', FIREBASE_PROJECT_ID: 'demo-stage',
    VITE_FIREBASE_STAGING_PROJECT_ID: 'demo-stage' }), true);
  assert.equal(snapshotRevocationTargetEnabled({ VERCEL_ENV: 'preview', FIREBASE_PROJECT_ID: 'spotfinderapp-cdc7b',
    VITE_FIREBASE_STAGING_PROJECT_ID: 'demo-stage' }), false);
});

test('disabled endpoint returns 404 before loading Firebase Admin', async () => {
  let status;
  const response = { setHeader() {}, status(value) { status = value; return this; }, end() { return this; } };
  await handler({ method: 'GET' }, response);
  assert.equal(status, 404);
});
