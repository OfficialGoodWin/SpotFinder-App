import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const baseURL = 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.SPOTFINDER_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const routes = ['/new/map', '/new/discover', '/new/search', '/new/settings', '/new/settings/legal/preferences', '/new/settings/about/app', '/new/settings/support/feedback', '/new/settings/account'];
await mkdir('reports', { recursive: true });
try {
  for (const [width, height] of [[320, 700], [360, 640], [390, 844], [430, 932], [1024, 768]]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      await context.addCookies([
        { name: 'theme', value: theme, url: baseURL },
        { name: 'spotfinder_language', value: 'en', url: baseURL },
      ]);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const route of routes) {
        await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
        await page.locator('.mobile-v2').waitFor();
        const state = await page.evaluate(() => {
          const app = document.querySelector('.mobile-v2');
          const settings = document.querySelector('.sf-new-settings-page');
          const css = getComputedStyle(settings || app);
          const background = css.backgroundColor;
          const lightness = background.startsWith('oklch') ? Number(background.match(/[\d.]+/)?.[0]) : (background.match(/[\d.]+/g)?.slice(0, 3).map(Number).reduce((sum, value) => sum + value, 0) || 0) / 765;
          return { overflow: document.documentElement.scrollWidth - innerWidth, dark: app.classList.contains('v2-dark'), background, lightness, nav: document.querySelector('.v2-nav')?.textContent || '' };
        });
        assert.equal(state.dark, theme === 'dark', `${width} ${route}: incorrect theme`);
        assert.ok(state.overflow <= 1, `${width} ${theme} ${route}: ${state.overflow}px horizontal overflow`);
        if (route.includes('settings')) assert.ok(theme === 'dark' ? state.lightness < .5 : state.lightness > .7, `${width} ${theme} ${route}: incorrect background ${state.background}`);
        if (route === '/new/map') assert.ok(state.nav.includes('Discover'), 'English navigation label missing');
        if (route === '/new/search') assert.ok(await page.getByRole('textbox', { name: 'Search places' }).count(), 'English search label missing');
        if (width === 390 && route === '/new/settings' && theme === 'dark') await page.screenshot({ path: 'reports/pass5-settings-dark-390.png' });
        if (width === 390 && route === '/new/settings' && theme === 'light') await page.screenshot({ path: 'reports/pass5-settings-light-390.png' });
      }
      assert.deepEqual(errors, [], `${width} ${theme}: runtime errors`);
      console.log(`${width}x${height} ${theme}: ${routes.length} routes passed`);
      await context.close();
    }
  }
} finally { await browser.close(); }
