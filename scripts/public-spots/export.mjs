import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGION_DEGREES, SNAPSHOT_FORMAT, regionForPoint, toPublicSnapshotSpot } from '../../src/new/publicSpotSnapshotFormat.js';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20);

// Offline exporter input must come from a future trusted, complete Admin SDK export.
// This prototype never connects to Firebase or publishes files.
export function buildPublicSpotSnapshot(records) {
  if (!Array.isArray(records)) throw new TypeError('Expected a complete array of spot records');
  const regions = new Map();
  const seenIds = new Set();
  for (const record of records) {
    const spot = toPublicSnapshotSpot(record);
    if (!spot) continue;
    if (seenIds.has(spot.id)) throw new Error(`Duplicate spot ID: ${spot.id}`);
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
    const filename = `${key}-${hash(data)}.json`;
    entries[key] = filename;
    files.set(filename, data);
  }
  const version = hash(entries);
  return { manifest: { format: SNAPSHOT_FORMAT, regionDegrees: REGION_DEGREES, version, regions: entries }, files };
}

export async function writePublicSpotSnapshot(records, outputDirectory) {
  const snapshot = buildPublicSpotSnapshot(records);
  const versionDirectory = join(outputDirectory, 'v1');
  await mkdir(versionDirectory, { recursive: true });
  for (const [name, data] of snapshot.files) {
    try { await access(join(versionDirectory, name)); }
    catch { await writeFile(join(versionDirectory, name), `${JSON.stringify(data)}\n`); }
  }
  // Publish manifest last; immutable region files must be available first.
  const nextManifest = join(outputDirectory, 'manifest.next.json');
  await writeFile(nextManifest, `${JSON.stringify(snapshot.manifest)}\n`);
  await rename(nextManifest, join(outputDirectory, 'manifest.json'));
  return snapshot.manifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: node export.mjs complete-local-spots.json output-directory');
  const records = JSON.parse(await readFile(input, 'utf8'));
  await writePublicSpotSnapshot(records, output);
}
