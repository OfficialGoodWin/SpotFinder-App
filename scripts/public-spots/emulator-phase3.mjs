import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { assertPublisherTarget, publishFromFirestore } from './publish.mjs';
import { acknowledgePublishedCandidate, publishIncrementalCandidate } from './incremental.mjs';
import { regionForPoint } from '../../src/new/publicSpotSnapshotFormat.js';
import { inspectSnapshotHealth } from './health.mjs';

const require = createRequire(import.meta.url);
const { recordSpotChange, mutateSpotWithPublication } = require('../../functions/publicSpotPublication.js');
const projectId = 'demo-spotfinder-snapshots';
assertPublisherTarget({ mode: 'emulator', projectId, emulatorHost: process.env.FIRESTORE_EMULATOR_HOST });
const db = getFirestore(initializeApp({ projectId }, 'snapshot-phase3-emulator'));
const root = await mkdtemp(join(tmpdir(), 'spotfinder-phase3-'));
const output = join(root, 'spot-snapshots');
const spotRef = db.collection('spots').doc('phase3-synthetic');
const base = { is_public: true, status: 'published', lat: 50.1, lng: 14.1,
  title: 'Phase 3 synthetic', created_date: '2026-10-31', flag_count: 0,
  created_by_uid: 'private-phase3-uid' };
try {
  await db.collection('spot_snapshot_revocation_feed').doc('current').set({ format: 1, revoked: [] });
  const unauthorized = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/spot_snapshot_revocation_feed/current`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { revoked: { arrayValue: { values: [{ stringValue: 'forged' }] } } } }),
  });
  assert.equal(unauthorized.status, 403);
  await spotRef.set(base);
  assert.equal(await recordSpotChange(db, spotRef.id), true);
  assert.equal(await recordSpotChange(db, spotRef.id), false);
  const first = await publishFromFirestore({ mode: 'emulator', projectId, outputDirectory: output });
  await acknowledgePublishedCandidate(db, { format: 1, revision: first.revision,
    previousRevision: '0'.repeat(20), versions: { [spotRef.id]: 1 } });
  await spotRef.update({ rating: 4.5, rating_count: 3 });
  assert.equal(await recordSpotChange(db, spotRef.id), false);
  await spotRef.update({ lng: 16.1 });
  assert.equal(await recordSpotChange(db, spotRef.id), true);
  const moved = await publishIncrementalCandidate(db, output);
  let manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
  assert.equal(Object.hasOwn(manifest.regions, regionForPoint(base.lat, base.lng)), false);
  assert.equal(Object.hasOwn(manifest.regions, regionForPoint(base.lat, 16.1)), true);
  await spotRef.update({ title: 'Concurrent edit' });
  await recordSpotChange(db, spotRef.id);
  const staleAck = await acknowledgePublishedCandidate(db, moved.receipt);
  assert.equal(staleAck.acknowledged, 0);
  assert.equal((await db.collection('spot_snapshot_changes').doc(spotRef.id).get()).data().dirty, true);
  await spotRef.update({ status: 'hidden' });
  await recordSpotChange(db, spotRef.id);
  const feed = (await db.collection('spot_snapshot_revocation_feed').doc('current').get()).data();
  assert.deepEqual(feed.revoked, [spotRef.id]);
  await publishIncrementalCandidate(db, output);
  manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.regions, {});
  await spotRef.delete();
  await recordSpotChange(db, spotRef.id);
  assert.deepEqual((await db.collection('spot_snapshot_revocation_feed').doc('current').get()).data().revoked, [spotRef.id]);
  const pendingRef = db.collection('spots').doc('phase3-pending');
  await pendingRef.set({ ...base, status: 'pending_trust' });
  await recordSpotChange(db, pendingRef.id);
  assert.deepEqual((await db.collection('spot_snapshot_revocation_feed').doc('current').get()).data().revoked, [spotRef.id]);
  const denied = await mutateSpotWithPublication(db, pendingRef.id,
    { patch: { title: 'Unauthorized' }, authorize: () => false });
  assert.equal(denied.authorized, false);
  assert.equal((await pendingRef.get()).data().title, base.title);
  await mutateSpotWithPublication(db, pendingRef.id, { patch: { status: 'published' } });
  assert.deepEqual((await db.collection('spot_snapshot_revocation_feed').doc('current').get()).data().revoked, [spotRef.id]);
  await mutateSpotWithPublication(db, pendingRef.id, { remove: true });
  assert.equal((await pendingRef.get()).exists, false);
  assert.deepEqual((await db.collection('spot_snapshot_revocation_feed').doc('current').get()).data().revoked,
    [spotRef.id, pendingRef.id]);
  const health = await inspectSnapshotHealth(db, { candidateDirectory: output });
  assert.equal(health.revocationAvailable, true);
  assert.equal(health.pendingCountAtLeast > 0, true);
  const failureRef = db.collection('spot_snapshot_failures').doc('synthetic-failure');
  await failureRef.set({ kind: 'spot', attempts: 2, resolved: false,
    last_failure_at: new Date().toISOString() });
  assert.equal((await inspectSnapshotHealth(db)).ok, false);
  await failureRef.update({ resolved: true });
  assert.equal((await inspectSnapshotHealth(db)).ok, true);
  console.log(JSON.stringify({ passed: true, checks: 23 }));
} finally {
  if (!resolve(root).startsWith(resolve(tmpdir(), 'spotfinder-phase3-'))) throw new Error('Unsafe cleanup target');
  await rm(root, { recursive: true, force: true });
}
