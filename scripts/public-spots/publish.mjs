import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { writePublicSpotSnapshot } from './export.mjs';
import { publishIncrementalCandidate, currentRevocations } from './incremental.mjs';

const DEMO_PROJECT = 'demo-spotfinder-snapshots';
const PRODUCTION_PROJECT = 'spotfinderapp-cdc7b';
const PAGE_SIZE = 500;
const MAX_STAGING_DOCUMENTS = 50000;

export function assertPublisherTarget({ mode, projectId, emulatorHost, approved }) {
  if (mode === 'emulator') {
    if (projectId !== DEMO_PROJECT || !/^(?:localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(emulatorHost || ''))
      throw new Error('Emulator publisher requires the demo project and a loopback Firestore emulator');
  } else if (mode === 'staging') {
    if (!approved || !/^[a-z][a-z0-9-]{5,29}$/.test(projectId || '')
      || projectId === PRODUCTION_PROJECT || emulatorHost)
      throw new Error('Staging publisher requires an explicitly approved nonproduction project and no emulator host');
  } else throw new Error('Publisher mode must be emulator or staging');
}

export async function readAuthoritativeSnapshot(db, { maxDocuments = MAX_STAGING_DOCUMENTS } = {}) {
  const { FieldPath } = await import('firebase-admin/firestore');
  const excludedIds = new Set();
  let reads = 0;
  let queries = 0;
  const pageCollection = async (name, consume) => {
    let cursor = null;
    for (;;) {
      let query = db.collection(name).orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      queries += 1; reads += page.size;
      if (reads > maxDocuments) throw new Error(`Staging read budget exceeded: ${maxDocuments} documents`);
      for (const doc of page.docs) consume(doc);
      if (page.size < PAGE_SIZE) break;
      cursor = page.docs.at(-1);
    }
  };
  await pageCollection('flags', doc => {
    const data = doc.data();
    if (data.status === 'open' && typeof data.spot_id === 'string') excludedIds.add(data.spot_id);
  });
  await pageCollection('reports', doc => {
    const data = doc.data();
    if (data.status === 'open' && data.target_type === 'spot' && typeof data.target_id === 'string') excludedIds.add(data.target_id);
  });
  for (const id of await currentRevocations(db)) excludedIds.add(id);
  const records = [];
  await pageCollection('spots', doc => records.push({ ...doc.data(), id: doc.id }));
  return { records, excludedIds, stats: { firestoreQueries: queries, firestoreDocumentsReturned: reads,
    excludedReportedIds: excludedIds.size } };
}

export async function publishFromFirestore({ mode, projectId, outputDirectory, approved = false,
  emulatorHost = process.env.FIRESTORE_EMULATOR_HOST, readBudget = MAX_STAGING_DOCUMENTS,
  incremental = false } = {}) {
  assertPublisherTarget({ mode, projectId, emulatorHost, approved });
  if (!outputDirectory) throw new Error('An explicit output directory is required');
  const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = getApps().find(candidate => candidate.name === 'spotfinder-snapshot-publisher')
    || initializeApp(mode === 'emulator' ? { projectId } : { projectId, credential: applicationDefault() }, 'spotfinder-snapshot-publisher');
  if (incremental) {
    const result = await publishIncrementalCandidate(getFirestore(app), outputDirectory);
    return { ...result.stats, changedSpots: result.changedSpots,
      revision: result.manifest.revision, projectId, mode };
  }
  const { records, excludedIds, stats } = await readAuthoritativeSnapshot(getFirestore(app), { maxDocuments: readBudget });
  const result = await writePublicSpotSnapshot(records, outputDirectory, { excludedIds });
  await writeFile(`${outputDirectory}.full-reconciliation.json`, JSON.stringify({
    at: new Date().toISOString(), revision: result.manifest.revision,
    documentsRead: stats.firestoreDocumentsReturned }) + '\n');
  return { ...stats, ...result.stats, revision: result.manifest.revision, projectId, mode };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const value = flag => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
  const mode = value('--mode');
  const projectId = value('--project');
  const outputDirectory = value('--out');
  const approved = args.includes('--read-approved');
  const incremental = args.includes('--incremental');
  const expected = (mode === 'staging' ? 7 : 6) + (incremental ? 1 : 0);
  if (!mode || !projectId || !outputDirectory || args.length !== expected)
    throw new Error('Usage: node publish.mjs --mode emulator|staging --project PROJECT --out DIRECTORY [--read-approved] [--incremental]');
  const result = await publishFromFirestore({ mode, projectId, outputDirectory, approved, incremental });
  console.log(JSON.stringify(result));
}
