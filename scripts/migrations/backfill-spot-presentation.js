#!/usr/bin/env node
/**
 * Non-destructive spot presentation backfill.
 *
 * Default: dry-run. It never replaces `title`; high-confidence resolutions
 * are written to additive `resolved_title*` fields only with --apply.
 * Medium/low-confidence rows are always emitted for human review.
 *
 * Usage:
 *   node scripts/migrations/backfill-spot-presentation.js
 *   node scripts/migrations/backfill-spot-presentation.js --apply
 *   node scripts/migrations/backfill-spot-presentation.js --rollback=spot-presentation-rollback-....json
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { writeFile, readFile } from 'node:fs/promises';
import { resolveSpotTitle, isMeaningfulSpotTitle } from '../../src/lib/spotPresentation.js';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const rollbackArg = [...args].find(arg => arg.startsWith('--rollback='));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = `spot-presentation-review-${stamp}.json`;
const rollbackPath = `spot-presentation-rollback-${stamp}.json`;

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

async function rollback(path) {
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  let batch = db.batch(), count = 0;
  for (const row of manifest.rows || []) {
    const patch = Object.fromEntries(Object.entries(row.previous).map(([key, value]) => [key, value === '__MISSING__' ? FieldValue.delete() : value]));
    batch.update(db.collection('spots').doc(row.id), patch);
    if (++count % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  if (count % 400) await batch.commit();
  console.log(`Rolled back ${count} spot presentation updates from ${path}.`);
}

async function run() {
  if (rollbackArg) return rollback(rollbackArg.slice('--rollback='.length));
  const snapshot = await db.collection('spots').get();
  const review = [];
  const changes = [];
  for (const doc of snapshot.docs) {
    const spot = doc.data();
    if (isMeaningfulSpotTitle(spot.title) || isMeaningfulSpotTitle(spot.resolved_title)) continue;
    const resolution = resolveSpotTitle(spot);
    const row = { id: doc.id, currentTitle: spot.title || null, ...resolution, poiMatch: spot.poi_match || null };
    if (resolution.confidence !== 'high') { review.push(row); continue; }
    changes.push({ id: doc.id, resolution, previous: {
      resolved_title: Object.prototype.hasOwnProperty.call(spot, 'resolved_title') ? spot.resolved_title : '__MISSING__',
      resolved_title_source: Object.prototype.hasOwnProperty.call(spot, 'resolved_title_source') ? spot.resolved_title_source : '__MISSING__',
      resolved_title_confidence: Object.prototype.hasOwnProperty.call(spot, 'resolved_title_confidence') ? spot.resolved_title_confidence : '__MISSING__',
    } });
  }
  await writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), dryRun: !apply, highConfidence: changes.map(({ previous, ...row }) => row), review }, null, 2));
  console.log(`${snapshot.size} spots scanned; ${changes.length} high-confidence changes; ${review.length} require review.`);
  console.log(`Review report: ${reportPath}`);
  if (!apply) return console.log('Dry-run only. Re-run with --apply after reviewing the report.');

  await writeFile(rollbackPath, JSON.stringify({ generatedAt: new Date().toISOString(), rows: changes.map(({ id, previous }) => ({ id, previous })) }, null, 2));
  let batch = db.batch(), count = 0;
  for (const change of changes) {
    batch.update(db.collection('spots').doc(change.id), {
      resolved_title: change.resolution.title,
      resolved_title_source: change.resolution.source,
      resolved_title_confidence: change.resolution.confidence,
    });
    if (++count % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  if (count % 400) await batch.commit();
  console.log(`Applied ${count} additive updates. Rollback manifest: ${rollbackPath}`);
}

run().catch(error => { console.error(error); process.exitCode = 1; });
