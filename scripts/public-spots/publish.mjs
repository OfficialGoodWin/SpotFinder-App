import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { snapshotRegionDirectory } from '../../src/new/publicSpotSnapshotFormat.js';
import { writePublicSpotSnapshot } from './export.mjs';
import { publishIncrementalCandidate, currentRevocations } from './incremental.mjs';

const DEMO_PROJECT = 'demo-spotfinder-snapshots';
const PRODUCTION_PROJECT = 'spotfinderapp-cdc7b';
const PAGE_SIZE = 500;
const MAX_STAGING_DOCUMENTS = 50000;
const MAX_PRODUCTION_DOCUMENTS = 3000;
const SPOT_FIELDS = ['is_public', 'status', 'needs_review', 'discovery_state', 'flag_count',
  'sensitive_location', 'lat', 'lng', 'public_thumbnail_url', 'title', 'category',
  'spot_type', 'resolved_category', 'tags', 'locality', 'rating', 'rating_count',
  'access_difficulty', 'has_social', 'created_date'];

export function assertPublisherTarget({ mode, projectId, emulatorHost, approved }) {
  if (mode === 'emulator') {
    if (projectId !== DEMO_PROJECT || !/^(?:localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(emulatorHost || ''))
      throw new Error('Emulator publisher requires the demo project and a loopback Firestore emulator');
  } else if (mode === 'staging') {
    if (!approved || !/^[a-z][a-z0-9-]{5,29}$/.test(projectId || '')
      || projectId === PRODUCTION_PROJECT || emulatorHost)
      throw new Error('Staging publisher requires an explicitly approved nonproduction project and no emulator host');
  } else if (mode === 'production') {
    if (!approved || projectId !== PRODUCTION_PROJECT || emulatorHost)
      throw new Error('Production publisher requires explicit approval, exact project and no emulator');
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
      const requested = Math.min(PAGE_SIZE, maxDocuments - reads + 1);
      let query = db.collection(name).orderBy(FieldPath.documentId()).limit(requested);
      if (cursor) query = query.startAfter(cursor);
      query = query.select(...(name === 'spots' ? SPOT_FIELDS : name === 'flags'
        ? ['status', 'spot_id'] : ['status', 'target_type', 'target_id']));
      const page = await query.get();
      queries += 1; reads += page.size;
      if (reads > maxDocuments) throw new Error(`Snapshot read budget exceeded: ${maxDocuments} documents`);
      for (const doc of page.docs) consume(doc);
      if (page.size < requested) break;
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
  reads += 1; queries += 1;
  if (reads > maxDocuments) throw new Error(`Snapshot read budget exceeded: ${maxDocuments} documents`);
  const records = [];
  await pageCollection('spots', doc => records.push({ ...doc.data(), id: doc.id }));
  return { records, excludedIds, stats: { firestoreQueries: queries, firestoreDocumentsReturned: reads,
    excludedReportedIds: excludedIds.size } };
}

export async function preflightProductionSnapshot(db, maxDocuments = MAX_PRODUCTION_DOCUMENTS) {
  if (!Number.isSafeInteger(maxDocuments) || maxDocuments < 1 || maxDocuments > MAX_PRODUCTION_DOCUMENTS)
    throw new Error('Invalid production read budget');
  const counts = {};
  for (const name of ['flags', 'reports', 'spots']) {
    counts[name] = (await db.collection(name).count().get()).data().count;
    if (!Number.isSafeInteger(counts[name]) || counts[name] < 0) throw new Error('Invalid collection count');
  }
  const projectedDocuments = counts.flags + counts.reports + counts.spots + 1;
  if (projectedDocuments > maxDocuments)
    throw new Error(`Production candidate exceeds read budget: ${projectedDocuments} documents including feed; limit ${maxDocuments}`);
  return { counts, projectedDocuments, aggregationQueries: 3 };
}

export async function publishFromFirestore({ mode, projectId, outputDirectory, approved = false,
  emulatorHost = process.env.FIRESTORE_EMULATOR_HOST, readBudget = mode === 'production' ? MAX_PRODUCTION_DOCUMENTS : MAX_STAGING_DOCUMENTS,
  incremental = false } = {}) {
  assertPublisherTarget({ mode, projectId, emulatorHost, approved });
  if (!Number.isSafeInteger(readBudget) || readBudget < 1 || (mode === 'production' && readBudget > MAX_PRODUCTION_DOCUMENTS))
    throw new Error('Invalid or excessive publisher read budget');
  if (mode === 'production' && incremental) throw new Error('Production release requires bounded full reconciliation');
  if (!outputDirectory) throw new Error('An explicit output directory is required');
  const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = getApps().find(candidate => candidate.name === 'spotfinder-snapshot-publisher')
    || initializeApp(mode === 'emulator' ? { projectId } : { projectId, credential: applicationDefault() }, 'spotfinder-snapshot-publisher');
  const db = getFirestore(app);
  const preflight = mode === 'production' ? await preflightProductionSnapshot(db, readBudget) : null;
  if (incremental) {
    const result = await publishIncrementalCandidate(db, outputDirectory);
    return { ...result.stats, changedSpots: result.changedSpots,
      revision: result.manifest.revision, projectId, mode };
  }
  const { records, excludedIds, stats } = await readAuthoritativeSnapshot(db, { maxDocuments: readBudget });
  const result = await writePublicSpotSnapshot(records, outputDirectory, { excludedIds });
  let artifactBytes = (await stat(join(outputDirectory, 'manifest.json'))).size;
  for (const name of Object.values(result.manifest.regions))
    artifactBytes += (await stat(join(outputDirectory, snapshotRegionDirectory(result.manifest.format), name))).size;
  if (mode === 'production') await writeFile(`${outputDirectory}.production-source.json`, JSON.stringify({
    projectId, revision: result.manifest.revision, format: result.manifest.format,
    included: result.stats.included, artifactBytes,
    documentsRead: stats.firestoreDocumentsReturned,
    preflight,
  }) + '\n');
  await writeFile(`${outputDirectory}.full-reconciliation.json`, JSON.stringify({
    at: new Date().toISOString(), revision: result.manifest.revision,
    documentsRead: stats.firestoreDocumentsReturned }) + '\n');
  return { ...stats, ...result.stats, preflight, artifactBytes,
    regions: Object.keys(result.manifest.regions).length, revision: result.manifest.revision, projectId, mode };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const value = flag => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
  const mode = value('--mode');
  const projectId = value('--project');
  const outputDirectory = value('--out');
  const approved = args.includes('--read-approved');
  const incremental = args.includes('--incremental');
  const expected = (mode === 'staging' || mode === 'production' ? 7 : 6) + (incremental ? 1 : 0);
  if (!mode || !projectId || !outputDirectory || args.length !== expected)
    throw new Error('Usage: node publish.mjs --mode emulator|staging|production --project PROJECT --out DIRECTORY [--read-approved] [--incremental]');
  const result = await publishFromFirestore({ mode, projectId, outputDirectory, approved, incremental });
  console.log(JSON.stringify(result));
}
