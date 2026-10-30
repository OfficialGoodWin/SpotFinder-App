import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadConfigFromFile } from 'vite';
import { fileURLToPath } from 'node:url';
import { selectBrowserFirebaseConfig } from '../src/lib/stagingFirebaseConfig.js';
import { assertSafeAdminTarget } from '../api/adminTargetPolicy.js';

const viteConfig = (await loadConfigFromFile({ command: 'build', mode: 'test' },
  fileURLToPath(new URL('../vite.config.js', import.meta.url)))).config;

const production = { apiKey: 'prod-key', authDomain: 'prod.firebaseapp.com', projectId: 'spotfinderapp-cdc7b',
  appId: 'prod-app', messagingSenderId: '1', storageBucket: 'prod.firebasestorage.app' };
const staging = { apiKey: 'stage-key', authDomain: 'stage.firebaseapp.com', projectId: 'demo-spotfinder-stage',
  appId: 'stage-app', messagingSenderId: '2', storageBucket: 'stage.firebasestorage.app' };

test('staging web configuration cannot reuse production identity or omit fields', () => {
  assert.deepEqual(selectBrowserFirebaseConfig('staging', production, staging), staging);
  assert.equal(selectBrowserFirebaseConfig('emulator', production, staging).projectId, 'demo-spotfinder-local');
  assert.throws(() => selectBrowserFirebaseConfig('staging', production, { ...staging, projectId: production.projectId }), /separate/);
  assert.throws(() => selectBrowserFirebaseConfig('staging', production, { ...staging, apiKey: production.apiKey }), /separate/);
  assert.throws(() => selectBrowserFirebaseConfig('staging', production, { ...staging, appId: '' }), /incomplete/);
});

test('preview Admin credentials must belong to the staging project', () => {
  const valid = { deployment: 'preview', projectId: 'demo-spotfinder-stage',
    stagingProjectId: 'demo-spotfinder-stage', clientEmail: 'admin@demo-spotfinder-stage.iam.gserviceaccount.com' };
  assert.doesNotThrow(() => assertSafeAdminTarget(valid));
  assert.throws(() => assertSafeAdminTarget({ ...valid, projectId: production.projectId }), /production/);
  assert.throws(() => assertSafeAdminTarget({ ...valid, stagingProjectId: 'other' }), /match/);
  assert.throws(() => assertSafeAdminTarget({ ...valid, clientEmail: 'admin@spotfinderapp-cdc7b.iam.gserviceaccount.com' }), /credentials/);
  assert.throws(() => assertSafeAdminTarget({ ...valid, deployment: undefined, projectId: production.projectId }), /production/);
});

test('Vercel preview build rejects missing or production Firebase configuration', () => {
  const plugin = viteConfig.plugins.find(item => item.name === 'spotfinder-firebase-isolation');
  assert.ok(plugin);
  const previous = { deployment: process.env.VERCEL_ENV, project: process.env.FIREBASE_PROJECT_ID };
  const env = { VITE_SPOTFINDER_STAGE: 'staging', VITE_FIREBASE_STAGING_PROJECT_ID: staging.projectId,
    VITE_FIREBASE_STAGING_API_KEY: staging.apiKey, VITE_FIREBASE_STAGING_AUTH_DOMAIN: staging.authDomain,
    VITE_FIREBASE_STAGING_APP_ID: staging.appId,
    VITE_FIREBASE_STAGING_MESSAGING_SENDER_ID: staging.messagingSenderId,
    VITE_FIREBASE_STAGING_STORAGE_BUCKET: staging.storageBucket,
    VITE_FIREBASE_APP_CHECK_SITE_KEY: 'staging-public-key' };
  try {
    process.env.VERCEL_ENV = 'preview';
    process.env.FIREBASE_PROJECT_ID = staging.projectId;
    assert.doesNotThrow(() => plugin.configResolved({ command: 'build', env }));
    assert.throws(() => plugin.configResolved({ command: 'build', env: { ...env, VITE_SPOTFINDER_STAGE: '' } }), /Nonproduction/);
    assert.throws(() => plugin.configResolved({ command: 'build', env: { ...env, VITE_FIREBASE_STAGING_PROJECT_ID: production.projectId } }), /production/);
    assert.throws(() => plugin.configResolved({ command: 'build', env: { ...env, VITE_FIREBASE_APP_CHECK_SITE_KEY: '' } }), /incomplete/);
    process.env.FIREBASE_PROJECT_ID = production.projectId;
    assert.throws(() => plugin.configResolved({ command: 'build', env }), /does not match/);
  } finally {
    if (previous.deployment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous.deployment;
    if (previous.project === undefined) delete process.env.FIREBASE_PROJECT_ID; else process.env.FIREBASE_PROJECT_ID = previous.project;
  }
});

test('local Vite preview spot page has no Admin SDK lookup', () => {
  const source = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /import\(['"]\.\/api\/_firebaseAdmin\.js['"]\)/);
  assert.match(source, /lookup: getSpotPageFixture/);
});
