import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');

test('Discover cards show mixed rating states, photographs, navigation, and save actions', { skip: !existsSync(browserPath) }, async () => {
  const blankPage = { name: 'discover-test-page', configureServer(devServer) {
    devServer.middlewares.use('/discover-test.html', (_request, response) => {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<!doctype html><html><body></body></html>');
    });
  } };
  const server = await createServer({ configFile: false, plugins: [blankPage], esbuild: { jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' }, optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client'] }, resolve: { alias: { '@': resolve('src') } }, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://example.test/spot.jpg', route => route.fulfill({ contentType: 'image/png', body: png }));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/discover-test.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { default: DiscoverCard } = await import('/src/mobile-v2/DiscoverCard.jsx');
      const base = { is_public: true, status: 'published', lat: 50, lng: 14, spot_type: 'castle' };
      const spots = [
        { ...base, id: 'legacy', title: 'Legacy rated', rating: 4.3, rating_count: 5, image_url: 'https://example.test/spot.jpg' },
        { ...base, id: 'current', title: 'Current rated', rating_schema: 2, rating: 3.7, rating_count: 2 },
        { ...base, id: 'unrated', title: 'New unrated', status: 'pending_trust', rating_schema: 2, rating: 0, rating_count: 0 },
        { ...base, id: 'missing', title: 'No rating properties' },
      ];
      window.__discoverActions = [];
      const mount = document.createElement('div');
      mount.id = 'discover-test-root';
      document.body.append(mount);
      (dom.createRoot || dom.default.createRoot)(mount).render(React.createElement('div', null,
        spots.map(spot => React.createElement(DiscoverCard, { key: spot.id, spot, title: spot.title, location: 'Praha', savingSpotId: '', savedIds: new Set(),
          onOpen: row => window.__discoverActions.push(['open', row.id]),
          onSave: row => window.__discoverActions.push(['save', row.id]),
          onMap: row => window.__discoverActions.push(['map', row.id]),
        }))));
    });
    await page.waitForFunction(() => document.querySelectorAll('.v2-discover-card').length === 4);
    assert.match(await page.locator('#discover-test-root').innerText(), /★ 4\.3 \(5\)/);
    assert.match(await page.locator('#discover-test-root').innerText(), /★ 3\.7 \(2\)/);
    assert.equal(await page.getByText('Zatím bez hodnocení').count(), 2);
    assert.equal(await page.locator('.v2-discover-card img').count(), 1);
    assert.equal(await page.locator('.v2-discover-card .v2-photo-fallback').count(), 3);
    await page.evaluate(() => {
      const actions = document.querySelectorAll('.v2-discover-card')[2].querySelectorAll('.v2-discover-actions button');
      actions[1].click();
      actions[0].click();
    });
    assert.deepEqual(await page.evaluate(() => window.__discoverActions), [['open', 'unrated'], ['save', 'unrated']]);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
