import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { preview } from 'vite';
import { chromium } from 'playwright-core';

const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

test('built app opens a second real PMTiles marker with the merged static translation', { skip: !existsSync(browserPath) || !existsSync('dist/poi-details/10/553/346.json'), timeout: 90_000 }, async () => {
  const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const requests = [], errors = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { localStorage.setItem('spotfinder_welcome_dismissed_v1', '1'); document.cookie = 'spotfinder_language=cs; path=/'; });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`, { waitUntil: 'domcontentloaded' });
    const continueButton = page.getByRole('button', { name: 'Continue' });
    if (await continueButton.isVisible().catch(() => false)) await continueButton.click();
    const consent = page.getByRole('button', { name: 'Keep optional services off' });
    if (await consent.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) await consent.click();
    await page.waitForSelector('.maplibregl-map');
    await page.waitForFunction(() => {
      const node = document.querySelector('.maplibregl-map');
      let fiber = node && Object.entries(node).find(([key]) => key.startsWith('__reactFiber$'))?.[1];
      while (fiber) {
        let hook = fiber.memoizedState;
        while (hook && typeof hook === 'object') {
          if (typeof hook.memoizedState?.current?.jumpTo === 'function') { window.__publisherProofMap = hook.memoizedState.current; return true; }
          hook = hook.next;
        }
        fiber = fiber.return;
      }
      return false;
    }, { timeout: 10000 }).catch(async error => {
      throw new Error(`Map instance unavailable: ${error.message}; page errors=${JSON.stringify(errors)}; body=${(await page.locator('body').innerText()).slice(0, 1200)}; map nodes=${await page.locator('.maplibregl-map').count()}`);
    });
    await page.evaluate(() => window.__publisherProofMap.jumpTo({ center: [14.4542345, 50.1241376], zoom: 16 }));
    await page.waitForFunction(() => {
      const map = window.__publisherProofMap;
      const layers = map.getStyle()?.layers?.filter(layer => layer.id.startsWith('ambient-poi-z')).map(layer => layer.id) || [];
      if (!layers.length) return false;
      const p = map.project([14.4542345, 50.1241376]);
      return map.queryRenderedFeatures([[p.x - 14, p.y - 14], [p.x + 14, p.y + 14]], { layers }).some(feature => feature.properties?.id === 24569759);
    }, { timeout: 30000 });
    const point = await page.evaluate(() => {
      const map = window.__publisherProofMap;
      const p = map.project([14.4542345, 50.1241376]);
      const layers = map.getStyle().layers.filter(layer => layer.id.startsWith('ambient-poi-z')).map(layer => layer.id);
      for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) {
        const x = p.x + dx, y = p.y + dy;
        if (map.queryRenderedFeatures([[x - 14, y - 14], [x + 14, y + 14]], { layers })[0]?.properties?.id === 24569759) return { x, y };
      }
      return null;
    });
    assert.ok(point, 'real Kobylisy marker needs an unobstructed click point');
    await page.mouse.click(point.x, point.y);
    await page.locator('.sf-sheet.fixed').getByText('Kobylisy', { exact: true }).waitFor();
    await page.locator('.sf-sheet.fixed').getByRole('button', { name: 'Zavřít' }).click();
    await page.getByRole('button', { name: 'Otevřít nastavení' }).click();
    await page.locator('section[aria-labelledby="language-title"] button[role="combobox"]').click();
    await page.getByRole('option', { name: /Deutsch/ }).first().click();
    await page.locator('[aria-labelledby="settings-title"] button[aria-label]').first().click();
    await page.mouse.click(point.x, point.y);
    await page.locator('.sf-sheet.fixed').getByText('Kobilis', { exact: true }).waitFor();
    assert.equal(requests.filter(url => url.includes('/poi-details/10/553/346.json')).length, 1);
    assert.equal(requests.filter(url => /wikidata|azure/i.test(url)).length, 0);
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await server.httpServer.close(); }
});
