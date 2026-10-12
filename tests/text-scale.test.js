import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTextScale, getTextScale, normalizeTextScale, saveTextScale, TEXT_SCALE_KEY } from '../src/lib/textScale.js';

const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
};

test('text scale clamps, rounds, persists, and restores from 75 to 250 percent', () => {
  assert.equal(normalizeTextScale(73), 75);
  assert.equal(normalizeTextScale(253), 250);
  assert.equal(normalizeTextScale(113), 115);
  const storage = memoryStorage();
  const root = { dataset: {}, style: { setProperty(key, value) { this[key] = value; } } };
  assert.equal(getTextScale(storage), 100);
  assert.equal(saveTextScale(175, storage), 175);
  assert.equal(storage.getItem(TEXT_SCALE_KEY), '175');
  assert.equal(getTextScale(storage), 175);
  assert.equal(applyTextScale(250, root), 250);
  assert.equal(root.style['font-size'], '250%');
  assert.equal(root.dataset.sfTextScale, 'large');
});
