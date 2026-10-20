import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';

const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const archiveUrl = 'https://reelwwsgqv2qknlw.public.blob.vercel-storage.com/spotfinder/ambient-poi.pmtiles';

test('clicking the real imported station reads the public shard and switches names', { skip: !existsSync(browserPath), timeout: 90_000 }, async () => {
  const previousArchive = process.env.VITE_AMBIENT_TILES_URL;
  process.env.VITE_AMBIENT_TILES_URL = archiveUrl;
  const server = await createServer({
    configFile: false,
    plugins: [react()],
    optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client'] },
    resolve: { alias: [
      { find: '@/api/firebaseClient', replacement: resolve('tests/fixtures/translationFirebaseStub.js') },
      { find: '@', replacement: resolve('src') },
    ] },
    server: { host: '127.0.0.1', port: 0 },
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    const forbiddenRequests = [];
    const shardResponses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (/firebase|wikidata|azure/i.test(new URL(request.url()).hostname)) forbiddenRequests.push(request.url());
    });
    page.on('response', response => {
      if (response.url().includes('/poi-details/10/553/346.json')) {
        shardResponses.push({ status: response.status(), mime: response.headers()['content-type'] });
      }
    });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const html = '<html><head><link rel="stylesheet" href="/src/index.css"></head><body style="margin:0"><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;</script></body></html>';
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    await page.evaluate(async () => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { LanguageProvider, useLanguage } = await import('/src/lib/LanguageContext.jsx');
      const MapLibreMap = (await import('/src/components/map/MapLibreMap.jsx')).default;
      const POIDetailPanel = (await import('/src/components/spots/POIDetailPanel.jsx')).default;
      function App() {
        const { setLanguage } = useLanguage();
        const [selection, setSelection] = React.useState(null);
        window.__proofSetLanguage = setLanguage;
        window.__proofSelection = selection;
        return React.createElement('div', null,
          React.createElement('div', { style: { width: '100vw', height: '100vh' } }, React.createElement(MapLibreMap, {
            center: { lat: 50.0835035, lng: 14.4341259 },
            setMapRef: map => { window.__proofMap = map; },
            spots: [], showSpots: false, mapLayer: 'basic', isDark: false, terrainEnabled: false,
            adminPOIs: [], adminClosures: [], adminERouteOverrides: [], adminRoadOverrides: [],
            onSelectPOI: (poi, category) => setSelection({ poi, category }),
          })),
          selection && React.createElement(POIDetailPanel, {
            poi: selection.poi, category: selection.category,
            user: null, onClose: () => setSelection(null), onNavigate: () => {},
          }));
      }
      (dom.createRoot || dom.default.createRoot)(document.body.appendChild(document.createElement('div')))
        .render(React.createElement(LanguageProvider, null, React.createElement(App)));
    });
    await page.waitForFunction(() => Boolean(window.__proofMap && window.__proofSetLanguage));
    await page.evaluate(() => window.__proofMap.jumpTo({ center: [14.4341259, 50.0835035], zoom: 16 }));
    await page.waitForFunction(() => {
      const map = window.__proofMap;
      if (!map?.getLayer('ambient-poi-z13')) return false;
      const point = map.project([14.434125423431396, 50.08350372246943]);
      return map.queryRenderedFeatures([[point.x - 14, point.y - 14], [point.x + 14, point.y + 14]], { layers: ['ambient-poi-z13'] })
        .some(feature => feature.properties?.id === 24569897);
    }, { timeout: 30_000 });
    const point = await page.evaluate(() => {
      const map = window.__proofMap;
      const center = map.project([14.434125423431396, 50.08350372246943]);
      for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) {
        const x = center.x + dx, y = center.y + dy;
        const hits = map.queryRenderedFeatures([[x - 14, y - 14], [x + 14, y + 14]], { layers: ['ambient-poi-z13'] });
        if (hits[0]?.properties?.id === 24569897) return { x, y };
      }
      return null;
    });
    assert.ok(point, 'target station must be the first feature at a click point');
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => window.__proofSelection?.poi?.enrichment?.id === '24569897');
    await page.evaluate(() => window.__proofSetLanguage('cs'));
    await page.locator('.sf-sheet > button:first-child').click();
    await page.waitForFunction(() => document.querySelector('[role="dialog"] h1')?.textContent === 'Hlavní nádraží');
    await page.evaluate(() => window.__proofSetLanguage('en'));
    await page.waitForFunction(() => document.querySelector('[role="dialog"] h1')?.textContent === 'Main Station');
    await page.evaluate(() => window.__proofSetLanguage('de'));
    await page.waitForFunction(() => document.querySelector('[role="dialog"] h1')?.textContent === 'Hauptbahnhof');
    await page.evaluate(() => window.__proofSetLanguage('en'));
    await page.locator('[role="dialog"] button.absolute.top-4.right-4').click();
    await page.waitForFunction(() => !window.__proofSelection);
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => window.__proofSelection?.poi?.enrichment?.id === '24569897');
    await page.locator('.sf-sheet > button:first-child').click();
    await page.waitForFunction(() => document.querySelector('[role="dialog"] h1')?.textContent === 'Main Station');
    assert.equal(shardResponses.length, 1);
    assert.deepEqual(shardResponses[0], { status: 200, mime: 'application/json' });
    assert.deepEqual(forbiddenRequests, []);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
    if (previousArchive === undefined) delete process.env.VITE_AMBIENT_TILES_URL;
    else process.env.VITE_AMBIENT_TILES_URL = previousArchive;
  }
});
