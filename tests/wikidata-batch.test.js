import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectVerifiedLinks, enrichWikidata } from '../scripts/enrichment/wikidata-batch.mjs';
import foundation from '../functions/officialPoiFoundation.js';

const rows = [
  { id: 'osm:node:1', tags: { wikidata: 'Q42' }, wikidata: { id: 'Q42', linkMethod: 'osm_tag' }, osmNames: { cs: 'České jméno', en: 'English name' } },
  { id: 'osm:way:2', tags: { wikidata: 'Q42' }, wikidata: { id: 'Q42', linkMethod: 'osm_tag' } },
  { id: 'osm:node:3', tags: {}, wikidata: null },
  { id: 'osm:node:4', tags: { wikidata: 'Q0' }, wikidata: { id: 'Q0', linkMethod: 'osm_tag' } },
  { id: 'osm:node:5', tags: { wikidata: 'Q999' }, wikidata: { id: 'Q42', linkMethod: 'osm_tag' } },
  { id: 'osm:node:6', wikidata: { id: 'Q42', linkMethod: 'name_match' } },
];

test('only explicit, consistent Q-ID links are batched; cache, retry, negative values and resume are bounded', async () => {
  assert.deepEqual(collectVerifiedLinks(rows).map(item => item.id), ['osm:node:1', 'osm:way:2']);
  const dir = await mkdtemp(join(tmpdir(), 'spotfinder-wd-'));
  const cachePath = join(dir, 'cache.json');
  const checkpointPath = join(dir, 'checkpoint.json');
  const requests = [];
  let sleeps = 0;
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    if (requests.length === 1) return { ok: false, status: 429, headers: { get: () => '1' } };
    return { ok: true, json: async () => ({ entities: [{ id: 'Q42', lastrevid: 7,
      labels: { cs: { value: 'Wikidata česky' }, en: { value: 'Wikidata English' } }, descriptions: { en: { value: 'Short summary' } } }] }) };
  };
  const options = { rows, languages: ['cs', 'en'], cachePath, checkpointPath, maxRequests: 2, fetchImpl, sleep: async ms => { assert.equal(ms, 1000); sleeps++; }, now: () => '2026-10-19T00:00:00.000Z' };
  const dry = await enrichWikidata({ ...options, dryRun: true });
  assert.equal(dry.diagnostics.requests, 0);
  const result = await enrichWikidata(options);
  assert.equal(result.diagnostics.requests, 2);
  assert.equal(result.diagnostics.retries, 1);
  assert.equal(sleeps, 1);
  assert.equal(requests.length, 2);
  assert.equal(new URL(requests[0].url).searchParams.get('action'), 'wbgetentities');
  assert.equal(new URL(requests[0].url).searchParams.get('ids'), 'Q42');
  assert.match(requests[0].options.headers['User-Agent'], /SpotFinder/);
  assert.equal(result.cache.entities.Q42.summaries.cs, null);
  assert.equal((await enrichWikidata(options)).diagnostics.requests, 0);
  assert.deepEqual(JSON.parse(await readFile(checkpointPath, 'utf8')).complete, ['Q42']);
});

test('locale precedence, rejection freshness and public projection protect approved content', () => {
  const base = { id: 'osm:node:1', sourceKind: 'osm', region: 'CZ', position: { lat: 50, lon: 14 }, category: 'museum',
    originalName: 'Původní jméno', originalDescription: 'Původní popis', descriptionRevision: foundation.sourceRevision('Původní popis'),
    osmNames: { cs: 'České jméno', en: 'English name' }, osmDescriptions: { en: 'OSM description' },
    wikidata: { id: 'Q42', linkMethod: 'osm_tag', labels: { en: 'Wikidata English', de: 'Deutsch' }, summaries: { en: 'Short summary' } } };
  const patch = { nameOverrides: [{ language: 'en', text: 'Admin English', source: 'human', approval: 'approved' }],
    descriptions: [{ language: 'en', text: 'Cached old translation', source: 'machine', approval: 'approved', sourceRevision: base.descriptionRevision }],
    enrichmentReviews: [{ language: 'de', kind: 'name', sourceReference: 'wikidata:Q42', sourceRevision: foundation.sourceRevision('Deutsch'), status: 'rejected' }] };
  assert.equal(foundation.resolvePoiName(base, patch, 'en-GB'), 'Admin English');
  assert.equal(foundation.resolvePoiName(base, {}, 'en-GB'), 'English name');
  assert.equal(foundation.resolvePoiName(base, patch, 'de-AT'), 'Původní jméno');
  assert.equal(foundation.resolvePoiName(base, {}, 'de-AT'), 'Deutsch');
  assert.equal(foundation.resolvePoiName({ ...base, wikidata: null, osmNames: {} }, {}, 'fr'), 'Původní jméno');
  assert.equal(foundation.resolvePoiDescription(base, patch, 'en'), 'OSM description');
  assert.equal(foundation.resolvePoiDescription({ ...base, osmDescriptions: {} }, patch, 'en'), 'Cached old translation');
  assert.equal(foundation.resolvePoiDescription({ ...base, osmDescriptions: {}, descriptionRevision: 'sha256:' + 'a'.repeat(64) }, patch, 'en'), 'Původní popis');
  assert.equal(foundation.resolvePoiDescription(base, {}, 'fr'), 'Původní popis');
  const published = foundation.toPublicPoiRecord(base, { patch, revision: 2, privateNote: 'private secret', updatedByUid: 'admin' });
  assert.equal(JSON.stringify(published).includes('private secret'), false);
  assert.equal(JSON.stringify(published).includes('updatedByUid'), false);
});

test('ordinary POI detail code has no Wikidata or Wikipedia API lookup', async () => {
  const source = await readFile(new URL('../src/components/spots/POIDetailPanel.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /wikidata\.org\/w\/api\.php|wikipedia\.org\/api\/rest_v1/);
});

test('missing entity is negatively cached and request budget stops additional batches', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spotfinder-wd-missing-'));
  const cachePath = join(dir, 'cache.json');
  const checkpointPath = join(dir, 'checkpoint.json');
  const links = [
    { id: 'osm:node:7', tags: { wikidata: 'Q777' }, wikidata: { id: 'Q777', linkMethod: 'osm_tag' } },
    { id: 'osm:node:8', tags: { wikidata: 'Q888' }, wikidata: { id: 'Q888', linkMethod: 'osm_tag' } },
  ];
  let calls = 0;
  const options = { rows: links, languages: ['en-GB'], cachePath, checkpointPath, maxRequests: 1, batchSize: 1,
    fetchImpl: async () => { calls++; return { ok: true, json: async () => ({ entities: [{ id: 'Q777', missing: true }] }) }; } };
  const first = await enrichWikidata(options);
  assert.equal(calls, 1);
  assert.equal(first.cache.entities.Q777.missing, true);
  assert.deepEqual(Object.keys(first.cache.entities.Q777.labels).sort(), ['en', 'en-GB'].sort());
  assert.equal(first.cache.entities.Q888, undefined);
  const second = await enrichWikidata(options);
  assert.equal(second.diagnostics.cacheHits, 1);
  assert.equal(calls, 2);
});
