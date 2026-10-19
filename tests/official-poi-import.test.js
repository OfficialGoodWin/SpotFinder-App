import test from 'node:test';
import assert from 'node:assert/strict';
import { readImportedPoi, validEditorPosition } from '../src/lib/officialPoiImport.js';

test('typed osmium identities are preserved, including way and relation', () => {
  for (const type of ['node', 'way', 'relation']) {
    const result = readImportedPoi({ properties: { id: `${type}/123`, name: 'Museum', cat: 'museum', wikidata: 'Q42', 'name:cs': 'Muzeum' }, position: { lat: 50, lon: 14 }, details: { wikipedia: 'en:Museum' } });
    assert.equal(result.canonicalId, `osm:${type}:123`);
    assert.equal(result.wikidata, 'Q42');
    assert.equal(result.localizedNames.cs, 'Muzeum');
    assert.equal(result.raw.detail.wikipedia, 'en:Museum');
  }
});

test('bare, coordinate and tile IDs stay unresolved', () => {
  for (const id of ['123', '50-14', 'feature/123', 'node/0']) assert.equal(readImportedPoi({ properties: { id } }).canonicalId, null);
  assert.equal(readImportedPoi({ properties: { id: 'node/123', canonical_id: 'osm:way:123' } }).canonicalId, null);
  assert.equal(readImportedPoi({ properties: { id: '123', canonical_id: 'osm:node:123', osm_type: 'node', osm_id: '123' } }).canonicalId, 'osm:node:123');
});

test('position validation rejects empty, non-finite and out-of-range coordinates', () => {
  assert.equal(validEditorPosition('50.1', '14.4'), true);
  for (const point of [['', '14'], ['91', '14'], ['50', '-181'], ['NaN', '14']]) assert.equal(validEditorPosition(...point), false);
});
