#!/usr/bin/env node
// Local ambient-POI normalizer: osmium export -> filtered GeoJSON.
// This script deliberately does NOT call Overpass or Mapy/Firmy.cz.
// Usage:
//   node build.js --in=ambient-filtered.geojson --out=ambient-poi.geojson

import { readFile, writeFile } from 'node:fs/promises';
import { OSM_TAG_MAP, KEPT_TAGS } from './osm-tags.js';
import { AMBIENT_CATEGORIES } from '../../src/lib/ambientCategories.js';

// category -> minZoom, so tippecanoe only puts a feature in tiles from that zoom
// up. Keeps low-zoom tiles small and stops --drop-densest-as-needed from
// discarding important POIs in favour of parking lots.
const MIN_ZOOM = Object.fromEntries(AMBIENT_CATEGORIES.map(c => [c.key, c.minZoom]));

const PRIVATE_ACCESS = new Set(['private', 'customers', 'permit', 'no', 'delivery']);
const STREET_PARKING = new Set(['street_side', 'lane', 'on_kerb', 'half_on_kerb', 'shoulder']);

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

  for (const feat of raw.features || []) {
    const tags = feat.properties || {};
    const cat = categoryForTags(tags);
    if (!cat) continue;
    // Private / customer-only / kerbside parking is noise on a public map.
    if (cat === 'parking' && (PRIVATE_ACCESS.has(tags.access) || STREET_PARKING.has(tags.parking))) continue;
    if (!['Point', 'Polygon', 'MultiPolygon'].includes(feat.geometry?.type)) continue;

    const props = { cat, id: tags['@id'] || tags.id || `${feat.id ?? ''}` };
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
    const feature = { type: 'Feature', geometry: feat.geometry, properties: props };
    if (MIN_ZOOM[cat] != null) feature.tippecanoe = { minzoom: Math.max(10, MIN_ZOOM[cat]) };
    features.push(feature);
  }

  await writeFile(out, JSON.stringify({ type: 'FeatureCollection', features }));
  console.log(`Wrote ${out}: ${features.length} POIs.`);
}

main().catch(err => { console.error(err); process.exit(1); });
