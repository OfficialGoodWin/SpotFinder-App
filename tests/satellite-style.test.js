import test from 'node:test';
import assert from 'node:assert/strict';
import { getBaseStyle, satelliteStyle, lightStyle, darkStyle, outdoorStyle } from '../src/lib/mapStyle.js';

test('aerial selects an opaque raster basemap with no Basic vector source or symbols', () => {
  for (const isDark of [false, true]) {
    const selected = getBaseStyle(isDark, 'aerial');
    assert.equal(selected, satelliteStyle);
    assert.deepEqual(Object.keys(selected.sources), ['aerial']);
    assert.deepEqual(selected.layers.map(layer => layer.id), ['satellite-background', 'aerial']);
    assert.equal(selected.layers[1].paint['raster-opacity'], 1);
    assert.match(selected.sources.aerial.attribution, /Esri/);
  }
});

test('Basic → Satellite → Outdoor → Satellite restores the selected basemap without accumulating layers', () => {
  const sequence = ['basic', 'aerial', 'outdoor', 'aerial', 'basic'];
  const styles = sequence.map(layer => getBaseStyle(false, layer));
  assert.equal(styles[0], lightStyle);
  assert.equal(styles[1], satelliteStyle);
  assert.equal(styles[2], outdoorStyle);
  assert.equal(styles[3], satelliteStyle);
  assert.equal(styles[4], lightStyle);
  assert.equal(getBaseStyle(true, 'basic'), darkStyle);
  for (const selected of styles) {
    const ids = selected.layers.map(layer => layer.id);
    assert.equal(new Set(ids).size, ids.length);
  }
});
