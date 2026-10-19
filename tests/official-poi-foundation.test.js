import test from 'node:test';
import assert from 'node:assert/strict';
import foundation from '../functions/officialPoiFoundation.js';
import service from '../functions/officialPoiService.js';

const { canonicalOsmId, canonicalFromOsmium, parseCanonicalId, newSpotFinderId,
  validatePatch, validateCustomBase, validateImportedBase, resolvePoiName,
  resolvePoiDescription, toPublicPoiRecord, validatePublicationManifest } = foundation;

test('canonical IDs retain OSM type and never trust tile or bare numeric IDs', () => {
  assert.equal(canonicalOsmId('node', '123'), 'osm:node:123');
  assert.notEqual(canonicalOsmId('node', '123'), canonicalOsmId('way', '123'));
  assert.notEqual(canonicalOsmId('way', '123'), canonicalOsmId('relation', '123'));
  assert.equal(canonicalFromOsmium('relation/123'), 'osm:relation:123');
  for (const source of ['123', 123, 'n123', 'feature/123', 'node/0']) assert.equal(canonicalFromOsmium(source), null);
  const custom = newSpotFinderId();
  assert.equal(parseCanonicalId(custom).sourceKind, 'spotfinder');
  assert.notEqual(custom, newSpotFinderId());
  assert.equal(parseCanonicalId('osm:node:123').osm.id, '123');
});

test('base and sparse patches reject invalid coordinates, categories, forged fields, and unverified Q IDs', () => {
  const base = { position: { lat: 50, lon: 14 }, category: 'museum', originalName: 'Muzeum', region: 'CZ' };
  assert.equal(validateCustomBase(base).originalName, 'Muzeum');
  assert.throws(() => validateCustomBase({ ...base, position: { lat: 95, lon: 14 } }), /latitude/);
  assert.throws(() => validatePatch({ category: 'made_up' }), /category/);
  assert.throws(() => validatePatch({ admin: true }), /not allowed/);
  assert.throws(() => validatePatch({ ownerUid: 'victim' }), /not allowed/);
  assert.throws(() => validatePatch({ nameOverrides: [{ language: 'cs', text: 'Translated business', source: 'machine', approval: 'approved' }] }), /human approval/);
  assert.throws(() => validatePatch({ descriptions: [{ language: 'cs', text: 'Translated text', source: 'machine', approval: 'approved', sourceRevision: 'outdated' }] }), /SHA-256/);
  assert.throws(() => validatePatch({ photoRefs: [{ storagePath: 'data:image/png;base64,abc', license: 'CC BY', credit: 'Author', approval: 'approved' }] }), /photo path/);
  assert.throws(() => validatePatch({ photoRefs: [{ storagePath: 'official-poi-photos/a.jpg', license: 'CC BY', credit: 'Author', approval: 'approved' }] }), /rights review/);
  assert.throws(() => validatePatch({ phone: 'x'.repeat(70000) }), /64 KiB/);
  assert.throws(() => validateImportedBase({ ...base, id: 'osm:node:1', wikidata: { id: 'Q42', linkMethod: 'name_match' } }), /explicit OSM/);
  assert.equal(validateImportedBase({ ...base, id: 'osm:way:1', wikidata: { id: 'Q42', linkMethod: 'osm_tag' } }).osm.type, 'way');
  assert.deepEqual(validateImportedBase({ ...base, id: 'osm:way:1', originalName: '', sourceFields: { tile: { id: 'way/1', cat: 'museum' } } }).sourceFields.tile, { id: 'way/1', cat: 'museum' });
  assert.throws(() => validateImportedBase({ ...base, id: 'osm:way:1', sourceFields: { tile: { html: 'x'.repeat(40000) } } }), /32 KiB/);
});

