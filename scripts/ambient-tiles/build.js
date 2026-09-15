#!/usr/bin/env node
// Ambient POI tile pipeline — step 1: Overpass extract -> filtered GeoJSON.
// Step 2 (GeoJSON -> PMTiles) is the tippecanoe call in build.sh.
//
// Usage:
//   npm install               (once, inside this folder)
//   node build.js --bbox=48.5,12.0,51.1,18.9 --out=ambient-poi.geojson
//
// Run this on a schedule (see ../../.github/workflows/build-ambient-tiles.yml)
// — ambient POIs (cafes, museums, viewpoints...) don't change hourly, so
// weekly/monthly is plenty. This does NOT touch user-submitted Spots, which
// must stay live Firestore reads (see the note in MapLibreMap.jsx).
//
// Requires Node 18+ (for global fetch). Network access required — this
// script is meant to run in CI or on a machine with internet access, not in
// a sandboxed build environment.

import osmtogeojson from 'osmtogeojson';
import { writeFile } from 'node:fs/promises';
import { OSM_TAG_MAP, KEPT_TAGS } from './osm-tags.js';

const OVERPASS_ENDPOINT = process.env.OVERPASS_ENDPOINT || 'https://overpass-api.de/api/interpreter';

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    })
  );
  if (!args.bbox) {
    console.error('Usage: node build.js --bbox=south,west,north,east [--out=ambient-poi.geojson] [--skip-credits]');
    process.exit(1);
  }
  const [south, west, north, east] = args.bbox.split(',').map(Number);
  return {
    bbox: { south, west, north, east },
    out: args.out || 'ambient-poi.geojson',
    skipCredits: !!args['skip-credits'],
  };
}

// Builds one Overpass QL query covering every category in OSM_TAG_MAP,
// as nodes + way-centers (`out center`) within the given bbox.
function buildOverpassQuery(bbox) {
  const { south, west, north, east } = bbox;
  const bboxStr = `${south},${west},${north},${east}`;
  const clauses = Object.values(OSM_TAG_MAP).map(({ key, value }) => {
    const sel = value ? `["${key}"="${value}"]` : `["${key}"]`;
    return `  node${sel}(${bboxStr});\n  way${sel}(${bboxStr});`;
  }).join('\n');
  return `[out:json][timeout:180];\n(\n${clauses}\n);\nout center tags;`;
}

function categoryForTags(tags) {
  for (const [cat, { key, value }] of Object.entries(OSM_TAG_MAP)) {
    if (value ? tags[key] === value : tags[key]) return cat;
  }
  return null;
}

// Best-effort Wikimedia credit lookup, run at build time so the client never
// has to make this call per-POI. Mirrors the logic in POIDetailPanel.jsx.
async function fetchCommonsCredit(fileTitle) {
  try {
    const r = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(`File:${fileTitle}`)}` +
      `&prop=imageinfo&iiprop=extmetadata&format=json&origin=*`
    );
    if (!r.ok) return null;
    const pages = (await r.json())?.query?.pages || {};
    const page = Object.values(pages)[0];
    const meta = page?.imageinfo?.[0]?.extmetadata;
    if (!meta) return null;
    const strip = (html) => (html || '').replace(/<[^>]*>/g, '').trim();
    const author = strip(meta.Artist?.value);
    const license = strip(meta.LicenseShortName?.value);
    if (!author && !license) return null;
    return `Photo: ${author || 'Unknown author'}${license ? ` (${license})` : ''}, via Wikimedia Commons`;
  } catch { return null; }
}

async function main() {
  const { bbox, out, skipCredits } = parseArgs();
  console.log(`Querying Overpass for bbox ${JSON.stringify(bbox)}...`);

  const query = buildOverpassQuery(bbox);
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`);
  const osmData = await res.json();
  console.log(`Overpass returned ${osmData.elements?.length ?? 0} elements.`);

  const geojson = osmtogeojson(osmData);

  const features = [];
  for (const feat of geojson.features) {
    const tags = feat.properties || {};
    const cat = categoryForTags(tags);
    if (!cat) continue;

    // way centers come through as Point geometry already (from `out center`);
    // skip anything else defensively (relations, unresolved geometry).
    if (feat.geometry?.type !== 'Point') continue;

    const props = { cat, id: feat.id };
    for (const t of KEPT_TAGS) if (tags[t]) props[t.replace('contact:', '').replace('addr:', 'addr_')] = tags[t];
    if (tags.phone || tags['contact:phone']) props.phone = tags.phone || tags['contact:phone'];
    if (tags.website || tags['contact:website']) props.website = tags.website || tags['contact:website'];
    const addrParts = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean);
    if (addrParts.length) props.address = addrParts.join(' ');

    features.push({ type: 'Feature', geometry: feat.geometry, properties: props });
  }
  console.log(`Kept ${features.length} features after category filtering.`);

  if (!skipCredits) {
    const withPhoto = features.filter(f => f.properties.wikimedia_commons || f.properties.wikidata);
    console.log(`Pre-fetching Wikimedia credit for ${withPhoto.length} features (this can take a while)...`);
    let done = 0;
    for (const f of withPhoto) {
      const file = f.properties.wikimedia_commons?.replace('File:', '');
      if (file) {
        f.properties.credit = await fetchCommonsCredit(file);
      }
      // Politeness delay — avoid hammering Commons' API across thousands of features.
      await new Promise(r => setTimeout(r, 150));
      if (++done % 100 === 0) console.log(`  ...${done}/${withPhoto.length}`);
    }
  } else {
    console.log('Skipping Wikimedia credit pre-fetch (--skip-credits).');
  }

  const output = { type: 'FeatureCollection', features };
  await writeFile(out, JSON.stringify(output));
  console.log(`Wrote ${out} (${features.length} features). Next: run build.sh to produce the PMTiles file.`);
}

main().catch(e => { console.error(e); process.exit(1); });
