import test from 'node:test';
import assert from 'node:assert/strict';
import { ambientPoiNameExpression, poiLocaleCandidates, resolveVisiblePoiText } from '../src/lib/poiLocalization.js';
import { createPoiDetailShardReader } from '../src/lib/poiDetailShard.js';

const properties = { id: 'node/10', name: 'Pražský hrad', 'name:cs': 'Pražský hrad', 'name:en': 'Prague Castle', 'name:de': 'Prager Burg',
  'description:de': 'Burganlage in Prag', wikidata: 'Q193369' };
const staticDetail = { id: 'node/10', description: 'Historický hrad v Praze.',
  localizedNames: [{ language: 'en', text: 'Approved Castle', source: 'human', approval: 'approved' }],
  localizedDescriptions: [{ language: 'en', text: 'Approved English description.', source: 'human', approval: 'approved' }],
  wikidata: { id: 'Q193369', linkMethod: 'osm_tag', labels: { fr: 'Château de Prague' }, summaries: { fr: 'Château en Tchéquie' } } };
const poi = { id: '10', name: properties.name, tags: { description: staticDetail.description, wikidata: properties.wikidata },
  _ambientHit: { properties }, enrichment: staticDetail };

test('BCP 47 name and description resolution follows approved, OSM, verified Wikidata, original', () => {
  assert.deepEqual(poiLocaleCandidates('de-AT'), ['de-AT', 'de']);
  assert.equal(resolveVisiblePoiText(poi, 'en-GB').name, 'Approved Castle');
  assert.equal(resolveVisiblePoiText(poi, 'en').description, 'Approved English description.');
  assert.equal(resolveVisiblePoiText(poi, 'de-AT').name, 'Prager Burg');
  assert.equal(resolveVisiblePoiText(poi, 'de-AT').description, 'Burganlage in Prag');
  assert.equal(resolveVisiblePoiText(poi, 'fr').name, 'Château de Prague');
  assert.equal(resolveVisiblePoiText(poi, 'fr').shortSummary, 'Château en Tchéquie');
  assert.equal(resolveVisiblePoiText(poi, 'cs').name, 'Pražský hrad');
  assert.equal(resolveVisiblePoiText(poi, 'es').description, 'Historický hrad v Praze.');
  const cached = { ...poi, enrichment: { ...staticDetail, descriptionRevision: 'revision-1', localizedDescriptions: [
    { language: 'es', text: 'Descripción aprobada.', source: 'machine', approval: 'approved', sourceRevision: 'revision-1' },
  ] } };
  assert.equal(resolveVisiblePoiText(cached, 'es').description, 'Descripción aprobada.');
  assert.equal(resolveVisiblePoiText({ ...cached, enrichment: { ...cached.enrichment, descriptionRevision: 'revision-2' } }, 'es').description, staticDetail.description);
  const noWikidata = { ...poi, tags: { description: staticDetail.description }, _ambientHit: { properties: { ...properties, wikidata: null } } };
  assert.equal(resolveVisiblePoiText(noWikidata, 'fr').name, 'Pražský hrad');
  assert.equal(resolveVisiblePoiText({ ...poi, enrichment: { ...staticDetail, wikidata: { ...staticDetail.wikidata, id: 'Q999' } } }, 'fr').name, 'Pražský hrad');
});

test('ambient marker expression uses only language tags available in PMTiles', () => {
  assert.deepEqual(ambientPoiNameExpression('de-AT'), ['step', ['zoom'], '', 14,
    ['coalesce', ['get', 'name:de-AT'], ['get', 'name:de'], ['get', 'name'], '']]);
});

test('published detail shard values reach the locale resolver; missing shards retain tile text', async () => {
  const read = createPoiDetailShardReader(async (_, options) => {
    assert.equal(options.cache, 'force-cache');
    return { status: 200, ok: true, json: async () => ({ items: [staticDetail] }) };
  });
  const detail = (await read(14.6, 50.1)).find(item => item.id === properties.id);
  assert.equal(resolveVisiblePoiText({ ...poi, enrichment: detail }, 'fr').name, 'Château de Prague');
  const missing = createPoiDetailShardReader(async () => ({ status: 404, ok: false }));
  assert.equal(await missing(14.6, 50.1), null);
  assert.equal(resolveVisiblePoiText({ ...poi, enrichment: null }, 'de').name, 'Prager Burg');
});
