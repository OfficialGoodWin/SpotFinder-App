import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rmdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGION_DEGREES, SNAPSHOT_FORMAT, regionForPoint, toPublicSnapshotSpot, validSnapshotSpot } from '../../src/new/publicSpotSnapshotFormat.js';

export const hashSnapshotValue = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20);
const FILE = /^r\d+-\d+-[a-f0-9]{20}\.json$/;
async function renameWithBoundedRetry(from, to) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await rename(from, to); }
    catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

export function buildPublicSpotSnapshot(records, { excludedIds = new Set(), publishedAt = new Date().toISOString() } = {}) {
  if (!Array.isArray(records) || !(excludedIds instanceof Set)) throw new TypeError('Expected complete spot records and an exclusion set');
  if (Number.isNaN(Date.parse(publishedAt))) throw new TypeError('Invalid publication time');
  const regions = new Map();
  const seenIds = new Set();
  let skipped = 0;
  for (const record of records) {
    if (!record || excludedIds.has(record.id)) { skipped += 1; continue; }
    let spot;
    try { spot = toPublicSnapshotSpot(record); }
    catch { skipped += 1; continue; }
    if (!spot || !validSnapshotSpot(spot)) { skipped += 1; continue; }
    if (seenIds.has(spot.id)) throw new Error(`Duplicate visible spot ID: ${spot.id}`);
    seenIds.add(spot.id);
    const key = regionForPoint(spot.lat, spot.lng);
    if (!regions.has(key)) regions.set(key, []);
    regions.get(key).push(spot);
  }
  const files = new Map();
  const entries = {};
  for (const key of [...regions.keys()].sort()) {
    const spots = regions.get(key).sort((a, b) => a.id.localeCompare(b.id));
    const data = { format: SNAPSHOT_FORMAT, region: key, spots };
    const filename = `${key}-${hashSnapshotValue(data)}.json`;
    entries[key] = filename;
    files.set(filename, data);
  }
  const revision = hashSnapshotValue(entries);
  return { manifest: { format: SNAPSHOT_FORMAT, regionDegrees: REGION_DEGREES, revision,
    version: revision, publishedAt, regions: entries }, files, stats: { included: seenIds.size, skipped } };
}

// Incremental input is already the validated public allowlist from a previous
// candidate plus freshly projected authoritative records. Preserve unchanged
// summaries byte for byte instead of reconstructing them from a partial row.
export function buildPublicSpotSnapshotFromSummaries(summaries, publishedAt = new Date().toISOString()) {
  if (!Array.isArray(summaries) || Number.isNaN(Date.parse(publishedAt))) throw new TypeError('Invalid public summaries');
  const byRegion = new Map();
  const ids = new Set();
  for (const spot of summaries) {
    if (!validSnapshotSpot(spot) || ids.has(spot.id)) throw new Error('Invalid or duplicate public summary');
    ids.add(spot.id);
    const region = regionForPoint(spot.lat, spot.lng);
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region).push(spot);
  }
  const files = new Map();
  const entries = {};
  for (const region of [...byRegion.keys()].sort()) {
    const data = { format: SNAPSHOT_FORMAT, region, spots: byRegion.get(region).sort((a, b) => a.id.localeCompare(b.id)) };
    const filename = `${region}-${hashSnapshotValue(data)}.json`;
    files.set(filename, data);
    entries[region] = filename;
  }
  const revision = hashSnapshotValue(entries);
  return { manifest: { format: SNAPSHOT_FORMAT, regionDegrees: REGION_DEGREES,
    revision, version: revision, publishedAt, regions: entries }, files,
    stats: { included: ids.size, skipped: 0 } };
}

