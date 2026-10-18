import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { isChunkLoadError, notifyVitePreloadError } from '../src/lib/chunkRecovery.js';

const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

test('Vercel fallback excludes assets and API while preserving SPA routes', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const fallback = config.rewrites.find(rule => rule.destination === '/index.html');
  const match = new RegExp(`^${fallback.source}$`);
  for (const route of ['/', '/FAQ', '/updates', '/spot/abc123']) assert.equal(match.test(route), true, route);
  for (const asset of ['/assets/SettingsModal-old.js', '/assets/index-old.css', '/api/create-checkout-session', '/sw.js', '/manifest.json']) {
    assert.equal(match.test(asset), false, asset);
  }
  assert.ok(config.headers.some(rule => rule.source === '/assets/(.*)' && /immutable/.test(rule.headers[0].value)));
  assert.ok(config.headers.some(rule => rule.source === '/sw.js' && /no-cache/.test(rule.headers[0].value)));
});

test('only dynamic module load failures trigger chunk recovery', () => {
  assert.equal(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/SettingsModal-old.js')), true);
  assert.equal(isChunkLoadError(new TypeError('Importing a module script failed.')), true);
  assert.equal(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'lng')")), false);
  const safariError = new TypeError('Load failed');
  assert.equal(isChunkLoadError(safariError), false);
  const previousWindow = globalThis.window;
  globalThis.window = new EventTarget();
  try {
    notifyVitePreloadError(safariError);
    assert.equal(isChunkLoadError(safariError), true);
  } finally {
    globalThis.window = previousWindow;
  }
});

test('a missing Settings chunk keeps the map usable and warns before unsaved reload', { skip: !existsSync(browserPath) || !existsSync('dist/index.html') }, async () => {
  const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
    const freshContext = await browser.newContext({ serviceWorkers: 'block' });
    await freshContext.addInitScript(() => {
      localStorage.setItem('spotfinder_cookie_consent_v1', JSON.stringify({ decided: true, necessary: true }));
      localStorage.setItem('spotfinder_welcome_dismissed_v1', '1');
    });
    const freshPage = await freshContext.newPage();
    await freshPage.goto(base, { waitUntil: 'networkidle' });
    await freshPage.evaluate(() => document.querySelector('button[aria-label="Open settings"]')?.click());
    await freshPage.waitForFunction(() => Boolean(document.querySelector('#text-size')));
    await freshPage.reload({ waitUntil: 'networkidle' });
    await freshPage.evaluate(() => document.querySelector('button[aria-label="Open settings"]')?.click());
    await freshPage.waitForFunction(() => Boolean(document.querySelector('#text-size')));
    await freshContext.close();

    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      localStorage.setItem('spotfinder_cookie_consent_v1', JSON.stringify({ decided: true, necessary: true, analytics: false, ads: false }));
      localStorage.setItem('spotfinder_welcome_dismissed_v1', '1');
    });
    await context.route(/\/assets\/SettingsModal-[^/]+\.js$/, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Stale rewrite</title>' }));
    const page = await context.newPage();
    let navigations = 0;
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });
    await page.goto(base, { waitUntil: 'networkidle' });
    const baselineNavigations = navigations;
    await page.evaluate(() => {
      // Simulate text still being edited elsewhere in the mounted app.
      const form = document.createElement('form');
      form.dataset.unsavedWork = 'true';
      document.body.append(form);
      document.querySelector('button[aria-label="Open settings"]')?.click();
    });
    await page.waitForFunction(() => document.body.textContent.includes('This view could not load'));
    assert.equal(await page.locator('.maplibregl-canvas').count(), 1);
    assert.equal(navigations, baselineNavigations, 'no automatic reload');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Reload app')?.click());
    await page.waitForFunction(() => document.body.textContent.includes('Reload with unsaved work?'));
    assert.equal(navigations, baselineNavigations, 'warning does not reload automatically');
    await context.close();

    const offlineContext = await browser.newContext({ serviceWorkers: 'block' });
    await offlineContext.addInitScript(() => {
      localStorage.setItem('spotfinder_cookie_consent_v1', JSON.stringify({ decided: true, necessary: true }));
      localStorage.setItem('spotfinder_welcome_dismissed_v1', '1');
    });
    const offlinePage = await offlineContext.newPage();
    await offlinePage.goto(base, { waitUntil: 'networkidle' });
    await offlineContext.route(/\/assets\/SettingsModal-[^/]+\.js$/, route => route.abort('internetdisconnected'));
    await offlineContext.setOffline(true);
    await offlinePage.evaluate(() => document.querySelector('button[aria-label="Open settings"]')?.click());
    await offlinePage.waitForFunction(() => document.body.textContent.includes('You appear to be offline'));
    assert.equal(await offlinePage.locator('.maplibregl-canvas').count(), 1);
    await offlineContext.close();
  } finally {
    await browser?.close();
    await server.httpServer.close();
  }
});

test('service worker caches valid chunks but never caches an HTML asset fallback', { skip: !existsSync(browserPath) || !existsSync('dist/sw.js') }, async () => {
  const workerSource = readFileSync('dist/sw.js', 'utf8');
  assert.match(workerSource, /\/\/ Build \d+/);
  const settingsAsset = readdirSync('dist/assets').find(name => /^SettingsModal-.*\.js$/.test(name));
  assert.ok(settingsAsset);
  const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    const result = await page.evaluate(async asset => {
      const valid = await fetch(`/assets/${asset}`);
      const missing = await fetch('/assets/SettingsModal-obsolete.js');
      const cachedValid = await caches.match(`/assets/${asset}`);
      const cachedMissing = await caches.match('/assets/SettingsModal-obsolete.js');
      return {
        validType: valid.headers.get('content-type'),
        missingType: missing.headers.get('content-type'),
        cachedValidType: cachedValid?.headers.get('content-type'),
        cachedMissing: Boolean(cachedMissing),
      };
    }, settingsAsset);
    assert.match(result.validType, /javascript/);
    assert.match(result.cachedValidType, /javascript/);
    assert.equal(result.cachedMissing, false, JSON.stringify(result));
    await context.close();
  } finally {
    await browser?.close();
    await server.httpServer.close();
  }
});
