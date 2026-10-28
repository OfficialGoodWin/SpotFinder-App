#!/usr/bin/env node
// Convert a small Overpass `out geom` response to four independent GeoJSON layers.
// This is a sample inspector, not a country-scale builder or tile generator.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node extract-sample.mjs input.json output-directory');
const data = JSON.parse(await readFile(input, 'utf8'));
const layers = Object.fromEntries(['hiking', 'cycling', 'pistes', 'lifts'].map(key => [key, []]));
const seen = new Set();
const missingGeometry = [];
const ways = new Map((data.elements || []).filter(item => item.type === 'way').map(item => [item.id, item]));

function add(layer, coords, identity, tags, relation = null) {
  if (!Array.isArray(coords) || coords.length < 2 || coords.some(p => !Number.isFinite(p.lon) || !Number.isFinite(p.lat))) {
    missingGeometry.push(identity); return;
  }
  const key = `${layer}:${identity}`;
  if (seen.has(key)) return;
  seen.add(key);
  const effective = { ...(relation?.tags || {}), ...tags };
  layers[layer].push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords.map(p => [p.lon, p.lat]) }, properties: {
    osm_id: identity,
    relation_id: relation?.id ?? null,
    relation_role: relation?.role ?? null,
    way_id: relation?.wayId ?? Number(identity.split('/')[1]),
    route: relation?.tags?.route ?? null,
    name: effective.name ?? null,
    ref: effective.ref ?? null,
    network: effective.network ?? null,
    'osmc:symbol': effective['osmc:symbol'] ?? null,
    colour: effective.colour ?? null,
    'piste:type': effective['piste:type'] ?? null,
    'piste:difficulty': effective['piste:difficulty'] ?? null,
    'piste:grooming': effective['piste:grooming'] ?? null,
    aerialway: effective.aerialway ?? null,
    relation_tags_json: relation ? JSON.stringify(relation.tags) : null,
    way_tags_json: JSON.stringify(tags),
    attribution: '© OpenStreetMap contributors (ODbL 1.0)',
  } });
}

for (const item of data.elements || []) {
  if (item.type !== 'relation' || item.tags?.type !== 'route') continue;
  const route = item.tags.route;
  const layer = ['hiking', 'foot'].includes(route) ? 'hiking' : ['bicycle', 'mtb'].includes(route) ? 'cycling' : route === 'piste' ? 'pistes' : null;
  if (!layer) continue;
  for (const member of item.members || []) {
    if (member.type !== 'way') continue;
    const way = ways.get(member.ref);
    add(layer, member.geometry || way?.geometry, `relation/${item.id}/way/${member.ref}`, way?.tags || {}, {
      id: item.id, wayId: member.ref, role: member.role || '', tags: item.tags,
    });
  }
}
for (const item of data.elements || []) {
  if (item.type !== 'way') continue;
  if (item.tags?.['piste:type']) add('pistes', item.geometry, `way/${item.id}`, item.tags);
  if (item.tags?.aerialway && item.tags.aerialway !== 'no') add('lifts', item.geometry, `way/${item.id}`, item.tags);
}
await mkdir(output, { recursive: true });
for (const [name, features] of Object.entries(layers)) {
  await writeFile(join(output, `${name}.geojson`), JSON.stringify({ type: 'FeatureCollection', features }));
}
const summary = { source: input, counts: Object.fromEntries(Object.entries(layers).map(([name, features]) => [name, features.length])), missingGeometry };
await writeFile(join(output, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
