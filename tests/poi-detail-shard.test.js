import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoiDetailShardReader, poiDetailTile } from '../src/lib/poiDetailShard.js';

const one = { lon: 14.6, lat: 50.1 };
const two = { lon: 14.2, lat: 50.1 };

test('z10 URLs use the same Web Mercator coordinates as the detail exporter', () => {
  assert.deepEqual(poiDetailTile(one.lon, one.lat), { x: 553, y: 346 });
  assert.deepEqual(poiDetailTile(two.lon, two.lat), { x: 552, y: 346 });
  assert.equal(poiDetailTile(NaN, 50), null);
});

test('missing shards are empty and fetched once across POI switches and reopen', async () => {
  const urls = [];
  const read = createPoiDetailShardReader(async url => { urls.push(url); return { status: 404, ok: false }; });
  for (const point of [one, two, one, two]) assert.equal(await read(point.lon, point.lat), null);
  assert.equal(urls.length, 2);
  assert.equal(urls[0], '/poi-details/10/553/346.json');
  assert.equal(urls[1], '/poi-details/10/552/346.json');
});

test('valid shards are reused for multiple POIs and base URL is normalized', async () => {
  let count = 0;
  const items = [{ id: '1', description: 'Existing detail' }, { id: '2', phone: '+420 123' }];
  const read = createPoiDetailShardReader(async url => { count++; assert.equal(url, '/poi-details/10/553/346.json'); return { status: 200, ok: true, json: async () => ({ items }) }; });
  for (const id of ['1', '2', '1']) assert.equal((await read(one.lon, one.lat, '/poi-details/10/')).find(item => item.id === id)?.id, id);
  assert.equal(count, 1);
});

test('unexpected HTTP and invalid JSON are errors and can be retried', async () => {
  let calls = 0;
  const read = createPoiDetailShardReader(async () => { calls++; return calls === 1 ? { status: 503, ok: false } : { status: 200, ok: true, json: async () => ({ items: [] }) }; });
  await assert.rejects(read(one.lon, one.lat), /HTTP 503/);
  assert.deepEqual(await read(one.lon, one.lat), []);
  assert.equal(calls, 2);
  const invalid = createPoiDetailShardReader(async () => ({ status: 200, ok: true, json: async () => ({ unexpected: true }) }));
  await assert.rejects(invalid(one.lon, one.lat), /Invalid POI detail shard/);
});
