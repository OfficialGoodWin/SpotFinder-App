import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';

const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');

test('featured images wait, load, retry, and fit mobile cards', { skip: !existsSync(browserPath) }, async () => {
  const server = await createServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': resolve('src') } }, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
    const page = await browser.newPage({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
    await page.route('https://example.test/slow.jpg', async route => {
      await new Promise(done => setTimeout(done, 350));
      await route.fulfill({ contentType: 'image/png', body: png });
    });
    await page.route('https://example.test/broken.jpg', route => route.abort());
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const reactModule = await import('/node_modules/.vite/deps/react.js');
      const React = reactModule.default;
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const createRoot = dom.createRoot || dom.default.createRoot;
      const { default: Panel } = await import('/src/components/FeaturedDiscoveryPanel.jsx');
      const { LanguageProvider } = await import('/src/lib/LanguageContext.jsx');
      const base = { is_public: true, status: 'published', lat: 50, lng: 14, spot_type: 'castle' };
      const mount = document.createElement('div');
      mount.id = 'featured-test-root';
      mount.style.position = 'fixed';
      mount.style.inset = '0';
      mount.style.zIndex = '9999';
      document.body.append(mount);
      createRoot(mount).render(React.createElement(LanguageProvider, null, React.createElement(Panel, {
        spots: [
          { ...base, id: 'slow', title: 'Slow photo', image_url: 'https://example.test/slow.jpg' },
          { ...base, id: 'retry', title: 'Retry photo', image_urls: ['https://example.test/broken.jpg', 'https://example.test/slow.jpg'] },
          { ...base, id: 'missing', title: 'No photo' },
        ], language: 'en', loading: false, error: false, emptyView: false,
        onSelectSpot: () => {}, onSearch: () => {}, onDismiss: () => mount.remove(),
      })));
    });
    await page.waitForFunction(() => Boolean(document.querySelector('[aria-label="Discover community places"]')));
    assert.equal(await page.locator('[aria-label="Discover community places"] [aria-label*="photo unavailable"]').count(), 1);
    await page.waitForFunction(() => [...document.querySelectorAll('#featured-test-root img')].length === 2 && [...document.querySelectorAll('#featured-test-root img')].every(img => img.complete && img.naturalWidth > 0));
    for (const width of [320, 375, 430]) {
      await page.setViewportSize({ width, height: 568 });
      const result = await page.evaluate(() => {
        const panel = document.querySelector('[aria-label="Discover community places"]');
        const row = panel.querySelector('[aria-label="Featured places"]');
        const close = panel.querySelector('[aria-label="Close featured places"]');
        const image = panel.querySelector('img');
        return { right: panel.getBoundingClientRect().right, width: innerWidth, scrollable: row.scrollWidth > row.clientWidth, closeVisible: close.getBoundingClientRect().right <= innerWidth, objectFit: getComputedStyle(image).objectFit };
      });
      assert.ok(result.right <= result.width + 1, JSON.stringify(result));
      assert.equal(result.scrollable, true);
      assert.equal(result.closeVisible, true);
      assert.equal(result.objectFit, 'cover');
    }
    await page.evaluate(() => document.querySelector('[aria-label="Close featured places"]').click());
    assert.equal(await page.locator('[aria-label="Discover community places"]').count(), 0);
    await page.evaluate(async () => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { default: ProfileMenu } = await import('/src/components/ProfileMenu.jsx');
      const { LanguageProvider } = await import('/src/lib/LanguageContext.jsx');
      const mount = document.createElement('div');
      mount.id = 'profile-test-root';
      mount.style.position = 'fixed';
      mount.style.inset = '0';
      mount.style.zIndex = '9999';
      document.body.append(mount);
      window.__nearbyOpened = 0;
      const TestMenu = () => {
        const [open, setOpen] = React.useState(false);
        return React.createElement(ProfileMenu, {
          user: { email: 'test@example.test', displayName: 'Test' }, isAuthenticated: true,
          showMenu: open, onToggleMenu: () => setOpen(value => !value),
          onShowNearby: () => { window.__nearbyOpened += 1; },
        });
      };
      (dom.createRoot || dom.default.createRoot)(mount).render(React.createElement(LanguageProvider, null, React.createElement(TestMenu)));
    });
    await page.waitForFunction(() => Boolean(document.querySelector('#profile-test-root button')));
    assert.equal(await page.locator('#profile-test-root button[title="Nearby spots"]').count(), 0);
    await page.evaluate(() => document.querySelector('#profile-test-root button').click());
    await page.waitForFunction(() => Boolean(document.querySelector('#profile-test-root [role="menuitem"]')));
    assert.equal(await page.locator('#profile-test-root [role="menuitem"]').filter({ hasText: 'Nearby spots' }).count(), 1);
    await page.evaluate(() => [...document.querySelectorAll('#profile-test-root [role="menuitem"]')].find(item => item.textContent.includes('Nearby spots')).click());
    assert.equal(await page.evaluate(() => window.__nearbyOpened), 1);
  } finally {
    await browser?.close();
    await server.close();
  }
});
