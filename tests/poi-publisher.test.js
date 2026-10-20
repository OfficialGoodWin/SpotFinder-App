import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishPoiDetails } from '../scripts/enrichment/publish-poi-details.mjs';
import { resolveVisiblePoiText } from '../src/lib/poiLocalization.js';

const sample = JSON.parse(await readFile(new URL('fixtures/poi-publisher-sample.json', import.meta.url), 'utf8'));
const deployed = JSON.parse(await readFile(new URL('../public/poi-details/10/553/346.json', import.meta.url), 'utf8'));
const station = deployed.items.find(item => String(item.id) === '24569897');
assert.ok(station, 'verified station row must exist');
const existing = `${JSON.stringify({ ...deployed, items: [station] }, null, 2)}\n`;
const shardPath = root => join(root, '10', '553', '346.json');
async function setup() { const root = await mkdtemp(join(tmpdir(), 'poi-publish-')); await mkdir(join(root, '10', '553'), { recursive: true }); await writeFile(shardPath(root), existing); return root; }
const clone = value => structuredClone(value);

test('five real reviewed features merge into the station shard without changing its row; rerun is stable', async () => {
  const root = await setup();
  const before = JSON.parse(existing).items[0];
  const dry = await publishPoiDetails({ input: sample, outputRoot: root, now: () => '2026-10-20T00:00:00Z' });
  assert.equal(dry.dryRun, true);
  assert.deepEqual(dry.changedFiles, ['poi-details/10/553/346.json']);
  assert.equal(await readFile(shardPath(root), 'utf8'), existing);
  const write = await publishPoiDetails({ input: sample, outputRoot: root, dryRun: false, now: () => '2026-10-20T00:00:00Z' });
  assert.equal(write.uniqueRecords, 5);
  const shard = JSON.parse(await readFile(shardPath(root), 'utf8'));
  assert.equal(shard.items.length, 6);
  assert.deepEqual(shard.items.find(item => item.id === '24569897'), before);
  assert.equal(shard.items.filter(item => item.id === '24569684').length, 1);
  const second = shard.items.find(item => item.id === '24569759');
  const poi = { name: 'Kobylisy', enrichment: second, _ambientHit: { properties: { id: 24569759, name: 'Kobylisy' }, details: second } };
  assert.equal(resolveVisiblePoiText(poi, 'cs').name, 'Kobylisy');
  assert.equal(resolveVisiblePoiText(poi, 'de').name, 'Kobilis');
  const body = await readFile(shardPath(root), 'utf8');
  assert.deepEqual((await publishPoiDetails({ input: sample, outputRoot: root, dryRun: false })).changedFiles, []);
  assert.equal(await readFile(shardPath(root), 'utf8'), body);
  const manifest = JSON.parse(await readFile(join(root, 'publisher-manifest.json'), 'utf8'));
  assert.match(manifest.assets['10/553/346.json'].sha256, /^[a-f0-9]{64}$/);
});

test('bad identity, coordinates, language, URL and collision leave the original shard untouched', async () => {
  const root = await setup();
  const bad = [
    input => { input.records[0].canonicalId = 'osm:way:24569684'; },
    input => { input.records[0].position.lat = 100; },
    input => { input.records[0].source.osmNames['xx-invalid'] = 'Bad'; },
    input => { input.records[0].source.website = 'javascript:alert(1)'; },
    input => { input.records.push({ ...clone(input.records[0]), canonicalId: 'osm:relation:24569684' }); },
    input => { input.records[0].tileFeature.archiveSha256 = '0'.repeat(64); },
    input => { input.records[0].privateNote = 'secret'; },
  ];
  for (const mutate of bad) {
    const input = clone(sample); mutate(input);
    await assert.rejects(publishPoiDetails({ input, outputRoot: root, dryRun: false }));
    assert.equal(await readFile(shardPath(root), 'utf8'), existing);
  }
});

test('server-snapshot projection emits approved metadata only and blocks geometry and drafts', async () => {
  const root = await setup();
  const input = { ...sample, records: [sample.records[0]] };
  const id = input.records[0].canonicalId;
  const patch = {
    nameOverrides: [
      { language: 'en', text: 'I. P. Pavlova Station', source: 'human', approval: 'approved' },
      { language: 'de', text: 'PRIVATE DRAFT', source: 'human', approval: 'draft' },
    ],
    website: 'https://example.org/', category: 'hotel',
  };
  const change = { id, sourceKind: 'osm', workflow: 'ready', publicationStatus: 'unpublished', revision: 2,
    base: { id, category: 'train', originalName: 'I. P. Pavlova', position: input.records[0].position, sourceFields: { tile: { id: 24569684 } } },
    patch, privateNote: 'PRIVATE NOTE', updatedByUid: 'PRIVATE UID' };
  const revision = { id, revision: 2, workflow: 'ready', patch };
  const report = await publishPoiDetails({ input, outputRoot: root, dryRun: false, adminDocuments: { [id]: { change, revision } } });
  assert.equal(report.blocked.length, 1);
  assert.match(report.blocked[0].reason, /category/);
  const body = await readFile(shardPath(root), 'utf8');
  assert.doesNotMatch(body, /PRIVATE|updatedByUid|privateNote/);
  const row = JSON.parse(body).items.find(item => item.id === '24569684');
  assert.deepEqual(row.localizedNames, [{ language: 'en', text: 'I. P. Pavlova Station', source: 'human', approval: 'approved' }]);
  assert.equal(row.website, 'https://example.org/');
  assert.equal(resolveVisiblePoiText({ name: row.originalName, enrichment: row }, 'en').name, 'I. P. Pavlova Station');
  const draftRoot = await setup();
  await assert.rejects(publishPoiDetails({ input, outputRoot: draftRoot, dryRun: false, adminDocuments: { [id]: { change: { ...change, workflow: 'draft' }, revision } } }));
  assert.equal(await readFile(shardPath(draftRoot), 'utf8'), existing);
});

test('invalid existing output or manifest stops before replacing a valid shard', async () => {
  const root = await setup();
  await writeFile(join(root, 'publisher-manifest.json'), '{"schemaVersion":2,"assets":{}}\n');
  await assert.rejects(publishPoiDetails({ input: sample, outputRoot: root, dryRun: false }), /manifest/);
  assert.equal(await readFile(shardPath(root), 'utf8'), existing);
  await writeFile(shardPath(root), '{"schemaVersion":1,"items":[{"id":"24569897"},{"id":"24569897"}]}\n');
  const damaged = await readFile(shardPath(root), 'utf8');
  await assert.rejects(publishPoiDetails({ input: sample, outputRoot: root, dryRun: false }), /Duplicate numeric ID/);
  assert.equal(await readFile(shardPath(root), 'utf8'), damaged);
});
