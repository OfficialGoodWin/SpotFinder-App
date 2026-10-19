import test from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

test('lazy-loaded POI panel is linted and undefined JSX icons fail lint', async () => {
  const eslint = new ESLint();
  const config = await eslint.calculateConfigForFile('src/components/spots/POIDetailPanel.jsx');
  assert.equal(config.rules['no-undef'][0], 2);
  assert.equal(config.rules['react/jsx-no-undef'][0], 2);
  const helperConfig = await eslint.calculateConfigForFile('src/lib/poiDetailShard.js');
  assert.equal(helperConfig.rules['no-undef'][0], 2);
  const [fixture] = await eslint.lintText('export default function Fixture() { return <MissingIcon />; }',
    { filePath: 'src/components/spots/UndefinedIconFixture.jsx' });
  assert.ok(fixture.messages.some(message => message.ruleId === 'react/jsx-no-undef'));
  const [panel] = await eslint.lintFiles(['src/components/spots/POIDetailPanel.jsx']);
  assert.equal(panel.errorCount, 0);
});
