#!/usr/bin/env node
// Read a GeoJSON sequence exported from the ORIGINAL OSM PBF. This never
// rewrites PMTiles or infers an OSM type from a numeric vector feature ID.
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import foundation from '../../functions/officialPoiFoundation.js';
import { identityFromOsmiumAttributes } from './identity.js';

const input = process.argv.find(arg => arg.startsWith('--input='))?.slice(8);
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
if (!input) throw new Error('Usage: node audit-identities.mjs --input=original-osm.geojsonseq [--output=identity-index.ndjson]');
const seen = new Set();
const counts = { total: 0, typed: 0, missing: 0, duplicate: 0 };
const writer = output ? createWriteStream(output, { flags: 'wx' }) : null;
try {
  for await (const line of createInterface({ input: createReadStream(input, 'utf8'), crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const feature = JSON.parse(line.replace(/^\x1e/, ''));
    counts.total++;
    const verified = identityFromOsmiumAttributes(feature.properties);
    const source = verified?.sourceId || feature.properties?.source_id || feature.properties?.id;
    const canonical = verified?.canonicalId || foundation.canonicalFromOsmium(source);
    if (!canonical) { counts.missing++; continue; }
    if (seen.has(canonical)) { counts.duplicate++; continue; }
    seen.add(canonical); counts.typed++;
    if (writer) writer.write(JSON.stringify({ canonicalId: canonical, sourceId: source }) + '\n');
  }
} finally {
  if (writer) await new Promise(resolve => writer.end(resolve));
}
console.log(JSON.stringify(counts, null, 2));
if (counts.missing || counts.duplicate) process.exitCode = 1;
