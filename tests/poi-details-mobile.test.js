import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';

const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');

test('ambient POI keeps factual hours, safe contact link, and Wikimedia credit on mobile', { skip: !existsSync(browserPath) }, async () => {
  const server = await createServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': resolve('src') } }, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
    const page = await browser.newPage({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
    await page.route('https://example.test/photo.jpg', route => route.fulfill({ contentType: 'image/png', body: png }));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { LanguageProvider } = await import('/src/lib/LanguageContext.jsx');
      const { default: Panel } = await import('/src/components/spots/POIDetailPanel.jsx');
      const mount = document.createElement('div');
      mount.id = 'poi-details-test-root';
      document.body.append(mount);
      const root = (dom.createRoot || dom.default.createRoot)(mount);
      window.__renderPoi = (hours, website = 'galerieleica.cz') => root.render(React.createElement(LanguageProvider, null,
        React.createElement(Panel, { poi: { id: String(hours), name: 'Galerie Leica', lat: 50.08, lon: 14.42, tags: { opening_hours: hours, website }, enrichment: { photos: [{ url: 'https://example.test/photo.jpg', credit: 'Photo: Author (CC BY-SA)', source: 'https://commons.wikimedia.org/wiki/File:Photo.jpg', license_url: 'https://creativecommons.org/licenses/by-sa/4.0/' }] } }, category: { key: 'art', color: '#357a62', name: 'Gallery' }, onClose: () => {}, onNavigate: () => {}, user: null })));
      window.__renderPoi('Mo-Fr 09:00-18:00; PH off');
    });
    await page.waitForFunction(() => Boolean(document.querySelector('#poi-details-test-root [aria-label="Expand details"]')));
    await page.evaluate(() => document.querySelector('#poi-details-test-root [aria-label="Expand details"]').click());
    await page.waitForFunction(() => Boolean(document.querySelector('#poi-details-test-root [role="dialog"]')));
    const text = await page.evaluate(() => document.querySelector('#poi-details-test-root [role="dialog"]').textContent);
    assert.match(text, /Hours: Mo-Fr 09:00-18:00; PH off/);
    assert.doesNotMatch(text, /Open now|Closed now/);
    assert.match(text, /Photo: Author \(CC BY-SA\)/);
    assert.equal(await page.locator('#poi-details-test-root a[href="https://galerieleica.cz/"]').count(), 1);
    assert.equal(await page.locator('#poi-details-test-root a[href="https://commons.wikimedia.org/wiki/File:Photo.jpg"]').count(), 1);
    assert.equal(await page.locator('#poi-details-test-root [aria-label^="View photo"]').count(), 0);
    await page.evaluate(() => window.__renderPoi(null, 'javascript:alert(1)'));
    await page.waitForFunction(() => Boolean(document.querySelector('#poi-details-test-root [aria-label="Expand details"]')));
    await page.evaluate(() => document.querySelector('#poi-details-test-root [aria-label="Expand details"]').click());
    await page.waitForFunction(() => Boolean(document.querySelector('#poi-details-test-root [role="dialog"]')));
    const noHours = await page.evaluate(() => document.querySelector('#poi-details-test-root [role="dialog"]').textContent);
    assert.doesNotMatch(noHours, /Hours:|Open now|Closed now/);
    assert.equal(await page.locator('#poi-details-test-root a[href*="javascript"]').count(), 0);
  } finally {
    await browser?.close();
    await server.close();
  }
});

test('desktop POI switches, closes and reopens with optional detail data', { skip: !existsSync(browserPath) }, async () => {
  const server = await createServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': resolve('src') } }, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://example.test/photo.jpg', route => route.fulfill({ contentType: 'image/png', body: png }));
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const html = '<html><head><link rel="stylesheet" href="/src/index.css"></head><body><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;</script></body></html>';
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    await page.evaluate(async () => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { LanguageProvider } = await import('/src/lib/LanguageContext.jsx');
      const { default: Panel } = await import('/src/components/spots/POIDetailPanel.jsx');
      const mount = document.createElement('div');
      mount.id = 'poi-details-desktop-root';
      document.body.append(mount);
      const root = (dom.createRoot || dom.default.createRoot)(mount);
      window.__navigationCount = 0;
      window.__renderDesktopPoi = (id, hours, enrichment = null) => root.render(React.createElement(LanguageProvider, null,
        React.createElement(Panel, { poi: { id, name: `Place ${id}`, lat: 50.08, lon: 14.42, tags: { opening_hours: hours, website: 'example.org' }, enrichment },
          category: { key: 'art', color: '#357a62', name: 'Gallery' }, onClose: () => root.render(null),
          onNavigate: () => { window.__navigationCount++; }, user: null })));
      window.__renderDesktopPoi('missing', null);
    });
    const root = page.locator('#poi-details-desktop-root');
    await page.waitForFunction(() => Boolean(document.querySelector('#poi-details-desktop-root [aria-label="Expand details"]')));
    await page.evaluate(() => document.querySelector('#poi-details-desktop-root [aria-label="Expand details"]').click());
    await page.waitForFunction(() => Boolean(document.querySelector('#poi-details-desktop-root [role="dialog"]')));
    assert.match(await root.textContent(), /Place missing/);
    assert.doesNotMatch(await root.textContent(), /Hours:/);
    await page.evaluate(() => window.__renderDesktopPoi('valid', 'Mo-Fr 09:00-18:00', { photos: [{ url: 'https://example.test/photo.jpg', credit: 'Existing photo credit' }] }));
    await page.waitForFunction(() => Boolean(document.querySelector('#poi-details-desktop-root [aria-label="Expand details"]')));
    await page.evaluate(() => document.querySelector('#poi-details-desktop-root [aria-label="Expand details"]').click());
    await page.waitForFunction(() => Boolean(document.querySelector('#poi-details-desktop-root [role="dialog"]')));
    assert.match(await root.textContent(), /Place valid/);
    assert.match(await root.textContent(), /Hours: Mo-Fr 09:00-18:00/);
    assert.match(await root.textContent(), /Existing photo credit/);
    assert.match(await root.textContent(), /No ratings yet/);
    assert.match(await root.textContent(), /Share/);
    await page.evaluate(() => document.querySelector('#poi-details-desktop-root [role="dialog"] button[aria-label]').click());
    await page.waitForFunction(() => !document.querySelector('#poi-details-desktop-root [role="dialog"]'));
    await page.evaluate(() => window.__renderDesktopPoi('reopened', null));
    await page.waitForFunction(() => Boolean(document.querySelector('#poi-details-desktop-root [aria-label="Expand details"]')));
    await page.evaluate(() => document.querySelector('#poi-details-desktop-root [aria-label="Expand details"]').click());
    await page.waitForFunction(() => Boolean(document.querySelector('#poi-details-desktop-root [role="dialog"]')));
    assert.match(await root.textContent(), /Place reopened/);
    const box = await page.evaluate(() => { const rect = document.querySelector('#poi-details-desktop-root [role="dialog"]').getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; });
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 1280 && box.y + box.height <= 800, JSON.stringify(box));
    await page.evaluate(() => [...document.querySelectorAll('#poi-details-desktop-root button')].find(button => button.textContent.includes('Navigate')).click());
    assert.equal(await page.evaluate(() => window.__navigationCount), 1);
    await page.waitForFunction(() => !document.querySelector('#poi-details-desktop-root [role="dialog"]'));
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
