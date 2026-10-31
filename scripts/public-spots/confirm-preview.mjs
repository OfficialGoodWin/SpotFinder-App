import { readFile } from 'node:fs/promises';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { validateSnapshotArtifacts } from './export.mjs';
import { acknowledgePublishedCandidate } from './incremental.mjs';
import { assertPublisherTarget } from './publish.mjs';
import { snapshotRegionDirectory } from '../../src/new/publicSpotSnapshotFormat.js';

const [projectId, originText, candidateDirectory] = process.argv.slice(2);
if (process.argv.length !== 5 || !projectId || !originText || !candidateDirectory
  || process.env.SNAPSHOT_STAGING_CONFIRM !== 'yes') {
  throw new Error('Usage: SNAPSHOT_STAGING_CONFIRM=yes node confirm-preview.mjs STAGING_PROJECT https://PREVIEW.vercel.app CANDIDATE_DIRECTORY');
}
assertPublisherTarget({ mode: 'staging', projectId,
  emulatorHost: process.env.FIRESTORE_EMULATOR_HOST, approved: true });
const origin = new URL(originText);
if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash
  || !origin.hostname.endsWith('.vercel.app') || origin.hostname === 'spotfinder.vercel.app')
  throw new Error('Only an explicit HTTPS Vercel Preview origin is accepted');
const receipt = JSON.parse(await readFile(`${candidateDirectory}.receipt.json`, 'utf8'));
const headers = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {};
const readJson = async path => {
  const response = await fetch(new URL(path, origin), { headers, cache: 'no-store', redirect: 'error' });
  if (!response.ok) throw new Error(`Preview verification failed: ${path} HTTP ${response.status}`);
  return response.json();
};
const target = await readJson('/spotfinder-build-target.json');
if (target.stage !== 'staging' || target.projectId !== projectId) throw new Error('Preview Firebase target mismatch');
const manifest = await readJson('/spot-snapshots/manifest.json');
if (manifest.revision !== receipt.revision) throw new Error('Preview revision mismatch');
const directory = snapshotRegionDirectory(manifest.format);
const files = new Map();
for (const filename of Object.values(manifest.regions)) {
  files.set(filename, await readJson(`/spot-snapshots/${directory}/${filename}`));
}
validateSnapshotArtifacts({ manifest, files });
const revocationResponse = await fetch(new URL('/api/spot-snapshot-revocations', origin), {
  headers, cache: 'no-store', redirect: 'error',
});
if (!revocationResponse.ok) throw new Error('Preview revocation endpoint unavailable');
const feed = await revocationResponse.json();
if (feed.format !== 1 || !Array.isArray(feed.revoked) || feed.revoked.length > 500)
  throw new Error('Invalid Preview revocation feed');
const db = getFirestore(initializeApp({ projectId, credential: applicationDefault() }, 'snapshot-preview-confirm'));
const acknowledged = await acknowledgePublishedCandidate(db, receipt);
console.log(JSON.stringify({ revision: receipt.revision, verifiedRegions: files.size, ...acknowledged }));
