import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';

const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

test('Nearby opens one filter dialog, Cancel preserves applied values, and Show Nearby opens results', { skip: !existsSync(browserPath) }, async () => {
  const server = await createServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': resolve('src') } }, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    const port = server.httpServer.address().port;
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem('spotfinder_welcome_dismissed_v1', '1'));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(document.querySelector('button[title="Nearby spots"]')));
    const click = selector => page.evaluate(value => document.querySelector(value)?.click(), selector);
    const dialogCount = () => page.evaluate(() => document.querySelectorAll('[aria-labelledby="nearby-filter-title"]').length);
    await click('button[title="Nearby spots"]');
    await page.waitForFunction(() => Boolean(document.querySelector('[aria-labelledby="nearby-filter-title"]')));
    assert.equal(await dialogCount(), 1);
    assert.equal(await page.evaluate(() => document.querySelector('[aria-label="Maximum straight-line distance"]').value), '50');
    await page.evaluate(() => document.querySelector('[aria-label="Maximum straight-line distance"]').focus());
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => document.querySelector('[aria-label="Maximum straight-line distance"]').value), '49');
    await click('button.sf-filter-secondary');
    assert.equal(await dialogCount(), 0);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('h2')].some(item => item.textContent === 'Nearby spots')), false);
    await click('button[title="Nearby spots"]');
    assert.equal(await page.evaluate(() => document.querySelector('[aria-label="Maximum straight-line distance"]').value), '50');
    await page.evaluate(() => document.querySelector('[aria-label="Maximum straight-line distance"]').focus());
    await page.keyboard.press('ArrowLeft');
    await page.evaluate(() => document.querySelectorAll('input[name="nearby-origin"]')[1].click());
    await click('button.sf-filter-primary');
    await page.waitForFunction(() => [...document.querySelectorAll('h2')].some(item => item.textContent === 'Nearby spots'));
    assert.equal(await dialogCount(), 0);
    assert.match(await page.evaluate(() => [...document.querySelectorAll('h2')].find(item => item.textContent === 'Nearby spots').parentElement.textContent), /selected map center/);
    await click('[aria-label="Change nearby filters"]');
    assert.equal(await dialogCount(), 1);
    assert.equal(await page.evaluate(() => document.querySelector('[aria-label="Maximum straight-line distance"]').value), '49');
    await click('button.sf-filter-secondary');
    assert.equal(await dialogCount(), 0);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('h2')].some(item => item.textContent === 'Nearby spots')), true);

    const missingLocationPage = await browser.newPage();
    await missingLocationPage.addInitScript(() => {
      localStorage.setItem('spotfinder_welcome_dismissed_v1', '1');
      Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
    });
    await missingLocationPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await missingLocationPage.waitForFunction(() => Boolean(document.querySelector('button[title="Nearby spots"]')));
    await missingLocationPage.evaluate(() => document.querySelector('button[title="Nearby spots"]').click());
    await missingLocationPage.evaluate(() => document.querySelector('button.sf-filter-primary').click());
    await missingLocationPage.waitForFunction(() => Boolean(document.querySelector('[aria-labelledby="nearby-filter-title"] [role="alert"]')));
    assert.match(await missingLocationPage.evaluate(() => document.querySelector('[aria-labelledby="nearby-filter-title"] [role="alert"]').textContent), /cannot provide your location/);
    assert.equal(await missingLocationPage.evaluate(() => [...document.querySelectorAll('h2')].some(item => item.textContent === 'Nearby spots')), false);

    const mobilePage = await browser.newPage({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
    await mobilePage.addInitScript(() => localStorage.setItem('spotfinder_welcome_dismissed_v1', '1'));
    await mobilePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForFunction(() => Boolean(document.querySelector('button[title="Nearby spots"]')));
    await mobilePage.evaluate(() => document.querySelector('button[title="Nearby spots"]').click());
    const modalBounds = await mobilePage.evaluate(() => {
      const dialog = document.querySelector('[aria-labelledby="nearby-filter-title"]');
      const actions = dialog.querySelector('button.sf-filter-primary').getBoundingClientRect();
      return { dialogCount: document.querySelectorAll('[aria-labelledby="nearby-filter-title"]').length, actionBottom: actions.bottom, viewportHeight: window.innerHeight, horizontalOverflow: dialog.scrollWidth > dialog.clientWidth };
    });
    assert.equal(modalBounds.dialogCount, 1);
    assert.equal(modalBounds.horizontalOverflow, false);
    assert.ok(modalBounds.actionBottom <= modalBounds.viewportHeight);
  } finally {
    await browser?.close();
    await server.close();
  }
});
