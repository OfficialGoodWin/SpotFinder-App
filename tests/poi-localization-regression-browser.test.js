import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { preview } from 'vite';
import { chromium } from 'playwright-core';

const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const target = [14.434125423431396, 50.08350372246943];

test('real published station stays localized across Settings changes on desktop and iPhone', {
  skip: !existsSync(browserPath) || !existsSync('dist/poi-details/10/553/346.json'), timeout: 120_000,
}, async () => {
  const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
        isMobile: mobile, hasTouch: mobile,
      });
      const page = await context.newPage();
      const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => requests.push(request.url()));
      await page.addInitScript(() => {
        localStorage.setItem('spotfinder_welcome_dismissed_v1', '1');
        document.cookie = 'spotfinder_language=cs; path=/';
      });
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`, { waitUntil: 'domcontentloaded' });
      const continueButton = page.getByRole('button', { name: 'Continue' });
      if (await continueButton.isVisible().catch(() => false)) await continueButton.click();
      const consent = page.getByRole('button', { name: 'Keep optional services off' });
      if (await consent.waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false)) await consent.click();
      await page.waitForSelector('.maplibregl-map');
      await page.waitForFunction(() => {
        const node = document.querySelector('.maplibregl-map');
        let fiber = node && Object.entries(node).find(([key]) => key.startsWith('__reactFiber$'))?.[1];
        while (fiber) {
          let hook = fiber.memoizedState;
          while (hook && typeof hook === 'object') {
            if (typeof hook.memoizedState?.current?.jumpTo === 'function') {
              window.__localizationMap = hook.memoizedState.current;
              return true;
            }
            hook = hook.next;
          }
          fiber = fiber.return;
        }
        return false;
      });
      await page.evaluate(() => window.__localizationMap.jumpTo({ center: [14.4341259, 50.0835035], zoom: 16 }));
      await page.waitForFunction(([lon, lat]) => {
        const map = window.__localizationMap;
        const p = map.project([lon, lat]);
        const layers = map.getStyle()?.layers?.filter(layer => layer.id.startsWith('ambient-poi-z')).map(layer => layer.id) || [];
        return layers.length && map.queryRenderedFeatures([[p.x - 14, p.y - 14], [p.x + 14, p.y + 14]], { layers })
          .some(feature => feature.properties?.id === 24569897);
      }, target).catch(async error => {
        const state = await page.evaluate(([lon, lat]) => {
          const map = window.__localizationMap;
          const p = map.project([lon, lat]);
          const layers = map.getStyle()?.layers?.filter(layer => layer.id.startsWith('ambient-poi-z')).map(layer => layer.id) || [];
          return { layers, zoom: map.getZoom(), center: map.getCenter(), point: p, canvas: { width: map.getCanvas().width, height: map.getCanvas().height }, source: map.getSource('ambient-poi-tiles')?.type, sourceCount: map.querySourceFeatures('ambient-poi-tiles', { sourceLayer: 'ambient_poi' }).length, hits: layers.length ? map.queryRenderedFeatures([[p.x - 14, p.y - 14], [p.x + 14, p.y + 14]], { layers }).map(feature => feature.properties) : [] };
        }, target);
        throw new Error(`${error.message}; mobile=${mobile}; map=${JSON.stringify(state)}; requests=${JSON.stringify(requests.filter(url => /pmtiles|blob\.vercel/.test(url)).slice(-8))}; errors=${JSON.stringify(errors)}`);
      });
      const point = await page.evaluate(([lon, lat]) => {
        const map = window.__localizationMap;
        const p = map.project([lon, lat]);
        const layers = map.getStyle().layers.filter(layer => layer.id.startsWith('ambient-poi-z')).map(layer => layer.id);
        for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) {
          const x = p.x + dx, y = p.y + dy;
          if (map.queryRenderedFeatures([[x - 14, y - 14], [x + 14, y + 14]], { layers })[0]?.properties?.id === 24569897) return { x, y };
        }
        return null;
      }, target);
      assert.ok(point, 'actual station must be the first clicked PMTiles feature');

      async function selectLanguage(option) {
        if (mobile) await page.locator('button[aria-expanded]:has(svg.lucide-ellipsis)').click();
        await page.locator('button:visible:has(svg.lucide-settings)').last().click();
        await page.locator('section[aria-labelledby="language-title"] button[role="combobox"]').click();
        await page.getByRole('option', { name: option }).first().click();
        await page.locator('[aria-labelledby="settings-title"] button[aria-label]').first().click();
      }
      const languages = [
        { option: /Deutsch/, name: 'Hauptbahnhof', code: 'de' },
        { option: /English \(US\)/, name: 'Main Station', code: 'en' },
        { option: /Čeština/, name: 'Hlavní nádraží', code: 'cs' },
      ];
      for (const language of languages) {
        await selectLanguage(language.option);
        await page.waitForFunction(code => document.documentElement.lang === code, language.code);
        if (mobile) await page.touchscreen.tap(point.x, point.y);
        else await page.mouse.click(point.x, point.y);
        await page.locator('.sf-sheet.fixed').getByText(language.name, { exact: true }).waitFor();
        await page.locator('.sf-sheet > button:first-child').click();
        assert.equal(await page.locator('[role="dialog"] h1').innerText(), language.name);
        if (language.code !== 'cs') assert.match(await page.locator('[role="dialog"]').innerText(), /Hlavní nádraží/);
        if (mobile) {
          const box = await page.locator('[role="dialog"]').boundingBox();
          assert.ok(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844);
        }
        await page.locator('[role="dialog"] button.absolute.top-4.right-4').click();
      }
      assert.equal(requests.filter(url => url.includes('/poi-details/10/553/346.json')).length, 1);
      assert.equal(requests.filter(url => /wikidata|azure/i.test(new URL(url).hostname)).length, 0);
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
    await server.httpServer.close();
  }
});