test('locale resolution honors approved overrides, OSM language tags, verified Wikidata, and original text', () => {
  const base = { originalName: 'Místní jméno', originalDescription: 'Původní popis', descriptionRevision: foundation.sourceRevision('Původní popis'),
    osmNames: { en: 'OSM English' }, osmDescriptions: { de: 'OSM Beschreibung' },
    wikidata: { id: 'Q42', linkMethod: 'osm_tag', labels: { fr: 'Wikidata français' } } };
  const patch = { nameOverrides: [{ language: 'en', text: 'Approved English', source: 'human', approval: 'approved' }],
    descriptions: [
      { language: 'en', text: 'Pending human', source: 'human', approval: 'draft' },
      { language: 'en', text: 'Approved machine', source: 'machine', approval: 'approved', sourceRevision: base.descriptionRevision },
    ] };
  assert.equal(resolvePoiName(base, patch, 'en-GB'), 'Approved English');
  assert.equal(resolvePoiName(base, {}, 'en'), 'OSM English');
  assert.equal(resolvePoiName(base, {}, 'fr'), 'Wikidata français');
  assert.equal(resolvePoiName(base, {}, 'it'), 'Místní jméno');
  assert.equal(resolvePoiDescription(base, patch, 'en'), 'Approved machine');
  assert.equal(resolvePoiDescription({ ...base, descriptionRevision: foundation.sourceRevision('Changed source') }, patch, 'en'), 'Původní popis');
  assert.equal(resolvePoiDescription(base, patch, 'de'), 'OSM Beschreibung');
  assert.equal(resolvePoiDescription(base, patch, 'it'), 'Původní popis');
  assert.equal(resolvePoiName({ ...base, wikidata: { ...base.wikidata, linkMethod: 'inferred' } }, {}, 'fr'), 'Místní jméno');
});

test('public projection strips administrative and unapproved content', () => {
  const base = { id: 'osm:node:10', sourceKind: 'osm', osm: { type: 'node', id: '10' },
    region: 'CZ', position: { lat: 50, lon: 14 }, category: 'museum', originalName: 'Museum', website: 'https://example.org' };
  const change = { revision: 3, privateNote: 'internal-only', actorUid: 'admin', patch: {
    website: null, visibility: 'hidden', descriptions: [
      { language: 'en', text: 'Approved', source: 'human', approval: 'approved' },
      { language: 'cs', text: 'Private draft', source: 'human', approval: 'draft' },
    ], photoRefs: [{ storagePath: 'official-poi-photos/a.jpg', approval: 'draft' }],
  } };
  const publicRecord = toPublicPoiRecord(base, change);
  assert.equal(publicRecord.website, null);
  assert.equal(publicRecord.visibility, 'hidden');
  assert.equal(publicRecord.localizedDescriptions.length, 1);
  assert.equal(publicRecord.photoRefs.length, 0);
  assert.equal(JSON.stringify(publicRecord).includes('internal-only'), false);
  assert.equal(JSON.stringify(publicRecord).includes('actorUid'), false);
});

test('publication manifest requires immutable versioned assets', () => {
  const asset = { path: 'poi-publications/2026-10-cz-01/cz.pmtiles', sha256: 'a'.repeat(64), bytes: 100, kind: 'pmtiles', region: 'CZ' };
  const manifest = { schemaVersion: 1, version: '2026-10-cz-01', createdAt: '2026-10-18', regions: ['CZ'], assets: [asset] };
  assert.equal(validatePublicationManifest(manifest), manifest);
  assert.throws(() => validatePublicationManifest({ ...manifest, assets: [{ ...asset, path: 'ambient-poi.pmtiles' }] }), /versioned/);
});

function memoryDb() {
  const docs = new Map();
  let generated = 0;
  const reference = path => ({ path });
  const db = { docs, collection(name) { return { doc(id) { return reference(`${name}/${id || `auto-${++generated}`}`); } }; },
    async runTransaction(fn) {
      const writes = [];
      const tx = {
        async get(ref) { return { exists: docs.has(ref.path), data: () => docs.get(ref.path) }; },
        set(ref, value) { writes.push(['set', ref, value]); },
        create(ref, value) { writes.push(['create', ref, value]); },
      };
      const result = await fn(tx);
      for (const [kind, ref, value] of writes) {
        if (kind === 'create' && docs.has(ref.path)) throw new Error('duplicate');
        docs.set(ref.path, value);
      }
      return result;
    } };
  return db;
}

