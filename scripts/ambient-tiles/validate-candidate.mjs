#!/usr/bin/env node
// Read-only validation of a local, unpublished ambient POI candidate.
import { readFile, open, stat } from 'node:fs/promises';
import { PMTiles } from 'pmtiles';
import { identityFromOsmiumAttributes } from './identity.js';
import { OSM_TAG_MAP } from './osm-tags.js';

const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
if (!args.raw || !args.geojson || !args.pmtiles) throw new Error('Usage: node validate-candidate.mjs --raw=ambient-export.geojson --geojson=ambient-poi.geojson --pmtiles=ambient-poi.candidate.pmtiles');
const [raw, normalized] = await Promise.all([readFile(args.raw, 'utf8').then(JSON.parse), readFile(args.geojson, 'utf8').then(JSON.parse)]);
if (raw.type !== 'FeatureCollection' || normalized.type !== 'FeatureCollection') throw new Error('Expected GeoJSON feature collections');
const wantedCategory = tags => {
  for (const [category, rule] of Object.entries(OSM_TAG_MAP)) {
    const value = tags?.[rule.key];
    if (rule.values ? rule.values.includes(value) : rule.value == null ? Boolean(value) : value === rule.value) return category;
  }
  return null;
};
const expected = (raw.features || []).filter(feature => {
  const category = wantedCategory(feature.properties);
  return category && ['Point', 'Polygon', 'MultiPolygon'].includes(feature.geometry?.type);
});
if (expected.length !== normalized.features?.length) throw new Error(`Feature count mismatch: source ${expected.length}, normalized ${normalized.features?.length || 0}`);
const categories = {};
const geometry = {};
const types = {};
const seen = new Set();
for (let i = 0; i < expected.length; i++) {
  const source = expected[i];
  const feature = normalized.features[i];
  const identity = identityFromOsmiumAttributes(source.properties);
  if (!identity || feature.properties?.canonical_id !== identity.canonicalId || feature.properties?.id !== identity.sourceId || feature.properties?.osm_type !== identity.type || feature.properties?.osm_id !== identity.id) throw new Error(`Identity mismatch at feature ${i}`);
  if (seen.has(identity.canonicalId)) throw new Error(`Duplicate canonical identity: ${identity.canonicalId}`);
  seen.add(identity.canonicalId);
  if (feature.properties.cat !== wantedCategory(source.properties)) throw new Error(`Category mismatch at feature ${i}`);
  if (JSON.stringify(feature.geometry) !== JSON.stringify(source.geometry)) throw new Error(`Geometry mismatch at feature ${i}`);
  categories[feature.properties.cat] = (categories[feature.properties.cat] || 0) + 1;
  geometry[feature.geometry.type] = (geometry[feature.geometry.type] || 0) + 1;
  if (!types[identity.type]) types[identity.type] = identity.canonicalId;
}
const path = args.pmtiles;
const handle = await open(path, 'r');
try {
  const archive = new PMTiles({
    getKey: () => path,
    getBytes: async (offset, length) => {
      const bytes = Buffer.alloc(length);
      const result = await handle.read(bytes, 0, length, offset);
      if (result.bytesRead !== length) throw new Error('Truncated PMTiles archive');
      return { data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    },
  });
  const [header, metadata, file] = await Promise.all([archive.getHeader(), archive.getMetadata(), stat(path)]);
  if (!metadata.vector_layers?.some(layer => layer.id === 'ambient_poi')) throw new Error('Missing ambient_poi source layer');
  if (header.minZoom !== 10 || header.maxZoom !== 16 || header.tileType !== 1 || file.size < 100) throw new Error('Unexpected PMTiles archive header');
  console.log(JSON.stringify({ features: expected.length, categories, geometry, representativeIdentities: types,
    pmtiles: { path, bytes: file.size, minZoom: header.minZoom, maxZoom: header.maxZoom, layer: 'ambient_poi' } }, null, 2));
} finally { await handle.close(); }
