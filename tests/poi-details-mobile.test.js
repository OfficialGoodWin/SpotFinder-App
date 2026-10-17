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
