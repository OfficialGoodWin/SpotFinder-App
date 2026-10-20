import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupePlaceResults } from '../src/lib/placeSearchDedupe.js';

const result = (id, name, lat, lon) => ({ id, name, position: { lat, lon } });

test('German provider prefix and local station name at the same place yield one result', () => {
  const mapy = result('mapy:1', 'Praha hlavní nádraží', 50.0835035, 14.4341259);
  const osm = result('osm:node:24569897', 'Bahnhof Praha hlavní nádraží', 50.083505, 14.434127);
  assert.deepEqual(dedupePlaceResults([mapy, osm]), [mapy]);
});

test('nearby distinct POIs and unrelated provider names remain separate', () => {
  const station = result('mapy:1', 'Praha hlavní nádraží', 50.0835035, 14.4341259);
  const shop = result('osm:node:2', 'Praha hlavní nádraží shop', 50.08351, 14.43413);
  const otherStation = result('osm:node:3', 'Praha hlavní nádraží', 50.084, 14.4341259);
  assert.deepEqual(dedupePlaceResults([station, shop, otherStation]), [station, shop, otherStation]);
});

test('invalid coordinates and exact duplicate provider IDs are removed', () => {
  const station = result('mapy:1', 'Station', 50.0835, 14.4341);
  assert.deepEqual(dedupePlaceResults([station, { ...station }, result('bad', 'Bad', 'x', 14)]), [station]);
});
