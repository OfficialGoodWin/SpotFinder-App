#!/usr/bin/env node
// Local ambient-POI normalizer: osmium export -> filtered GeoJSON.
// This script deliberately does NOT call Overpass or Mapy/Firmy.cz.
// Usage:
//   node build.js --in=ambient-filtered.geojson --out=ambient-poi.geojson

import { readFile, writeFile } from 'node:fs/promises';
import { OSM_TAG_MAP, KEPT_TAGS } from './osm-tags.js';
import { identityFromOsmiumAttributes } from './identity.js';

function parseArgs() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const i = a.indexOf('=');
    return i === -1 ? [a.replace(/^--/, ''), true] : [a.slice(2, i), a.slice(i + 1)];
  }));
  if (!args.in) {
    console.error('Usage: node build.js --in=ambient-filtered.geojson --out=ambient-poi.geojson');
    process.exit(1);
  }
  return { input: args.in, out: args.out || 'ambient-poi.geojson' };
}

function categoryForTags(tags) {
  for (const [cat, rule] of Object.entries(OSM_TAG_MAP)) {
    const v = tags?.[rule.key];
    if (rule.values) { if (rule.values.includes(v)) return cat; continue; }
    if (rule.value == null ? v : v === rule.value) return cat;
  }
  return null;
}

function propValue(tags, key) {
  if (tags?.[key]) return tags[key];
  if (key === 'phone' && tags?.['contact:phone']) return tags['contact:phone'];
  if (key === 'website' && tags?.['contact:website']) return tags['contact:website'];
  return undefined;
}

function normalizeAddress(tags) {
  if (tags?.['addr:full']) return tags['addr:full'];
  return [tags?.['addr:street'], tags?.['addr:housenumber']].filter(Boolean).join(' ') || undefined;
}

async function main() {
  const { input, out } = parseArgs();
  const raw = JSON.parse(await readFile(input, 'utf8'));
  const features = [];

  for (const [index, feat] of (raw.features || []).entries()) {
    const tags = feat.properties || {};
    const cat = categoryForTags(tags);
    if (!cat) continue;
    if (!['Point', 'Polygon', 'MultiPolygon'].includes(feat.geometry?.type)) continue;

    const identity = identityFromOsmiumAttributes(tags);
    if (!identity) throw new Error(`Missing verified @type/@id on included feature ${index}; rebuild the osmium export with export-config.json`);
    const props = { cat, id: identity.sourceId, canonical_id: identity.canonicalId,
      osm_type: identity.type, osm_id: identity.id, source_id: identity.sourceId };
    for (const tag of KEPT_TAGS) {
      const v = propValue(tags, tag);
      if (v != null && v !== '') {
        const key = tag.replace(/^addr:/, 'addr_').replace(/^contact:/, '');
        props[key] = String(v);
      }
    }
    const address = normalizeAddress(tags);
    if (address) props.address = address;
    if (!props.name && tags['name:en']) props.name = tags['name:en'];
    for (const [key, value] of Object.entries(tags)) {
      if (/^(name|description):[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(key) && typeof value === 'string' && value.length <= 4000) props[key] = value;
    }
    features.push({ type: 'Feature', geometry: feat.geometry, properties: props });
  }

  await writeFile(out, JSON.stringify({ type: 'FeatureCollection', features }));
  console.log(`Wrote ${out}: ${features.length} POIs.`);
}

main().catch(err => { console.error(err); process.exit(1); });
