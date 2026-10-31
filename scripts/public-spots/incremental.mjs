import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { toPublicSnapshotSpot } from '../../src/new/publicSpotSnapshotFormat.js';
import { validateSnapshotArtifacts, writePublicSpotSnapshot } from './export.mjs';

const MAX_CHANGES = 100;
const MAX_REVOCATIONS = 500;

async function currentRevocations(db) {
  const row = await db.collection('spot_snapshot_revocation_feed').doc('current').get();
  const ids = row.exists ? row.data()?.revoked : null;
  if (!Array.isArray(ids) || ids.length >= MAX_REVOCATIONS
    || ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(id)))
    throw new Error('Revocation capacity or feed integrity failed; candidate blocked');
  return new Set(ids);
}

export async function readPreviousCandidate(outputDirectory) {
  const manifest = JSON.parse(await readFile(join(outputDirectory, 'manifest.json'), 'utf8'));
  const files = new Map();
  for (const filename of Object.values(manifest.regions)) {
    files.set(filename, JSON.parse(await readFile(join(outputDirectory, 'v2', filename), 'utf8')));
  }
  validateSnapshotArtifacts({ manifest, files });
  return { manifest, files };
}

async function hasOpenModeration(db, id) {
  const [flags, reports] = await Promise.all([
    db.collection('flags').where('spot_id', '==', id).limit(51).get(),
    db.collection('reports').where('target_id', '==', id).limit(51).get(),
  ]);
  if (flags.size > 50 || reports.size > 50) throw new Error('Moderation lookup limit exceeded');
  return flags.docs.some(doc => doc.data().status === 'open')
    || reports.docs.some(doc => doc.data().target_type === 'spot' && doc.data().status === 'open');
}

// This creates a local candidate only. A deployment must first expose all
// region files and its manifest; only then may acknowledgePublishedCandidate
// be called with its receipt. Pending state is never cleared on export failure.
export async function publishIncrementalCandidate(db, outputDirectory) {
  const previous = await readPreviousCandidate(outputDirectory);
  const changes = await db.collection('spot_snapshot_changes').where('dirty', '==', true).limit(MAX_CHANGES + 1).get();
  if (changes.size > MAX_CHANGES) throw new Error('Change batch limit exceeded; reconcile in smaller batches');
  const revoked = await currentRevocations(db);
  const changedIds = new Set(changes.docs.map(doc => doc.id));
  const byId = new Map([...previous.files.values()].flatMap(file => file.spots)
    .filter(spot => !changedIds.has(spot.id) && !revoked.has(spot.id)).map(spot => [spot.id, spot]));
  const versions = {};
  for (const change of changes.docs) {
    const id = change.id;
    const version = change.data().version;
    if (!Number.isSafeInteger(version) || version < 1) throw new Error('Invalid journal version');
    versions[id] = version;
    if (revoked.has(id)) continue;
    const current = await db.collection('spots').doc(id).get();
    if (!current.exists) continue;
    const spot = toPublicSnapshotSpot({ ...current.data(), id });
    if (spot && !(await hasOpenModeration(db, id))) byId.set(id, spot);
  }
  const result = await writePublicSpotSnapshot([...byId.values()], outputDirectory, { alreadyPublic: true });
  const receipt = { format: 1, revision: result.manifest.revision,
    previousRevision: previous.manifest.revision, createdAt: new Date().toISOString(), versions };
  // If this write fails, journal entries remain dirty and the run can retry.
  await writeFile(`${outputDirectory}.receipt.json`, `${JSON.stringify(receipt)}\n`);
  return { ...result, receipt, changedSpots: changedIds.size };
}

export async function acknowledgePublishedCandidate(db, receipt) {
  if (receipt?.format !== 1 || !/^[a-f0-9]{20}$/.test(receipt.revision)
    || !receipt.versions || Object.keys(receipt.versions).length > MAX_CHANGES)
    throw new Error('Invalid publication receipt');
  const ids = Object.keys(receipt.versions);
  if (ids.some(id => !id || id.includes('/') || !Number.isSafeInteger(receipt.versions[id])))
    throw new Error('Invalid publication receipt');
  return db.runTransaction(async tx => {
    const publicationRef = db.collection('spot_snapshot_publication').doc('current');
    const publication = await tx.get(publicationRef);
    if (publication.exists && publication.data().revision === receipt.revision)
      return { acknowledged: 0, pending: 0, alreadyAcknowledged: true };
    if (publication.exists && publication.data().revision !== receipt.previousRevision)
      throw new Error('Publication checkpoint does not match candidate base');
    const refs = ids.map(id => db.collection('spot_snapshot_changes').doc(id));
    const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
    let acknowledged = 0;
    snapshots.forEach((snapshot, index) => {
      if (snapshot.exists && snapshot.data().version === receipt.versions[ids[index]]) {
        tx.update(refs[index], { dirty: false, published_revision: receipt.revision });
        acknowledged += 1;
      }
    });
    tx.set(publicationRef, {
      revision: receipt.revision, previous_revision: receipt.previousRevision,
      acknowledged_at: new Date().toISOString(), pending_after_ack: ids.length - acknowledged,
    });
    return { acknowledged, pending: ids.length - acknowledged };
  });
}

export { currentRevocations };
