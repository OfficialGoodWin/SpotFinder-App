import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';

const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

test('MapLibre remains stable before GPS, after delayed fixes, and through camera and style changes', { skip: !existsSync(browserPath) }, async () => {
  const server = await createServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': resolve('src') } }, server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const crashes = [];
    page.on('pageerror', error => crashes.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('spotfinder_welcome_dismissed_v1', '1');
      localStorage.setItem('spotfinder_cookie_consent_v1', JSON.stringify({ necessary: true, decided: true }));
      let success;
      let failure;
      let watches = 0;
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
        watchPosition(ok, bad) { success = ok; failure = bad; watches += 1; return watches; },
        clearWatch() { watches -= 1; },
        getCurrentPosition(ok) { ok({ coords: { latitude: 50, longitude: 14, accuracy: 15 }, timestamp: Date.now() }); },
      } });
      window.__spotfinderGpsTest = {
        emit(lat, lng) { success?.({ coords: { latitude: lat, longitude: lng, accuracy: 15 }, timestamp: Date.now() }); },
        deny() { failure?.({ code: 1, message: 'Denied' }); },
        watching() { return watches; },
      };
    });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(document.querySelector('.maplibregl-canvas')));
    const userMarker = '[aria-label="Current device location"]';
    assert.equal(await page.locator(userMarker).count(), 0);
    await page.evaluate(() => document.querySelector('button[aria-label="Center on my location"]').click());
    await page.waitForFunction(() => window.__spotfinderGpsTest.watching() === 1);
    assert.equal(await page.locator(userMarker).count(), 0);
    await page.evaluate(() => window.__spotfinderGpsTest.emit(50, 14));
    await page.waitForFunction(() => Boolean(document.querySelector('[aria-label="Current device location"]')));
    assert.equal(await page.locator(userMarker).count(), 1);
    await page.evaluate(() => window.__spotfinderGpsTest.emit(50.001, 14.001));
    assert.equal(await page.locator(userMarker).count(), 1);
    await page.mouse.move(190, 400);
    await page.mouse.down();
    await page.mouse.move(250, 430, { steps: 4 });
    await page.mouse.up();
    await page.mouse.wheel(0, -500);
    for (const index of [1, 2, 3, 4, 0]) {
      await page.evaluate(() => document.querySelector('button[aria-label="Map layers"]').click());
      await page.waitForFunction(() => document.querySelector('button[aria-label="Map layers"]').parentElement.querySelectorAll('.sf-menu-motion button').length === 5);
      await page.evaluate(optionIndex => {
        const options = document.querySelector('button[aria-label="Map layers"]').parentElement.querySelectorAll('.sf-menu-motion button');
        if (options.length !== 5) throw new Error(`Expected five map styles, found ${options.length}`);
        options[optionIndex].click();
      }, index);
    }
    await page.evaluate(() => document.querySelector('button[aria-label="Toggle 3D terrain"]')?.click());
    await page.waitForTimeout(400);
    assert.equal(await page.locator(userMarker).count(), 1);
    assert.equal(crashes.filter(message => /Cannot read properties of undefined.*lng/.test(message)).length, 0);
    await page.evaluate(() => window.__spotfinderGpsTest.deny());
    await page.waitForFunction(() => window.__spotfinderGpsTest.watching() === 0);
    assert.equal(await page.locator(userMarker).count(), 0);
    assert.equal(crashes.filter(message => /Cannot read properties of undefined.*lng/.test(message)).length, 0);

    const deniedPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const deniedCrashes = [];
    deniedPage.on('pageerror', error => deniedCrashes.push(error.message));
    await deniedPage.addInitScript(() => {
      localStorage.setItem('spotfinder_welcome_dismissed_v1', '1');
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
        watchPosition(_ok, bad) { setTimeout(() => bad({ code: 1, message: 'Denied' }), 0); return 1; },
        clearWatch() {},
      } });
    });
    await deniedPage.goto(`http://127.0.0.1:${server.httpServer.address().port}/`, { waitUntil: 'domcontentloaded' });
    await deniedPage.waitForFunction(() => Boolean(document.querySelector('.maplibregl-canvas')));
    await deniedPage.evaluate(() => document.querySelector('button[aria-label="Center on my location"]').click());
    await deniedPage.waitForTimeout(200);
    assert.equal(await deniedPage.locator(userMarker).count(), 0);
    assert.equal(deniedCrashes.filter(message => /Cannot read properties of undefined.*lng/.test(message)).length, 0);
  } finally {
    await browser?.close();
    await server.close();
  }
});
