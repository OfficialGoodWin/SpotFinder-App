import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { poiDetailTile } from '../src/lib/poiDetailShard.js';
import { resolveVisiblePoiText } from '../src/lib/poiLocalization.js';

test('published station row joins the verified legacy tile feature and resolves existing OSM names', async () => {
  const shard = JSON.parse(await readFile(new URL('../public/poi-details/10/553/346.json', import.meta.url), 'utf8'));
  const properties = { id: 24569897, cat: 'train', name: 'Hlavní nádraží', wikidata: 'Q2383883' };
  const coordinates = { lon: 14.434125423431396, lat: 50.08350372246943 };
  assert.deepEqual(poiDetailTile(coordinates.lon, coordinates.lat), { x: 553, y: 346 });
  assert.equal(shard.schemaVersion, 1);
  assert.ok(shard.items.length >= 1);
  assert.equal(shard.items.filter(item => String(item.id) === String(properties.id)).length, 1);
  const detail = shard.items.find(item => String(item.id) === String(properties.id));
  assert.equal(detail.canonical_id, 'osm:node:24569897');
  assert.deepEqual(detail.nameProvenance, { cs: 'osm:name:cs', en: 'osm:name:en', de: 'osm:name:de' });
  const poi = { id: properties.id, name: properties.name, ...coordinates, enrichment: detail,
    tags: { wikidata: properties.wikidata }, _ambientHit: { properties, details: detail } };
  assert.equal(resolveVisiblePoiText(poi, 'cs').name, 'Hlavní nádraží');
  assert.equal(resolveVisiblePoiText(poi, 'en').name, 'Main Station');
  assert.equal(resolveVisiblePoiText(poi, 'de').name, 'Hauptbahnhof');
  assert.equal(resolveVisiblePoiText(poi, 'fr').name, 'Hlavní nádraží');
});
