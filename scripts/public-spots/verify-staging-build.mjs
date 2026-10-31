import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { writePublicSpotSnapshot } from './export.mjs';

const root = await mkdtemp(join(tmpdir(), 'spotfinder-staging-build-'));
const candidate = join(root, 'spot-snapshots');
const run = env => {
  const result = spawnSync(process.execPath, ['scripts/public-spots/build-vercel.mjs'],
    { env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Build wrapper exited ${result.status}`);
};
try {
  const built = await writePublicSpotSnapshot([{ id: 'synthetic-build', lat: 50, lng: 14,
    title: 'Synthetic build', is_public: true, status: 'published', created_date: '2026-10-31' }], candidate);
  const project = 'demo-spotfinder-staging';
  run({ ...process.env, VERCEL_ENV: 'preview', FIREBASE_PROJECT_ID: project,
    SPOTFINDER_SNAPSHOT_PREVIEW_APPROVED: 'true', SPOTFINDER_SNAPSHOT_CANDIDATE_DIRECTORY: candidate,
    VITE_PUBLIC_SPOT_SNAPSHOTS: 'true', VITE_ORIGINAL_MAP_SNAPSHOTS: 'true',
    VITE_SPOTFINDER_STAGE: 'staging',
    VITE_FIREBASE_STAGING_API_KEY: 'synthetic', VITE_FIREBASE_STAGING_AUTH_DOMAIN: `${project}.invalid`,
    VITE_FIREBASE_STAGING_PROJECT_ID: project, VITE_FIREBASE_STAGING_APP_ID: 'synthetic',
    VITE_FIREBASE_STAGING_MESSAGING_SENDER_ID: 'synthetic',
    VITE_FIREBASE_STAGING_STORAGE_BUCKET: `${project}.invalid`, VITE_FIREBASE_APP_CHECK_SITE_KEY: 'synthetic' });
  const manifest = JSON.parse(await readFile('dist/spot-snapshots/manifest.json', 'utf8'));
  assert.equal(manifest.revision, built.manifest.revision);
  console.log(JSON.stringify({ stagingBuildPassed: true, revision: manifest.revision }));
} finally {
  try {
    const production = { ...process.env, VERCEL_ENV: 'production',
      SPOTFINDER_SNAPSHOT_PREVIEW_APPROVED: '', VITE_PUBLIC_SPOT_SNAPSHOTS: '',
      VITE_ORIGINAL_MAP_SNAPSHOTS: '',
      VITE_SPOTFINDER_STAGE: '', SPOTFINDER_SNAPSHOT_CANDIDATE_DIRECTORY: '' };
    run(production);
    const emitted = await readFile('dist/spotfinder-build-target.json', 'utf8').then(JSON.parse);
    assert.equal(emitted.stage, '');
  } finally {
    if (!resolve(root).startsWith(resolve(tmpdir(), 'spotfinder-staging-build-'))) throw new Error('Unsafe cleanup');
    await rm(root, { recursive: true, force: true });
  }
}
