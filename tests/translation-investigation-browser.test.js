import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';

const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

test('existing visible UI and imported POI text respond to language selection', { skip: !existsSync(browserPath) }, async () => {
  const server = await createServer({ configFile: false, plugins: [react()], optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client'] }, resolve: { alias: [
    { find: '@/api/firebaseClient', replacement: resolve('tests/fixtures/translationFirebaseStub.js') },
    { find: '@/lib/AuthContext', replacement: resolve('tests/fixtures/translationAuthStub.js') },
    { find: '@', replacement: resolve('src') },
  ] }, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    const externalRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/firebase|wikidata|azure/i.test(new URL(request.url()).hostname)) externalRequests.push(request.url()); });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const html = '<html><head><link rel="stylesheet" href="/src/index.css"></head><body><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;</script></body></html>';
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    await page.evaluate(async () => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { LanguageProvider, useLanguage } = await import('/src/lib/LanguageContext.jsx');
      const { ThemeProvider } = await import('/src/lib/ThemeContext.jsx');
      const modules = await Promise.all([
        import('/src/components/SettingsModal.jsx'), import('/src/components/spots/NearbySpotsPanel.jsx'),
        import('/src/components/map/MapLayerSwitcher.jsx'), import('/src/components/spots/POIDetailPanel.jsx'),
        import('/src/components/auth/AuthModal.jsx'), import('/src/components/spots/MySpotsPanel.jsx'),
      ]);
      const [Settings, Nearby, MapControls, PoiDetail, Auth, Collection] = modules.map(item => item.default);
      const root = (dom.createRoot || dom.default.createRoot)(document.body.appendChild(document.createElement('div')));
      const tile = { id: 'node/10', canonical_id: 'osm:node:10', name: 'Pražský hrad', 'name:cs': 'Pražský hrad', 'name:en': 'Prague Castle', 'name:de': 'Prager Burg', wikidata: 'Q193369' };
      const detail = { id: 'node/10', description: 'Historický hrad v Praze.', localizedDescriptions: [
        { language: 'en', text: 'Approved English description.', source: 'human', approval: 'approved' },
        { language: 'de', text: 'Genehmigte deutsche Beschreibung.', source: 'human', approval: 'approved' },
      ] };
      const poi = { id: 'osm:node:10', name: tile.name, lat: 50.1, lon: 14.6,
        tags: { description: detail.description, wikidata: tile.wikidata }, enrichment: detail, _ambientHit: { properties: tile, details: detail } };
      function Controller() {
        const { setLanguage } = useLanguage();
        const [view, setView] = React.useState('settings');
        window.__setInvestigationLanguage = setLanguage;
        window.__showInvestigationView = setView;
        const noOp = () => {};
        const props = {
          settings: [Settings, { onClose: noOp }],
          nearby: [Nearby, { spots: [], origin: [50.1, 14.6], originMode: 'map', filters: { maxDistance: 5, minRating: 0 }, onClose: noOp }],
          map: [MapControls, { activeLayer: 'basic', onLayerChange: noOp }],
          poi: [PoiDetail, { poi, category: { key: 'heritage', color: '#357a62', name: 'Heritage' }, onClose: noOp, onNavigate: noOp, user: null }],
          auth: [Auth, { onClose: noOp }],
          collection: [Collection, { user: { id: 'test-user', email: 'test@example.org' }, draftOwnerKey: 'test', onClose: noOp }],
        };
        const [Component, componentProps] = props[view];
        return React.createElement('div', { id: 'investigation-view' }, React.createElement(Component, componentProps));
      }
      root.render(React.createElement(ThemeProvider, null, React.createElement(LanguageProvider, null, React.createElement(Controller))));
    });
    const show = async (view, selector, en, cs) => {
      await page.evaluate(value => { window.__setInvestigationLanguage('en'); window.__showInvestigationView(value); }, view);
      await page.waitForFunction(([css, expected]) => document.querySelector(css)?.textContent === expected, [selector, en]);
      await page.evaluate(() => window.__setInvestigationLanguage('cs'));
      await page.waitForFunction(([css, expected]) => document.querySelector(css)?.textContent === expected, [selector, cs]);
    };
    await page.waitForFunction(() => Boolean(window.__showInvestigationView));
    await show('settings', '#settings-title', 'Settings', 'Nastavení');
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'cs');
    assert.match(await page.evaluate(() => document.cookie), /spotfinder_language=cs/);
    await show('nearby', '#investigation-view h2', 'Nearby spots', 'Místa v okolí');
    await page.evaluate(() => { window.__setInvestigationLanguage('en'); window.__showInvestigationView('map'); });
    await page.waitForFunction(() => Boolean(document.querySelector('#investigation-view button[aria-label="Map layers"]')));
    await page.evaluate(() => document.querySelector('#investigation-view button').click());
    await page.evaluate(() => window.__setInvestigationLanguage('cs'));
    await page.waitForFunction(() => Boolean(document.querySelector('#investigation-view button[aria-label="Vrstvy mapy"]')));
    await show('auth', '#auth-modal-title', 'Welcome Back!', 'Vítejte zpět!');
    await show('collection', '#my-spots-title', 'My collection', 'Moje sbírka');
    await page.evaluate(() => { window.__setInvestigationLanguage('de'); window.__showInvestigationView('nearby'); });
    await page.waitForFunction(() => document.querySelector('#investigation-view h2')?.textContent === 'Nearby spots');
    await page.evaluate(() => { window.__setInvestigationLanguage('en'); window.__showInvestigationView('poi'); });
    await page.waitForFunction(() => Boolean(document.querySelector('#investigation-view .sf-sheet > button:first-child')));
    await page.evaluate(() => document.querySelector('#investigation-view .sf-sheet > button:first-child').click());
    await page.waitForFunction(() => document.querySelector('#investigation-view [role="dialog"] h1')?.textContent === 'Prague Castle');
    assert.match(await page.locator('#investigation-view').textContent(), /Approved English description/);
    await page.evaluate(() => window.__setInvestigationLanguage('de'));
    await page.waitForFunction(() => document.querySelector('#investigation-view [role="dialog"] h1')?.textContent === 'Prager Burg');
    assert.match(await page.locator('#investigation-view').textContent(), /Genehmigte deutsche Beschreibung/);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
