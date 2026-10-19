import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';

const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

test('visible imported POI text switches locale without losing the open panel', { skip: !existsSync(browserPath) }, async () => {
  const server = await createServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': resolve('src') } }, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    const translationRequests = [];
    let missingRequests = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/wikidata\.org|translator\.azure/i.test(request.url())) translationRequests.push(request.url()); });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const html = '<html><head><link rel="stylesheet" href="/src/index.css"></head><body><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;</script></body></html>';
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.route('**/poi-details/10/553/346.json', route => { missingRequests++; return route.fulfill({ status: 404, body: '' }); });
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    await page.evaluate(async () => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { LanguageProvider, useLanguage } = await import('/src/lib/LanguageContext.jsx');
      const { default: Panel } = await import('/src/components/spots/POIDetailPanel.jsx');
      const mount = document.createElement('div');
      mount.id = 'localized-poi-root';
      document.body.append(mount);
      const root = (dom.createRoot || dom.default.createRoot)(mount);
      function Control() { window.__setPoiLanguage = useLanguage().setLanguage; return null; }
      const properties = { id: 'node/10', name: 'Pražský hrad', 'name:cs': 'Pražský hrad', 'name:en': 'Prague Castle', 'name:de': 'Prager Burg',
        'description:de': 'Burganlage in Prag', wikidata: 'Q193369' };
      const staticDetail = { id: 'node/10', description: 'Historický hrad v Praze.',
        localizedNames: [{ language: 'en', text: 'Approved Castle', source: 'human', approval: 'approved' }],
        localizedDescriptions: [{ language: 'en', text: 'Approved English description.', source: 'human', approval: 'approved' }],
        wikidata: { id: 'Q193369', linkMethod: 'osm_tag', labels: { fr: 'Château de Prague' }, summaries: { fr: 'Château en Tchéquie' } } };
      window.__renderLocalizedPoi = (variant = 'linked') => {
        const tile = variant === 'untranslated' ? { id: 'node/11', name: 'Místní název' } : variant === 'withoutWikidata' ? { ...properties, wikidata: null } : properties;
        const detail = variant === 'missing' || variant === 'untranslated' ? null : variant === 'withoutOverride'
          ? { ...staticDetail, localizedNames: [] } : staticDetail;
        const poi = { id: variant, name: tile.name, lat: 50.1, lon: 14.6,
          tags: { description: variant === 'untranslated' ? 'Původní popis.' : staticDetail.description, wikidata: tile.wikidata },
          enrichment: detail, _ambientHit: { properties: tile, details: detail } };
        root.render(React.createElement(LanguageProvider, null, React.createElement(React.Fragment, null,
          React.createElement(Control), React.createElement(Panel, { poi, category: { key: 'heritage', color: '#357a62', name: 'Heritage' },
            onClose: () => root.render(null), onNavigate: () => {}, user: null }))));
      };
      window.__readMissingTwice = async () => {
        const { readPoiDetailShard } = await import('/src/lib/poiDetailShard.js');
        return [await readPoiDetailShard(14.6, 50.1), await readPoiDetailShard(14.6, 50.1)];
      };
      window.__renderLocalizedPoi();
    });
    const heading = async expected => page.waitForFunction(value => document.querySelector('#localized-poi-root [role="dialog"] h1')?.textContent === value, expected);
    const expand = async () => {
      await page.waitForFunction(() => Boolean(document.querySelector('#localized-poi-root .sf-sheet > button:first-child')));
      await page.evaluate(() => document.querySelector('#localized-poi-root .sf-sheet > button:first-child').click());
    };
    await page.waitForFunction(() => Boolean(window.__setPoiLanguage));
    await page.evaluate(() => window.__setPoiLanguage('cs'));
    await expand();
    await heading('Pražský hrad');
    assert.match(await page.locator('#localized-poi-root').textContent(), /Historický hrad v Praze/);
    await page.evaluate(() => window.__setPoiLanguage('en'));
    await heading('Approved Castle');
    assert.match(await page.locator('#localized-poi-root').textContent(), /Approved English description/);
    await page.evaluate(() => window.__setPoiLanguage('de'));
    await heading('Prager Burg');
    assert.match(await page.locator('#localized-poi-root').textContent(), /Burganlage in Prag/);
    await page.evaluate(() => window.__setPoiLanguage('fr'));
    await heading('Château de Prague');
    assert.match(await page.locator('#localized-poi-root').textContent(), /Château en Tchéquie/);
    await page.evaluate(() => document.querySelector('#localized-poi-root [role="dialog"] button[aria-label]').click());
    await page.waitForFunction(() => !document.querySelector('#localized-poi-root [role="dialog"]'));
    await page.evaluate(() => window.__renderLocalizedPoi());
    await expand();
    await heading('Château de Prague');
    await page.evaluate(() => window.__renderLocalizedPoi('withoutOverride'));
    await expand();
    await page.evaluate(() => window.__setPoiLanguage('en'));
    await heading('Prague Castle');
    await page.evaluate(() => window.__renderLocalizedPoi('withoutWikidata'));
    await expand();
    await page.evaluate(() => window.__setPoiLanguage('fr'));
    await heading('Pražský hrad');
    await page.evaluate(() => window.__renderLocalizedPoi('untranslated'));
    await expand();
    await heading('Místní název');
    assert.match(await page.locator('#localized-poi-root').textContent(), /Původní popis/);
    assert.deepEqual(await page.evaluate(() => window.__readMissingTwice()), [null, null]);
    assert.equal(missingRequests, 1);
    await page.evaluate(() => window.__renderLocalizedPoi('missing'));
    await expand();
    await page.evaluate(() => window.__setPoiLanguage('de'));
    await heading('Prager Burg');
    assert.deepEqual(translationRequests, []);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
