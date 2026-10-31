import { readFile } from 'node:fs/promises';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { assertPublisherTarget } from './publish.mjs';

export async function inspectSnapshotHealth(db, { candidateDirectory, now = Date.now(), maxPendingAgeMs = 15 * 60 * 1000 } = {}) {
  const [pending, failures, feed, checkpoint] = await Promise.all([
    db.collection('spot_snapshot_changes').where('dirty', '==', true)
      .orderBy('updated_at', 'asc').limit(101).get(),
    db.collection('spot_snapshot_failures').where('resolved', '==', false).limit(101).get(),
    db.collection('spot_snapshot_revocation_feed').doc('current').get(),
    db.collection('spot_snapshot_publication').doc('current').get(),
  ]);
  const ages = pending.docs.map(doc => Date.parse(doc.data().updated_at)).filter(Number.isFinite)
    .map(timestamp => Math.max(0, now - timestamp));
  const oldestPendingAgeMs = ages.length ? Math.max(...ages) : null;
  const ids = feed.exists ? feed.data()?.revoked : null;
  const feedValid = Array.isArray(ids) && ids.length < 500
    && ids.every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(id));
  let candidate = null;
  let fullReconciliation = null;
  let manifest = null;
  if (candidateDirectory) {
    manifest = await readFile(`${candidateDirectory}/manifest.json`, 'utf8').then(JSON.parse).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    candidate = await readFile(`${candidateDirectory}.receipt.json`, 'utf8').then(JSON.parse).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    fullReconciliation = await readFile(`${candidateDirectory}.full-reconciliation.json`, 'utf8').then(JSON.parse).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
  }
  const issues = [];
  if (!feedValid) issues.push('revocation-feed-unavailable-or-full');
  if (pending.size > 100) issues.push('pending-batch-overflow');
  if (failures.size) issues.push('failed-journal-events');
  if (oldestPendingAgeMs != null && oldestPendingAgeMs > maxPendingAgeMs) issues.push('old-pending-change');
  if (checkpoint.exists && candidate && checkpoint.data().revision !== candidate.previousRevision
    && checkpoint.data().revision !== candidate.revision) issues.push('inconsistent-candidate-base');
  return { ok: issues.length === 0, issues, pendingCountAtLeast: pending.size,
    pendingCountCapped: pending.size >= 101, oldestPendingAgeMs,
    failedEventCountAtLeast: failures.size, revocationCount: feedValid ? ids.length : null,
    revocationAvailable: feedValid,
    lastCandidateAt: candidate?.createdAt || manifest?.publishedAt || null,
    lastConfirmedAt: checkpoint.exists ? checkpoint.data().acknowledged_at || null : null,
    lastConfirmedRevision: checkpoint.exists ? checkpoint.data().revision || null : null,
    lastFullReconciliationAt: fullReconciliation?.at || null };
}

if (process.argv[1]?.endsWith('health.mjs')) {
  const args = process.argv.slice(2);
  const value = flag => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
  const mode = value('--mode'), projectId = value('--project'), candidateDirectory = value('--candidate');
  assertPublisherTarget({ mode, projectId, emulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
    approved: args.includes('--read-approved') });
  const app = initializeApp(mode === 'emulator' ? { projectId }
    : { projectId, credential: applicationDefault() }, 'snapshot-health');
  const result = await inspectSnapshotHealth(getFirestore(app), { candidateDirectory });
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