export function validateSnapshotArtifacts({ manifest, files }) {
  if (!manifest || manifest.format !== SNAPSHOT_FORMAT || manifest.regionDegrees !== REGION_DEGREES
    || !/^[a-f0-9]{20}$/.test(manifest.revision) || manifest.version !== manifest.revision
    || !manifest.regions || Array.isArray(manifest.regions) || typeof manifest.regions !== 'object'
    || manifest.revision !== hashSnapshotValue(manifest.regions)
    || typeof manifest.publishedAt !== 'string' || Number.isNaN(Date.parse(manifest.publishedAt)))
    throw new Error('Invalid snapshot manifest');
  if (!(files instanceof Map) || files.size !== Object.keys(manifest.regions).length) throw new Error('Incomplete region set');
  const ids = new Set();
  for (const [region, filename] of Object.entries(manifest.regions)) {
    if (!FILE.test(filename) || !filename.startsWith(`${region}-`)) throw new Error('Invalid region reference');
    const file = files.get(filename);
    if (!file || file.format !== SNAPSHOT_FORMAT || file.region !== region
      || filename !== `${region}-${hashSnapshotValue(file)}.json` || !Array.isArray(file.spots)
      || file.spots.length > 10000 || JSON.stringify(file).length > 5000000) throw new Error('Corrupt or oversized region file');
    for (const spot of file.spots) {
      if (!validSnapshotSpot(spot) || regionForPoint(spot.lat, spot.lng) !== region || ids.has(spot.id))
        throw new Error('Invalid or duplicate marker');
      ids.add(spot.id);
    }
  }
  return true;
}

export async function writePublicSpotSnapshot(records, outputDirectory, options = {}) {
  const target = resolve(outputDirectory);
  await mkdir(dirname(target), { recursive: true });
  const lock = `${target}.publish-lock`;
  await mkdir(lock); // Atomic local single-writer lock. A stale lock requires operator inspection.
  try {
    const previous = await readFile(join(target, 'manifest.json'), 'utf8').then(JSON.parse).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    const built = options.alreadyPublic
      ? buildPublicSpotSnapshotFromSummaries(records, options.publishedAt)
      : buildPublicSpotSnapshot(records, options);
    if (previous?.revision === built.manifest.revision) built.manifest.publishedAt = previous.publishedAt;
    else if (previous?.publishedAt) built.manifest.publishedAt = new Date(Math.max(
      Date.now(), Date.parse(previous.publishedAt) + 1)).toISOString();
    validateSnapshotArtifacts(built);
    const staged = await mkdtemp(`${target}.candidate-`);
    const regionDirectory = join(staged, 'v2');
    await mkdir(regionDirectory);
    const oldRegionDirectory = join(target, 'v2');
    const oldFiles = await readdir(oldRegionDirectory).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    // Carry forward only files referenced by the new manifest. Old revisions
    // must not remain addressable on the current static deployment.
    for (const name of Object.values(built.manifest.regions)) {
      if (oldFiles.includes(name)) await copyFile(join(oldRegionDirectory, name), join(regionDirectory, name));
    }
    let changedRegions = 0;
    for (const [name, data] of built.files) {
      if (!oldFiles.includes(name)) {
        await writeFile(join(regionDirectory, name), `${JSON.stringify(data)}\n`, { flag: 'wx' });
        changedRegions += 1;
      }
    }
    // Read back every referenced region before the manifest can become visible.
    const readBack = new Map();
    for (const name of Object.values(built.manifest.regions)) readBack.set(name, JSON.parse(await readFile(join(regionDirectory, name), 'utf8')));
    validateSnapshotArtifacts({ manifest: built.manifest, files: readBack });
    await writeFile(join(staged, 'manifest.json'), `${JSON.stringify(built.manifest)}\n`, { flag: 'wx' });
    const backup = `${target}.previous-${Date.now()}`;
    let hadPrevious = false;
    try { await renameWithBoundedRetry(target, backup); hadPrevious = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { await renameWithBoundedRetry(staged, target); }
    catch (error) { if (hadPrevious) await renameWithBoundedRetry(backup, target); throw error; }
    return { manifest: built.manifest, stats: { ...built.stats, changedRegions, backup: hadPrevious ? backup : null } };
  } finally {
    // Failed candidates are left on disk for inspection; never auto-delete them.
    await rmdir(lock);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || process.argv.length !== 4) throw new Error('Usage: node export.mjs synthetic-spots.json output-directory');
  const records = JSON.parse(await readFile(input, 'utf8'));
  const result = await writePublicSpotSnapshot(records, output);
  console.log(JSON.stringify({ revision: result.manifest.revision, ...result.stats, output: basename(resolve(output)) }));
}
