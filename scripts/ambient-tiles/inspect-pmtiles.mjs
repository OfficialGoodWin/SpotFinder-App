#!/usr/bin/env node
// Inspect one real source feature and its corresponding vector tile, read only.
import { readFile, open } from 'node:fs/promises';
import { PMTiles } from 'pmtiles';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const i = arg.indexOf('=');
  return [arg.slice(2, i), arg.slice(i + 1)];
}));
if (!args.pmtiles || !args.geojson || !args.id) throw new Error('Usage: node inspect-pmtiles.mjs --pmtiles=archive.pmtiles --geojson=ambient-poi.geojson --id=source-id [--z=16]');
const source = JSON.parse(await readFile(args.geojson, 'utf8'));
const feature = source.features.find(item => String(item.properties?.id) === args.id || item.properties?.source_id === args.id);
if (!feature) throw new Error(`Source feature ${args.id} not found`);
const positions = [];
const collect = value => {
  if (typeof value?.[0] === 'number' && typeof value?.[1] === 'number') positions.push(value);
  else if (Array.isArray(value)) value.forEach(collect);
};
collect(feature.geometry?.coordinates);
if (!positions.length) throw new Error('Feature has no coordinates');
const bounds = positions.reduce((result, [x, y]) => [Math.min(result[0], x), Math.min(result[1], y), Math.max(result[2], x), Math.max(result[3], y)], [180, 90, -180, -90]);
const lon = (bounds[0] + bounds[2]) / 2;
const lat = (bounds[1] + bounds[3]) / 2;
const z = Number(args.z || 16);
const scale = 2 ** z;
const x = Math.floor((lon + 180) / 360 * scale);
const radians = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
const y = Math.floor((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * scale);
const handle = await open(args.pmtiles, 'r');
try {
  const archive = new PMTiles({
    getKey: () => args.pmtiles,
    getBytes: async (offset, length) => {
      const bytes = Buffer.alloc(length);
      const result = await handle.read(bytes, 0, length, offset);
      if (result.bytesRead !== length) throw new Error('Truncated PMTiles archive');
      return { data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    },
  });
  const matches = [];
  let foundTile = null;
  let layerFeatureCount = 0;
  for (let dy = -2; dy <= 2 && !matches.length; dy++) for (let dx = -2; dx <= 2 && !matches.length; dx++) {
    const tileData = await archive.getZxy(z, x + dx, y + dy);
    if (!tileData) continue;
    const tile = new VectorTile(new Pbf(new Uint8Array(tileData.data)));
    const layer = tile.layers.ambient_poi;
    if (!layer) continue;
    for (let index = 0; index < layer.length; index++) {
      const item = layer.feature(index);
      if (String(item.properties?.id) === args.id || item.properties?.source_id === args.id) {
        matches.push(item.properties); foundTile = `${z}/${x + dx}/${y + dy}`; layerFeatureCount = layer.length;
      }
    }
  }
  console.log(JSON.stringify({ source: feature.properties, sourceGeometry: feature.geometry.type, tile: foundTile || `${z}/${x}/${y} and neighboring tiles`, layerFeatureCount, matchingTileProperties: matches }, null, 2));
  if (!matches.length) process.exitCode = 2;
} finally { await handle.close(); }
