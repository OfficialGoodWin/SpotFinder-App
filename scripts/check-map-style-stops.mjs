import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { getBaseStyle } from '../src/lib/mapStyle.js';
import { transformSync } from 'esbuild';

const mapSource = readFileSync('src/components/map/MapLibreMap.jsx', 'utf8');
const start = mapSource.indexOf('function getMapStyle(');
const end = mapSource.indexOf('function applyTerrain(', start);
if (start < 0 || end < 0) throw new Error('Could not locate the runtime style builder');
const builder = mapSource.slice(start, end);
const getMapStyle = runInNewContext(`${builder}\ngetMapStyle`, { getBaseStyle });

const failures = [];
function visit(value, path) {
  if (!Array.isArray(value)) {
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
    return;
  }
  if ((value[0] === 'interpolate' || value[0] === 'step') && Array.isArray(value[2]) && value[2][0] === 'zoom') {
    const first = value[0] === 'step' ? 4 : 3;
    let previous = -Infinity;
    for (let i = first; i < value.length; i += 2) {
      const stop = value[i];
      if (typeof stop !== 'number' || stop <= previous) failures.push(`${path}: ${JSON.stringify(value)}`);
      previous = stop;
    }
  }
  value.forEach((child, index) => visit(child, `${path}[${index}]`));
}

for (const [theme, layer] of [['light', 'basic'], ['dark', 'basic'], ['light', 'outdoor'], ['light', 'winter'], ['light', 'aerial'], ['light', 'traffic']]) {
  const style = getMapStyle(theme === 'dark', layer);
  style.layers.forEach((entry, index) => visit(entry, `${theme}/${layer}:layers[${index}](${entry.id})`));
  if (layer === 'outdoor' || layer === 'winter') {
    const target = style.layers[13];
    if (target?.id !== 'rc-street') failures.push(`${layer}: layer 13 changed to ${target?.id}`);
    console.log(`${layer} layer 13: ${target?.id} ${JSON.stringify(target?.paint?.['line-width'])}`);
  }
}
transformSync(readFileSync('src/mobile-v2/MobileV2.jsx', 'utf8'), { loader: 'jsx' });
if (failures.length) throw new Error(failures.join('\n'));
console.log('All constructed style zoom stops ascend; navigation JSX parses.');
