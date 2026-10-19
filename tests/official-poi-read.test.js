import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readOfficialPoi } = require('../functions/officialPoiReader.js');

function fakeDb() {
  const calls = [];
  const item = { id: 'osm:node:13794953629', revision: 2, updatedAt: { toMillis: () => 42 } };
  const db = { collection(name) {
    calls.push(['collection', name]);
    return {
      doc(id) { calls.push(['doc', id]); return { get: async () => ({ exists: true, data: () => item }) }; },
      orderBy(field, direction) { calls.push(['orderBy', field, direction]); return this; },
      where(field, operator, value) { calls.push(['where', field, operator, value]); return this; },
      limit(count) { calls.push(['limit', count]); return this; },
      async get() { return { docs: [{ data: () => item }] }; },
    };
  } };
  return { db, calls };
}

test('official read callable enforces signed admin actor and bounded paths', async () => {
  const { db, calls } = fakeDb();
  const admin = { uid: 'admin-uid', admin: true };
  for (const action of ['list', 'get', 'history']) {
    const input = action === 'list' ? { action } : { action, id: 'osm:node:13794953629' };
    const output = await readOfficialPoi({ db, actor: admin, input });
    assert.equal((output.item || output.items[0]).id, 'osm:node:13794953629');
  }
  assert.ok(calls.some(call => call[0] === 'collection' && call[1] === 'official_poi_changes'));
  assert.ok(calls.some(call => call[0] === 'collection' && call[1] === 'official_poi_revisions'));
  assert.ok(calls.some(call => call[0] === 'limit' && call[1] === 50));
  assert.ok(calls.some(call => call[0] === 'limit' && call[1] === 100));
  assert.equal((await readOfficialPoi({ db, actor: admin, input: { action: 'get', id: 'osm:node:13794953629' } })).item.updatedAt, 42);
  for (const actor of [null, { uid: 'visitor', admin: false }, { uid: 'forged', isAdmin: true }]) {
    await assert.rejects(readOfficialPoi({ db, actor, input: { action: 'list' } }), { code: 'permission-denied' });
  }
  await assert.rejects(readOfficialPoi({ db, actor: admin, input: { action: 'get', id: '13794953629' } }), { code: 'invalid-argument' });
  await assert.rejects(readOfficialPoi({ db, actor: admin, input: { action: 'list', actorUid: 'forged' } }), { code: 'invalid-argument' });
});

test('the owner PBF index resolves real numeric node, way and relation IDs only for admins', async () => {
  const { db } = fakeDb();
  const admin = { uid: 'admin-uid', admin: true };
  for (const [legacyId, category, canonicalId] of [
    ['13794953629', 'drinking_water', 'osm:node:13794953629'],
    ['4019772', 'parking', 'osm:way:4019772'],
    ['14376025', 'parking', 'osm:relation:14376025'],
  ]) {
    const result = await readOfficialPoi({ db, actor: admin, input: { action: 'resolve-legacy', legacyId, category } });
    assert.equal(result.identity.canonicalId, canonicalId);
  }
  await assert.rejects(readOfficialPoi({ db, actor: admin, input: { action: 'resolve-legacy', legacyId: '13794953629', category: 'museum' } }), { code: 'failed-precondition' });
  await assert.rejects(readOfficialPoi({ db, actor: { uid: 'forged', isAdmin: true }, input: { action: 'resolve-legacy', legacyId: '13794953629', category: 'drinking_water' } }), { code: 'permission-denied' });
});
