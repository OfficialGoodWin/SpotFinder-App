import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { assertPublisherTarget } from './publish.mjs';

const [projectId, approval] = process.argv.slice(2);
if (process.argv.length !== 4 || approval !== '--approved')
  throw new Error('Usage: node seed-staging.mjs STAGING_PROJECT --approved');
assertPublisherTarget({ mode: 'staging', projectId,
  emulatorHost: process.env.FIRESTORE_EMULATOR_HOST, approved: true });
const db = getFirestore(initializeApp({ projectId, credential: applicationDefault() }, 'snapshot-feed-seed'));
const feedRef = db.collection('spot_snapshot_revocation_feed').doc('current');
const publicationRef = db.collection('spot_snapshot_publication').doc('current');
await db.runTransaction(async tx => {
  const [feed, publication] = await Promise.all([tx.get(feedRef), tx.get(publicationRef)]);
  if (feed.exists || publication.exists)
    throw new Error('Snapshot state already exists; refusing to reset revocations');
  tx.create(feedRef, { format: 1, revoked: [], updated_at: new Date().toISOString() });
});
console.log(JSON.stringify({ projectId, seeded: true }));
