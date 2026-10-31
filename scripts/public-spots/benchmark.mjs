import { performance } from 'node:perf_hooks';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import { buildPublicSpotSnapshot } from './export.mjs';
import { createPublicSpotSnapshotReader, readSnapshotSpots } from '../../src/new/publicSpotSnapshotClient.js';
import { SNAPSHOT_FORMAT, snapshotRegionDirectory, spotInsideBounds } from '../../src/new/publicSpotSnapshotFormat.js';

const formatIndex = process.argv.indexOf('--format');
const format = formatIndex >= 0 ? Number(process.argv[formatIndex + 1]) : SNAPSHOT_FORMAT;
if (![2, 3].includes(format)) throw new Error('Format must be 2 or 3');
const regionDirectory = snapshotRegionDirectory(format);

const views = [
  { south: 49.5, west: 13.5, north: 50.5, east: 14.5 },
  { south: 49.7, west: 13.7, north: 50.7, east: 14.7 },
  { south: 49.9, west: 13.9, north: 50.2, east: 14.2 },
];
const bytes = value => Buffer.byteLength(JSON.stringify(value));
const cities = [[50.08, 14.42], [52.52, 13.4], [48.21, 16.37], [48.86, 2.35], [51.51, -0.13],
  [41.9, 12.5], [40.42, -3.7], [52.23, 21.01], [47.5, 19.04], [50.85, 4.35]];

function syntheticSpots(count) {
  return Array.from({ length: count }, (_, index) => {
    const city = cities[Math.floor(index / 5) % cities.length];
    const urban = index % 5 === 0;
    return {
      id: `synthetic-${index}`, is_public: true, status: 'published', flag_count: 0,
      lat: urban ? city[0] + ((index * 37) % 1000) / 10000 : 35 + ((index * 15427) % 30000) / 1000,
      lng: urban ? city[1] + ((index * 71) % 1000) / 10000 : -11 + ((index * 27913) % 47000) / 1000,
      title: `Synthetic spot ${index}`, category: 'nature', tags: ['synthetic'],
      created_date: '2026-10-30', description: 'Synthetic detail text '.repeat(30),
    };
  });
}

for (const count of [100, 1000, 10000, 250000]) {
  const records = syntheticSpots(count);
  const buildStarted = performance.now();
  let snapshot = buildPublicSpotSnapshot(records, { format });
  const buildMs = performance.now() - buildStarted;
  const files = new Map(snapshot.files);
  const calls = [];
  let time = 10000;
  const fetchJson = async url => {
    const data = url.endsWith('/spot-snapshot-revocations') ? { format: 1, revoked: [] }
      : url.endsWith('manifest.json') ? snapshot.manifest : files.get(url.split('/').at(-1));
    const payload = data ? Buffer.from(JSON.stringify(data)) : null;
    calls.push({ url, bytes: payload?.byteLength || 0,
      gzipBytes: payload ? gzipSync(payload).byteLength : 0,
      brotliBytes: payload ? brotliCompressSync(payload,
        { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } }).byteLength : 0 });
    return { ok: Boolean(data), status: data ? 200 : 404, json: async () => data };
  };
  const read = createPublicSpotSnapshotReader({ fetchJson, now: () => time });
  const baselinePages = views.map(bounds => records.filter(spot => spotInsideBounds(spot, bounds)).slice(0, 300));
  const measure = async bounds => {
    const started = performance.now();
    const rows = await readSnapshotSpots(bounds, 300, read);
    return { rows, ms: +(performance.now() - started).toFixed(3) };
  };
  const cold = await measure(views[0]);
  const warm = await measure(views[0]);
  const pan = await measure(views[1]);
  const zoom = await measure(views[2]);
  const returnView = await measure(views[0]);
  const journeyCalls = [...calls];
  const detail = cold.rows.slice(0, 5).map(spot => records.find(record => record.id === spot.id));
  snapshot = buildPublicSpotSnapshot([{ ...records[0], title: 'Edited synthetic spot' }, ...records.slice(1)],
    { format, publishedAt: new Date(Date.parse(snapshot.manifest.publishedAt) + 1).toISOString() });
  for (const [name, data] of snapshot.files) files.set(name, data);
  time += 5001;
  const beforeEdit = calls.length;
  await measure(views[0]);
  const changedRegionFetches = calls.slice(beforeEdit).filter(call => call.url.includes(`/${regionDirectory}/`)).length;
  const allRegionBuffers = [...snapshot.files.values()].map(file => Buffer.from(JSON.stringify(file)));
  const regionBytes = allRegionBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const gzipBytes = allRegionBuffers.reduce((sum, buffer) => sum + gzipSync(buffer).byteLength, 0);
  const brotliBytes = allRegionBuffers.reduce((sum, buffer) => sum + brotliCompressSync(buffer,
    { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } }).byteLength, 0);
  const publicRows = [...snapshot.files.values()].flatMap(file => file.spots);
  const unroundedBytes = bytes(publicRows.map(spot => {
    const source = records[Number(spot.id.slice('synthetic-'.length))];
    return { ...spot, lat: source.lat, lng: source.lng };
  }));
  console.log(JSON.stringify({ spots: count, format, publicRegions: snapshot.files.size, mapMarkers: cold.rows.length,
    modeledFirestoreViewportQueries: baselinePages.length,
    modeledFirestoreReturnedDocs: baselinePages.reduce((sum, page) => sum + page.length, 0),
    modeledFirestoreSerializedBytes: baselinePages.reduce((sum, page) => sum + bytes(page), 0),
    modeledExporterFirestoreDocumentsReturned: count,
    snapshotMapFirestoreQueries: 0,
    cdnHttpRequests: journeyCalls.length,
    cdnManifestRequests: journeyCalls.filter(call => call.url.endsWith('manifest.json')).length,
    cdnRegionRequests: journeyCalls.filter(call => call.url.includes(`/${regionDirectory}/`)).length,
    cdnJsonBytes: journeyCalls.reduce((sum, call) => sum + call.bytes, 0),
    cdnGzipBytes: journeyCalls.reduce((sum, call) => sum + call.gzipBytes, 0),
    cdnBrotliBytes: journeyCalls.reduce((sum, call) => sum + call.brotliBytes, 0),
    changedRegionFetches, artifactRegionJsonBytes: regionBytes, artifactGzipBytes: gzipBytes,
    artifactBrotliBytes: brotliBytes, coordinatePrecisionSavedBytes: unroundedBytes - bytes(publicRows),
    detailPointReads: detail.length, detailJsonBytes: bytes(detail),
    localBuildMs: +buildMs.toFixed(1), localColdMs: cold.ms, localWarmMs: warm.ms,
    localPanMs: pan.ms, localZoomMs: zoom.ms, localReturnMs: returnView.ms,
    rssMiB: +(process.memoryUsage().rss / 1048576).toFixed(1),
    note: 'Synthetic in-memory data and fetches; no browser, CDN or billable Firestore telemetry' }));
}