test('admin service enforces signed claim, revision conflicts, immutable history, tombstones, and rollback', async () => {
  const db = memoryDb();
  const context = { db, serverTimestamp: () => 'SERVER_TIME', actor: { uid: 'admin-uid', admin: true } };
  const id = 'osm:node:123';
  const importedBase = { id, position: { lat: 50, lon: 14 }, category: 'museum', originalName: 'Museum', region: 'CZ' };
  await assert.rejects(service.saveOfficialPoi({ ...context, actor: { uid: 'ordinary', admin: false },
    input: { id, expectedRevision: 0, patch: { visibility: 'hidden' } } }), error => error.code === 'permission-denied');
  await assert.rejects(service.saveOfficialPoi({ ...context, input: { id, expectedRevision: 0, admin: true, patch: { visibility: 'hidden' } } }), error => error.code === 'invalid-argument');
  await assert.rejects(service.saveOfficialPoi({ ...context, input: { id, expectedRevision: 0, patch: { visibility: 'hidden' } } }), /base snapshot/);
  const first = await service.saveOfficialPoi({ ...context, input: { id, importedBase, expectedRevision: 0, patch: { visibility: 'hidden' }, privateNote: 'reason' } });
  assert.equal(first.revision, 1);
  assert.equal(first.visibility, 'hidden');
  assert.equal(db.docs.get(`official_poi_changes/${id}`).createdAt, 'SERVER_TIME');
  assert.equal(db.docs.get(`official_poi_revisions/${id}__1`).patch.visibility, 'hidden');
  assert.equal(db.docs.get(`official_poi_changes/${id}`).base.originalName, 'Museum');
  assert.deepEqual(db.docs.get(`official_poi_revisions/${id}__1`).previousValues, { visibility: null });
  await assert.rejects(service.saveOfficialPoi({ ...context, input: { id, importedBase, expectedRevision: 1, patch: { category: 'cafe' } } }), /immutable/);
  await assert.rejects(service.saveOfficialPoi({ ...context, input: { id, expectedRevision: 1, patch: { photoRefs: [{ storagePath: 'official-poi-photos/a.jpg', license: 'CC BY', credit: 'Artist', approval: 'draft' }] }, workflow: 'ready' } }), /photo rights/);
  await assert.rejects(service.saveOfficialPoi({ ...context, input: { id, expectedRevision: 0, patch: { visibility: 'visible' } } }), error => error.code === 'aborted');
  const second = await service.saveOfficialPoi({ ...context, input: { id, expectedRevision: 1, patch: { visibility: 'visible' } } });
  assert.equal(second.visibility, 'visible');
  const third = await service.saveOfficialPoi({ ...context, input: { id, expectedRevision: 2, rollbackRevision: 1 } });
  assert.equal(third.visibility, 'hidden');
  assert.equal(db.docs.get(`official_poi_revisions/${id}__3`).action, 'rollback');
  const fourth = await service.saveOfficialPoi({ ...context, input: { id, expectedRevision: 3, resetToBase: true } });
  assert.equal(fourth.visibility, 'visible');
  assert.deepEqual(db.docs.get(`official_poi_changes/${id}`).patch, {});
  assert.equal(db.docs.get(`official_poi_revisions/${id}__4`).action, 'reset');
  const fifth = await service.saveOfficialPoi({ ...context, input: { id, expectedRevision: 4, patch: { category: 'cafe' } } });
  assert.equal(fifth.revision, 5);
  await service.saveOfficialPoi({ ...context, input: { id, expectedRevision: 5, removeFields: ['category'] } });
  assert.equal(db.docs.get(`official_poi_changes/${id}`).patch.category, undefined);
  await assert.rejects(service.saveOfficialPoi({ ...context, input: { id, expectedRevision: 6, removeFields: ['actorUid'] } }), /Invalid fields/);
  assert.equal([...db.docs.keys()].filter(key => key.startsWith('official_poi_audit/')).length, 6);
});

test('numeric legacy tile features require the verified PBF identity index before first save', async () => {
  const db = memoryDb();
  const context = { db, serverTimestamp: () => 'SERVER_TIME', actor: { uid: 'admin-uid', admin: true } };
  const base = { id: 'osm:node:13794953629', position: { lat: 50.0859408, lon: 14.4629643 },
    category: 'drinking_water', originalName: '', region: 'CZ',
    sourceFields: { tile: { id: 13794953629, cat: 'drinking_water', description: 'Pítko Parukářka sever' } } };
  await assert.rejects(service.saveOfficialPoi({ ...context, input: { id: 'osm:way:13794953629',
    importedBase: { ...base, id: 'osm:way:13794953629' }, expectedRevision: 0, patch: { visibility: 'visible' } } }),
  { code: 'invalid-argument' });
  const created = await service.saveOfficialPoi({ ...context, input: { id: base.id, importedBase: base, expectedRevision: 0,
    patch: { nameOverrides: [{ language: 'cs', text: 'Pítko Parukářka', source: 'human', approval: 'approved' }] } } });
  assert.equal(created.revision, 1);
  assert.equal(db.docs.get(`official_poi_changes/${base.id}`).patch.nameOverrides[0].text, 'Pítko Parukářka');
});
