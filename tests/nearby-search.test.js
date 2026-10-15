import test from 'node:test';
import assert from 'node:assert/strict';
import { createNearbyRequestGate, nearbyEmptyTitle, nearbyPage } from '../src/lib/nearbySearch.js';

test('pagination displays stable ordered results without duplicating a later page', () => {
  const sorted = Array.from({ length: 47 }, (_, index) => ({ id: String(index), _km: index / 10 }));
  assert.deepEqual(nearbyPage(sorted, 20).displayed.map(row => row.id), sorted.slice(0, 20).map(row => row.id));
  assert.equal(nearbyPage(sorted, 20).remaining, 27);
  assert.deepEqual(nearbyPage(sorted, 40).displayed.map(row => row.id), sorted.slice(0, 40).map(row => row.id));
  assert.equal(nearbyPage(sorted, 60).remaining, 0);
  assert.equal(new Set(nearbyPage(sorted, 60).displayed.map(row => row.id)).size, 47);
});

test('an older asynchronous nearby request cannot replace a newer one', async () => {
  const gate = createNearbyRequestGate();
  const accepted = [];
  let finishOld;
  const oldId = gate.next();
  const oldResult = new Promise(resolve => { finishOld = resolve; }).then(value => {
    if (gate.isCurrent(oldId)) accepted.push(value);
  });
  const newId = gate.next();
  if (gate.isCurrent(newId)) accepted.push('new filters');
  finishOld('old filters');
  await oldResult;
  assert.deepEqual(accepted, ['new filters']);
  gate.cancel();
  assert.equal(gate.isCurrent(newId), false);
});

test('empty-result heading uses the chosen radius and discloses incomplete searches', () => {
  assert.equal(nearbyEmptyTitle(50), 'No spots found within 50 km');
  assert.equal(nearbyEmptyTitle(Infinity), 'No spots found in the searched area');
  assert.equal(nearbyEmptyTitle(50, false), 'No matching spots in the loaded area');
});
