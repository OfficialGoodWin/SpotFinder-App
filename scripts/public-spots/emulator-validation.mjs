import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { assertPublisherTarget, publishFromFirestore } from './publish.mjs';

const projectId = 'demo-spotfinder-snapshots';
assertPublisherTarget({ mode: 'emulator', projectId, emulatorHost: process.env.FIRESTORE_EMULATOR_HOST });
const db = getFirestore(initializeApp({ projectId }, 'spotfinder-snapshot-emulator-seed'));
const root = await mkdtemp(join(tmpdir(), 'spotfinder-snapshot-emulator-'));
const outputDirectory = join(root, 'spot-snapshots');
const base = { is_public: true, status: 'published', lat: 50.08, lng: 14.42,
  title: 'Synthetic Castle', category: 'castle', created_date: '2026-10-30', flag_count: 0,
  created_by_uid: 'private-synthetic-uid', description: 'Synthetic private detail' };
try {
  await db.collection('spot_snapshot_revocation_feed').doc('current').set({ format: 1, revoked: [] });
  await db.collection('spots').doc('synthetic-visible').set(base);
  await db.collection('spots').doc('synthetic-reported').set({ ...base, title: 'Reported spot' });
  await db.collection('spots').doc('synthetic-pending').set({ ...base, status: 'pending_trust' });
  await db.collection('flags').doc('synthetic-open').set({ spot_id: 'synthetic-reported', status: 'open' });
  const first = await publishFromFirestore({ mode: 'emulator', projectId, outputDirectory });
  let manifest = JSON.parse(await readFile(join(outputDirectory, 'manifest.json'), 'utf8'));
  let filename = Object.values(manifest.regions)[0];
  let region = JSON.parse(await readFile(join(outputDirectory, 'v2', filename), 'utf8'));
  assert.deepEqual(region.spots.map(spot => spot.id), ['synthetic-visible']);
  assert.equal(JSON.stringify(region).includes('private-synthetic-uid'), false);
  assert.equal(first.excludedReportedIds, 1);

  await db.collection('spots').doc('synthetic-visible').update({ title: 'Edited synthetic Castle' });
  const edited = await publishFromFirestore({ mode: 'emulator', projectId, outputDirectory });
  assert.equal(edited.changedRegions, 1);
  await db.collection('spots').doc('synthetic-visible').delete();
  const deleted = await publishFromFirestore({ mode: 'emulator', projectId, outputDirectory });
  manifest = JSON.parse(await readFile(join(outputDirectory, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.regions, {});
  assert.equal(deleted.included, 0);
  console.log(JSON.stringify({ passed: true, first, edited, deleted }));
} finally {
  if (!resolve(root).startsWith(resolve(tmpdir(), 'spotfinder-snapshot-emulator-'))) throw new Error('Unsafe emulator cleanup');
  await rm(root, { recursive: true, force: true });
}
