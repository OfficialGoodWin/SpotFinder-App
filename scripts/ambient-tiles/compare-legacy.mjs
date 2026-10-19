#!/usr/bin/env node
// Compare a numeric-ID legacy export with a typed candidate from the same PBF.
// This validates a release candidate; it does not rewrite associations.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { dirname } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const i = arg.indexOf('='); return [arg.slice(2, i), arg.slice(i + 1)];
}));
if (!args.old || !args.candidate) throw new Error('Usage: node compare-legacy.mjs --old=old-ambient-poi.geojson --candidate=ambient-poi.geojson');
const [old, candidate] = await Promise.all([args.old, args.candidate].map(path => readFile(path, 'utf8').then(JSON.parse)));
if (old.type !== 'FeatureCollection' || candidate.type !== 'FeatureCollection') throw new Error('Expected GeoJSON FeatureCollections');
const count = features => features.reduce((result, feature) => {
  const key = `${feature.properties?.cat || 'unknown'} / ${feature.geometry?.type || 'unknown'}`;
  result[key] = (result[key] || 0) + 1;
  return result;
}, {});
const oldCounts = count(old.features);
const candidateCounts = count(candidate.features);
if (JSON.stringify(oldCounts) !== JSON.stringify(candidateCounts)) throw new Error(`Category/geometry distribution changed: ${JSON.stringify({ oldCounts, candidateCounts })}`);
if (old.features.length !== candidate.features.length) throw new Error(`Feature count changed: ${old.features.length} -> ${candidate.features.length}`);
const hash = geometry => createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
const canonical = new Set();
const legacyNumericIds = new Map();
const ambiguousLegacyIds = new Set();
const mappings = {};
const samples = {};
for (let i = 0; i < old.features.length; i++) {
  const before = old.features[i];
  const after = candidate.features[i];
  const legacyId = String(before.properties?.id ?? '');
  const props = after.properties || {};
  if (legacyId !== String(props.osm_id) || before.properties?.cat !== props.cat || hash(before.geometry) !== hash(after.geometry))
    throw new Error(`Legacy-to-candidate source mismatch at feature ${i}`);
  for (const [field, value] of Object.entries(before.properties || {})) {
    if (field !== 'id' && JSON.stringify(value) !== JSON.stringify(props[field]))
      throw new Error(`Legacy property ${field} changed at feature ${i}`);
  }
  if (!/^osm:(node|way|relation):[1-9]\d*$/.test(props.canonical_id) || props.canonical_id !== `osm:${props.osm_type}:${legacyId}`)
    throw new Error(`Invalid typed identity at feature ${i}`);
  if (canonical.has(props.canonical_id)) throw new Error(`Duplicate canonical identity: ${props.canonical_id}`);
  canonical.add(props.canonical_id);
  if (legacyNumericIds.has(legacyId) && legacyNumericIds.get(legacyId) !== props.canonical_id) ambiguousLegacyIds.add(legacyId);
  else legacyNumericIds.set(legacyId, props.canonical_id);
  mappings[legacyId] = { canonicalId: props.canonical_id, category: props.cat };
  if (!samples[props.osm_type]) samples[props.osm_type] = { legacyId, canonicalId: props.canonical_id, category: props.cat };
}
if (args.index) {
  if (!args.pbf || !args['old-pmtiles']) throw new Error('Index generation requires --pbf=original.osm.pbf and --old-pmtiles=old.pmtiles');
  if (ambiguousLegacyIds.size) throw new Error('Numeric ID collisions require manual review before generating an index');
  const sha256 = path => new Promise((resolve, reject) => {
    const digest = createHash('sha256');
    createReadStream(path).on('data', chunk => digest.update(chunk)).on('error', reject).on('end', () => resolve(digest.digest('hex')));
  });
  const [pbfSha256, legacyArchiveSha256, legacyGeojsonSha256, candidateGeojsonSha256] = await Promise.all([
    args.pbf, args['old-pmtiles'], args.old, args.candidate,
  ].map(sha256));
  const index = { metadata: { formatVersion: 1, featureCount: old.features.length, pbfSha256, legacyArchiveSha256,
    legacyGeojsonSha256, candidateGeojsonSha256, provenance: 'Exact original PBF export, legacy numeric GeoJSON and typed candidate comparison' }, mappings };
  await mkdir(dirname(args.index), { recursive: true });
  await writeFile(args.index, gzipSync(Buffer.from(JSON.stringify(index)), { level: 9 }));
}
console.log(JSON.stringify({ count: old.features.length, categoryGeometryCounts: candidateCounts, representativeIdentities: samples,
  ambiguousLegacyNumericIdCount: ambiguousLegacyIds.size, ambiguousLegacyNumericIdSamples: [...ambiguousLegacyIds].slice(0, 10),
  note: 'Exact source-ID and geometry comparison passed. Legacy coordinate/name associations still require separate human review.' }, null, 2));
