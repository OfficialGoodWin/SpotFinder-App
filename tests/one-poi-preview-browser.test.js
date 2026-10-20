import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { preview } from 'vite';
import { chromium } from 'playwright-core';

const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

test('built app opens the real station with localized public details', { skip: !existsSync(browserPath) || !existsSync('dist/poi-details/10/553/346.json'), timeout: 90_000 }, async () => {
  const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(() => {
      localStorage.setItem('spotfinder_welcome_dismissed_v1', '1');
      document.cookie = 'spotfinder_language=cs; path=/';
    });
    const shardResponses = [];
    const translationRequests = [];
    const errors = [];
    page.on('response', response => {
      if (response.url().includes('/poi-details/10/553/346.json'))
        shardResponses.push({ status: response.status(), mime: response.headers()['content-type'] });
    });
    page.on('request', request => {
      if (/wikidata|azure/i.test(new URL(request.url()).hostname)) translationRequests.push(request.url());
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForSelector('.maplibregl-map');
    await page.waitForFunction(() => {
      const node = document.querySelector('.maplibregl-map');
      let fiber = node && Object.entries(node).find(([key]) => key.startsWith('__reactFiber$'))?.[1];
      while (fiber) {
        let hook = fiber.memoizedState;
        while (hook && typeof hook === 'object') {
          if (typeof hook.memoizedState?.current?.jumpTo === 'function') {
            window.__previewProofMap = hook.memoizedState.current;
            return true;
          }
          hook = hook.next;
        }
        fiber = fiber.return;
      }
      return false;
    });
    await page.evaluate(() => window.__previewProofMap.jumpTo({ center: [14.4341259, 50.0835035], zoom: 16 }));
    await page.waitForFunction(() => {
      const map = window.__previewProofMap;
      if (!map?.getLayer('ambient-poi-z13')) return false;
      const p = map.project([14.434125423431396, 50.08350372246943]);
      return map.queryRenderedFeatures([[p.x - 14, p.y - 14], [p.x + 14, p.y + 14]], { layers: ['ambient-poi-z13'] })
        .some(feature => feature.properties?.id === 24569897);
    });
    const point = await page.evaluate(() => {
      const map = window.__previewProofMap;
      const center = map.project([14.434125423431396, 50.08350372246943]);
      for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) {
        const x = center.x + dx, y = center.y + dy;
        const layers = map.getStyle().layers.filter(layer => layer.id.startsWith('ambient-poi-z')).map(layer => layer.id);
        const hits = map.queryRenderedFeatures([[x - 14, y - 14], [x + 14, y + 14]], { layers });
        if (hits[0]?.properties?.id === 24569897) return { x, y };
      }
      return null;
    });
    assert.ok(point, 'station must be the first clicked feature');
    await page.mouse.click(point.x, point.y);
    await page.locator('.sf-sheet > button:first-child').click();
    await page.waitForFunction(() => document.querySelector('[role="dialog"] h1')?.textContent === 'Hlavní nádraží');
    const switchTo = async (language, expected) => {
      await page.evaluate(lang => {
        const node = document.querySelector('.maplibregl-map');
        let fiber = Object.entries(node).find(([key]) => key.startsWith('__reactFiber$'))?.[1];
        while (fiber) {
          let hook = fiber.memoizedState;
          while (hook && typeof hook === 'object') {
            if (hook.memoizedState === document.documentElement.lang && typeof hook.queue?.dispatch === 'function') {
              hook.queue.dispatch(lang);
              return;
            }
            hook = hook.next;
          }
          fiber = fiber.return;
        }
      }, language);
      await page.waitForFunction(name => document.querySelector('[role="dialog"] h1')?.textContent === name, expected);
    };
    await switchTo('en', 'Main Station');
    await switchTo('de', 'Hauptbahnhof');
    await page.locator('[role="dialog"] button.absolute.top-4.right-4').click();
    await page.locator('button:has(svg.lucide-settings)').last().click();
    await page.locator('section[aria-labelledby="language-title"] button[role="combobox"]').click();
    await page.getByRole('option', { name: /English \(US\)/ }).click();
    await page.locator('[aria-labelledby="settings-title"] button[aria-label]').first().click();
    await page.mouse.click(point.x, point.y);
    await page.locator('.sf-sheet > button:first-child').click();
    await page.waitForFunction(() => document.querySelector('[role="dialog"] h1')?.textContent === 'Main Station');
    assert.deepEqual(shardResponses, [{ status: 200, mime: 'application/json' }]);
    assert.deepEqual(translationRequests, []);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.httpServer.close();
  }
});
