import { chromium } from 'playwright-core';
import { APP_VERSION } from '../src/config/appVersion.js';

const browser = await chromium.launch({ executablePath: process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
try {
  for (const [width, height] of [[320, 700], [360, 640], [390, 844], [430, 932], [1024, 768]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.goto('http://127.0.0.1:4173/new/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    if (!await page.evaluate(() => Boolean(document.querySelector('.sf-new-settings-page')))) throw new Error(`${width}x${height}: ${JSON.stringify(await page.evaluate(() => ({ path: location.pathname, text: document.body.textContent.slice(0, 240) })))}`);
    const visit = async (label, route) => {
      await page.evaluate(text => [...document.querySelectorAll('.sf-new-settings-row')].find(button => button.textContent.includes(text))?.click(), label);
      await page.waitForFunction(path => location.pathname === path, route, { timeout: 3000 }).catch(async () => { throw new Error(`${label}: ${JSON.stringify(await page.evaluate(() => ({ path: location.pathname, rows: [...document.querySelectorAll('.sf-new-settings-row')].map(row => row.textContent.slice(0, 50)) })))}`); });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 1) throw new Error(`${width}x${height} ${route}: ${overflow}px overflow`);
      if (route.endsWith('/about/app') && !await page.evaluate(version => document.querySelector('.sf-new-about')?.textContent.includes(version), APP_VERSION)) throw new Error(`${width}x${height}: About content/version missing`);
      if (route.endsWith('/support/feedback') && !await page.evaluate(() => document.querySelector('.sf-new-support-submit')?.disabled)) throw new Error(`${width}x${height}: Empty feedback form can submit`);
      await page.evaluate(() => document.querySelector('.sf-new-settings-back').click());
      await page.waitForFunction(() => location.pathname === '/new/settings');
    };
    await visit("What's new", '/new/settings/about/updates');
    await visit('App version', '/new/settings/about/app');
    await visit('Feedback', '/new/settings/support/feedback');
    await visit('Account management', '/new/settings/account');
    if (width === 390) {
      await page.evaluate(() => [...document.querySelectorAll('.sf-new-settings-row')].find(row => row.textContent.startsWith('Language'))?.click());
      await page.waitForFunction(() => location.pathname === '/new/settings/language');
      await page.locator('select[aria-label="App language"]').selectOption('cs');
      await page.waitForFunction(() => document.querySelector('#sf-new-settings-title')?.textContent.includes('Jazyk'));
      await page.evaluate(() => document.querySelector('.sf-new-settings-back').click());
      await page.waitForFunction(() => location.pathname === '/new/settings');
      await page.evaluate(() => [...document.querySelectorAll('.sf-new-settings-row')].find(row => row.textContent.startsWith('Vzhled'))?.click());
      await page.waitForFunction(() => location.pathname === '/new/settings/appearance');
      await page.evaluate(() => document.querySelector('input[role="switch"]').click());
      await page.waitForFunction(() => document.querySelector('input[role="switch"]')?.checked);
    }
    console.log(`${width}x${height}: Settings routes and back passed`);
    await page.close();
  }
} finally { await browser.close(); }
