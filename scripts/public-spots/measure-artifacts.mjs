import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { writePublicSpotSnapshot } from './export.mjs';
import { SNAPSHOT_FORMAT, snapshotRegionDirectory } from '../../src/new/publicSpotSnapshotFormat.js';

const count = Number(process.argv[2] || 250000);
if (!Number.isInteger(count) || count < 1 || count > 250000) throw new Error('Count must be 1..250000');
const formatIndex = process.argv.indexOf('--format');
const format = formatIndex >= 0 ? Number(process.argv[formatIndex + 1]) : SNAPSHOT_FORMAT;
if (![2, 3].includes(format)) throw new Error('Format must be 2 or 3');
const root = await mkdtemp(join(tmpdir(), 'spotfinder-size-'));
const output = join(root, 'spot-snapshots');
const cities = [[50.08, 14.42], [52.52, 13.4], [48.21, 16.37], [48.86, 2.35], [51.51, -0.13],
  [41.9, 12.5], [40.42, -3.7], [52.23, 21.01], [47.5, 19.04], [50.85, 4.35]];
const records = Array.from({ length: count }, (_, index) => {
  const city = cities[Math.floor(index / 5) % cities.length];
  const urban = index % 5 === 0;
  return { id: `synthetic-${index}`, is_public: true, status: 'published', flag_count: 0,
    lat: urban ? city[0] + ((index * 37) % 1000) / 10000 : 35 + ((index * 15427) % 30000) / 1000,
    lng: urban ? city[1] + ((index * 71) % 1000) / 10000 : -11 + ((index * 27913) % 47000) / 1000,
    title: `Synthetic spot ${index}`, category: 'nature', tags: ['synthetic'], created_date: '2026-10-30' };
});
try {
  const started = performance.now();
  const result = await writePublicSpotSnapshot(records, output, { format });
  const exportMs = Math.round(performance.now() - started);
  const directory = snapshotRegionDirectory(format);
  const names = await readdir(join(output, directory));
  let raw = 0, gzip = 0, brotli = 0, largest = 0;
  for (const name of names) {
    const bytes = await readFile(join(output, directory, name));
    raw += bytes.length;
    gzip += gzipSync(bytes).length;
    brotli += brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }).length;
    largest = Math.max(largest, bytes.length);
  }
  const manifestBytes = (await stat(join(output, 'manifest.json'))).size;
  let build = null;
  if (process.argv.includes('--build')) {
    const buildDirectory = join(root, 'dist');
    const fakeStage = 'demo-spotfinder-staging';
    const env = { ...process.env, VERCEL_ENV: 'preview', FIREBASE_PROJECT_ID: fakeStage,
      SPOTFINDER_SNAPSHOT_PREVIEW_APPROVED: 'true', VITE_SPOTFINDER_STAGE: 'staging', VITE_PUBLIC_SPOT_SNAPSHOTS: 'true',
      VITE_ORIGINAL_MAP_SNAPSHOTS: 'true',
      SPOTFINDER_SNAPSHOT_CANDIDATE_DIRECTORY: output,
      VITE_FIREBASE_STAGING_API_KEY: 'synthetic', VITE_FIREBASE_STAGING_AUTH_DOMAIN: `${fakeStage}.invalid`,
      VITE_FIREBASE_STAGING_PROJECT_ID: fakeStage, VITE_FIREBASE_STAGING_APP_ID: 'synthetic',
      VITE_FIREBASE_STAGING_MESSAGING_SENDER_ID: 'synthetic',
      VITE_FIREBASE_STAGING_STORAGE_BUCKET: `${fakeStage}.invalid`, VITE_FIREBASE_APP_CHECK_SITE_KEY: 'synthetic' };
    const built = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'snapshot-staging',
      '--outDir', buildDirectory], { env, stdio: 'inherit' });
    if (built.status !== 0) throw new Error(`Synthetic staging build failed: ${built.status}`);
    let fileCount = 0, totalBytes = 0, largestBytes = 0;
    const visit = async directory => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await visit(path);
        else { const bytes = (await stat(path)).size; fileCount += 1; totalBytes += bytes; largestBytes = Math.max(largestBytes, bytes); }
      }
    };
    await visit(buildDirectory);
    build = { fileCount, totalBytes, largestBytes };
  }
  const edited = records.slice();
  edited[0] = { ...edited[0], title: 'Edited synthetic spot' };
  const changedStarted = performance.now();
  const changed = await writePublicSpotSnapshot(edited, output, { format });
  const changedNames = Object.values(changed.manifest.regions).filter(name =>
    !Object.values(result.manifest.regions).includes(name));
  let changedRegionBytes = 0;
  for (const name of changedNames) changedRegionBytes += (await stat(join(output, directory, name))).size;
  console.log(JSON.stringify({ syntheticSpots: count, format, regions: names.length, files: names.length + 1,
    regionRawBytes: raw, regionGzipBytes: gzip, regionBrotliBytes: brotli,
    manifestBytes, totalRawBytes: raw + manifestBytes, largestRegionBytes: largest,
    exportMs, rssAfterMeasurementBytes: process.memoryUsage().rss,
    maxRssReportedKiB: process.resourceUsage().maxRSS, revision: result.manifest.revision,
    syntheticStagingBuild: build,
    singleEditLocalArtifactDelta: { changedRegions: changedNames.length, changedRegionBytes,
      candidateBuildMs: Math.round(performance.now() - changedStarted) } }));
} finally {
  if (!resolve(root).startsWith(resolve(tmpdir(), 'spotfinder-size-'))) throw new Error('Unsafe cleanup target');
  await rm(root, { recursive: true, force: true });
}
