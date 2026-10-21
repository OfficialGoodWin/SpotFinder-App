import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const base = process.env.SPOTFINDER_AUDIT_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
try {
  for (const width of [320, 390]) {
    for (const dark of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, colorScheme: dark ? 'dark' : 'light', javaScriptEnabled: true });
      if (dark) await context.addCookies([{ name: 'theme', value: 'dark', domain: '127.0.0.1', path: '/' }]);
      const page = await context.newPage();
      const external = [];
      page.on('request', request => { if (/firebase|googleapis\.com\/identitytoolkit|firestore/.test(request.url())) external.push(request.url()); });
      const response = await page.goto(`${base}/news`, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      assert.equal(await page.evaluate(() => document.querySelector('h1')?.textContent), 'Journal');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
      assert.equal(external.length, 0, 'Journal direct view should make no Firebase requests');
      assert.equal(await page.evaluate(() => Boolean(document.querySelector('a[href="/"]'))), true);
      if (dark) assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true);
      await context.close();
      console.log(`Journal ${width}px ${dark ? 'dark' : 'light'}: OK`);
    }
  }
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const page = await noJs.newPage();
  await page.goto(`${base}/news`);
  assert.match(await page.evaluate(() => document.querySelector('main')?.textContent), /First stories land in November/);
  assert.equal((await page.goto(`${base}/news/five-places-near-prague`)).status(), 404);
  assert.equal((await page.goto(`${base}/news/unknown`)).status(), 404);
  assert.equal((await page.goto(`${base}/assets/missing.js`)).status(), 404);
  await noJs.close();
  console.log('No-JavaScript HTML, draft 404, unknown 404, missing asset 404: OK');
  const mapPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const mapResponse = await mapPage.goto(base, { waitUntil: 'domcontentloaded' });
  assert.equal(mapResponse.status(), 200);
  await mapPage.waitForTimeout(2200);
  assert.equal(await mapPage.evaluate(() => Boolean(document.querySelector('.sf-app-viewport'))), true);
  await mapPage.close();
  console.log('Map shell direct visit: OK');
} finally { await browser.close(); }
