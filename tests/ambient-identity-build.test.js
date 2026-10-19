import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { identityFromOsmiumAttributes } from '../scripts/ambient-tiles/identity.js';

const exec = promisify(execFile);
const script = join(process.cwd(), 'scripts/ambient-tiles/build.js');
const point = [14.42076, 50.08804];

test('original osmium type and ID survive normalization for node, way and relation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spotfinder-ambient-'));
  try {
    const rawPath = join(dir, 'raw.geojson');
    const outputPath = join(dir, 'normalized.geojson');
    const features = ['node', 'way', 'relation'].map((type, index) => ({
      type: 'Feature', id: `geometry-${index}`, geometry: { type: 'Point', coordinates: point },
      properties: { '@type': type, '@id': 123 + index, amenity: 'restaurant', name: `Place ${index}`, 'name:cs': `Místo ${index}` },
    }));
    await writeFile(rawPath, JSON.stringify({ type: 'FeatureCollection', features }));
    await exec(process.execPath, [script, `--in=${rawPath}`, `--out=${outputPath}`]);
    const output = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(output.features.length, 3);
    for (let i = 0; i < 3; i++) {
      const props = output.features[i].properties;
      assert.equal(props.canonical_id, `osm:${['node', 'way', 'relation'][i]}:${123 + i}`);
      assert.equal(props.source_id, `${['node', 'way', 'relation'][i]}/${123 + i}`);
      assert.equal(props.id, props.source_id);
      assert.equal(props['name:cs'], `Místo ${i}`);
      assert.deepEqual(output.features[i].geometry, features[i].geometry);
    }
    delete features[0].properties['@type'];
    await writeFile(rawPath, JSON.stringify({ type: 'FeatureCollection', features }));
    await assert.rejects(exec(process.execPath, [script, `--in=${rawPath}`, `--out=${outputPath}`]), /Missing verified @type\/@id/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('feature IDs, numeric OSM IDs and unsafe numbers cannot establish typed identity', () => {
  assert.equal(identityFromOsmiumAttributes({ '@id': 123 }), null);
  assert.equal(identityFromOsmiumAttributes({ '@type': 'node', '@id': Number.MAX_SAFE_INTEGER + 1 }), null);
  assert.equal(identityFromOsmiumAttributes({ '@type': 'node', '@id': 123, id: 'relation/999' })?.canonicalId, 'osm:node:123');
});
