import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';

const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');

test('community gallery, ownership, ratings, and sticky mobile sheet', { skip: !existsSync(browserPath) }, async () => {
  const server = await createServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': resolve('src') } }, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
    const page = await browser.newPage({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
    await page.route('https://example.test/*.jpg', route => route.fulfill({ contentType: 'image/png', body: png }));
    await page.route('https://example.test/broken.jpg', route => route.abort());
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { LanguageProvider } = await import('/src/lib/LanguageContext.jsx');
      const { default: SpotDetailModal } = await import('/src/components/spots/SpotDetailModal.jsx');
      const mount = document.createElement('div');
      mount.id = 'spot-details-test-root';
      document.body.append(mount);
      const root = (dom.createRoot || dom.default.createRoot)(mount);
      const base = { id: 'long-czech', is_public: true, status: 'published', title: 'Vyhlídka na Podměstský rybník (Čáslav)', spot_type: 'viewpoint', lat: 49.91, lng: 15.39, created_by_uid: 'owner', rating: 0, rating_count: 0, crowdedness_rating: 1, crowdedness_rating_count: 2, description: 'A long community description. '.repeat(30) };
      window.__renderSpot = (urls, user = null) => root.render(React.createElement(LanguageProvider, null,
        React.createElement(SpotDetailModal, { spot: { ...base, image_urls: urls, image_url: urls[0] || null }, user, onClose: () => {}, onNavigate: () => {}, onDelete: () => {}, onEdit: () => {}, onShowAuth: () => {} })));
      window.__renderSpot(['https://example.test/a.jpg', 'https://example.test/a.jpg']);
    });
    await page.waitForFunction(() => Boolean(document.querySelector('#spot-detail-title')));
    assert.equal(await page.locator('[aria-label="Additional distinct photographs"]').count(), 0);
    assert.equal(await page.locator('text=Unrated').count() > 0, true);
    assert.match(await page.evaluate(() => document.querySelector('[aria-labelledby="spot-detail-title"]').textContent), /Very quiet/);
    assert.equal(await page.locator('[aria-label="Edit this spot"]').count(), 0);
    await page.evaluate(() => document.querySelector('[aria-label$="photo full screen"]').click());
    await page.waitForFunction(() => Boolean(document.querySelector('[aria-label$="photo viewer"]')));
    await page.evaluate(() => document.querySelector('[aria-label="Close photo viewer"]').click());
    await page.evaluate(() => window.__renderSpot(['https://example.test/a.jpg', 'https://example.test/b.jpg'], { id: 'owner', uid: 'owner', emailVerified: true, email: 'owner@example.test' }));
    await page.waitForFunction(() => Boolean(document.querySelector('[aria-label="Additional distinct photographs"]')));
    assert.equal(await page.locator('[aria-label="Select photo 2 of 2"]').count(), 1);
    assert.equal(await page.locator('[aria-label="Edit this spot"]').count(), 1);
    assert.equal(await page.locator('[aria-label="Delete this spot"]').count(), 1);
    assert.equal(await page.locator('text=Submit ratings').count(), 0);
    for (const width of [320, 375, 430]) {
      await page.setViewportSize({ width, height: 568 });
      const bounds = await page.evaluate(() => {
        const sheet = document.querySelector('[aria-labelledby="spot-detail-title"] .sf-sheet');
        sheet.scrollTop = sheet.scrollHeight;
        const header = sheet.querySelector('#spot-detail-title').getBoundingClientRect();
        const close = sheet.querySelector('button[aria-label="Close"]').getBoundingClientRect();
        return { titleRight: header.right, closeLeft: close.left, closeRight: close.right, width: innerWidth, sheetRight: sheet.getBoundingClientRect().right, overflow: document.body.style.overflow };
      });
      assert.ok(bounds.titleRight <= bounds.closeLeft + 1, JSON.stringify(bounds));
      assert.ok(bounds.closeRight <= bounds.width + 1 && bounds.sheetRight <= bounds.width + 1, JSON.stringify(bounds));
      assert.equal(bounds.overflow, 'hidden');
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '20px'; document.documentElement.classList.add('dark'); });
    const largeText = await page.evaluate(() => {
      const sheet = document.querySelector('[aria-labelledby="spot-detail-title"] .sf-sheet');
      const header = sheet.querySelector('#spot-detail-title').getBoundingClientRect();
      const close = sheet.querySelector('button[aria-label="Close"]').getBoundingClientRect();
      return { titleRight: header.right, closeLeft: close.left, closeRight: close.right, width: innerWidth, background: getComputedStyle(sheet.querySelector('#spot-detail-title').parentElement.parentElement.parentElement).backgroundColor };
    });
    assert.ok(largeText.titleRight <= largeText.closeLeft + 1 && largeText.closeRight <= largeText.width + 1, JSON.stringify(largeText));
    await page.evaluate(() => document.querySelector('[aria-label="Delete this spot"]').click());
    await page.waitForFunction(() => Boolean(document.querySelector('button') && [...document.querySelectorAll('button')].find(button => button.textContent === 'Delete spot')));
    assert.equal(await page.locator('button').filter({ hasText: 'Delete spot' }).count() > 0, true);
    await page.evaluate(() => window.__renderSpot(['https://example.test/broken.jpg', 'https://example.test/b.jpg']));
    await page.waitForFunction(() => Boolean(document.querySelector('[aria-label$="photo full screen"] img[src="https://example.test/b.jpg"]')));
  } finally {
    await browser?.close();
    await server.close();
  }
});
