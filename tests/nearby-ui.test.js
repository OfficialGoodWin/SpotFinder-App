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
    assert.equal(await page.locator('button[title="Nearby spots"]').count(), 1);
    assert.equal(await page.locator('button[aria-label="Center on my location"]').count(), 1);
    assert.equal(await page.locator('button[title="Drafts"]').count(), 1);
    assert.equal(await page.locator('button[title="Nearby spots"]').getAttribute('aria-label'), 'Open nearby spots filters');
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
    await mobilePage.addInitScript(() => {
      localStorage.setItem('spotfinder_welcome_dismissed_v1', '1');
      localStorage.setItem('spotfinder_cookie_consent_v1', JSON.stringify({ decided: true }));
    });
    await mobilePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForFunction(() => Boolean(document.querySelector('button[title="Nearby spots"]')));
    assert.equal(await mobilePage.locator('button[title="Nearby spots"]').count(), 1);
    await mobilePage.evaluate(() => document.querySelector('button[title="Nearby spots"]').click());
    const measureDialog = () => mobilePage.evaluate(() => {
      const dialog = document.querySelector('[aria-labelledby="nearby-filter-title"]');
      const card = dialog.querySelector('.sf-nearby-filter-card').getBoundingClientRect();
      const body = dialog.querySelector('.sf-nearby-filter-body');
      const bodyBounds = body.getBoundingClientRect();
      const cancel = dialog.querySelector('button.sf-filter-secondary').getBoundingClientRect();
      const apply = dialog.querySelector('button.sf-filter-primary').getBoundingClientRect();
      const origin = dialog.querySelector('fieldset').getBoundingClientRect();
      const originHeading = dialog.querySelector('fieldset [aria-hidden="true"]').getBoundingClientRect();
      return {
        dialogCount: document.querySelectorAll('[aria-labelledby="nearby-filter-title"]').length,
        cardTop: card.top, cardBottom: card.bottom,
        bodyTop: bodyBounds.top, bodyBottom: bodyBounds.bottom,
        bodyScrollable: body.scrollHeight > body.clientHeight,
        cancelTop: cancel.top, cancelBottom: cancel.bottom,
        applyTop: apply.top, applyBottom: apply.bottom,
        originLeft: origin.left, originRight: origin.right,
        headingLeft: originHeading.left, headingRight: originHeading.right,
        viewportHeight: window.visualViewport?.height ?? window.innerHeight,
        horizontalOverflow: dialog.scrollWidth > dialog.clientWidth,
        bodyOverflow: document.body.style.overflow,
      };
    });
    const assertAccessible = bounds => {
      assert.equal(bounds.dialogCount, 1);
      assert.equal(bounds.horizontalOverflow, false);
      assert.equal(bounds.bodyOverflow, 'hidden');
      assert.ok(bounds.cardTop >= 0 && bounds.cardBottom <= bounds.viewportHeight + 1, JSON.stringify(bounds));
      assert.ok(bounds.cancelTop >= 0 && bounds.cancelBottom <= bounds.viewportHeight + 1, JSON.stringify(bounds));
      assert.ok(bounds.applyTop >= 0 && bounds.applyBottom <= bounds.viewportHeight + 1, JSON.stringify(bounds));
      assert.ok(bounds.bodyTop >= 0 && bounds.bodyBottom <= bounds.cancelTop, JSON.stringify(bounds));
      assert.ok(bounds.headingLeft > bounds.originLeft && bounds.headingRight < bounds.originRight, JSON.stringify(bounds));
    };
    assertAccessible(await measureDialog());

    await mobilePage.evaluate(() => document.querySelector('[aria-label="Maximum straight-line distance"]').focus());
    await mobilePage.keyboard.press('End');
    assert.equal(await mobilePage.evaluate(() => document.querySelector('[aria-label="Maximum straight-line distance"]').value), '51');
    assert.match(await mobilePage.evaluate(() => document.querySelector('#nearby-distance-explanation').textContent), /Move the slider back to 50 km/);
    for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 420 }, { width: 320, height: 390 }, { width: 320, height: 300 }]) {
      await mobilePage.setViewportSize(viewport);
      await mobilePage.waitForFunction(() => {
        const dialog = document.querySelector('[aria-labelledby="nearby-filter-title"]');
        const shortLandscape = matchMedia('(orientation: landscape) and (max-height: 430px)').matches;
        const expectedHeight = window.visualViewport.height - (shortLandscape ? 56 : 0);
        return Math.abs(dialog.getBoundingClientRect().height - expectedHeight) < 2;
      });
      assertAccessible(await measureDialog());
    }
    await mobilePage.evaluate(() => { document.documentElement.style.fontSize = '20px'; });
    const largeTextBounds = await measureDialog();
    assertAccessible(largeTextBounds);
    assert.equal(largeTextBounds.bodyScrollable, true);
    const lightBackground = await mobilePage.evaluate(() => getComputedStyle(document.querySelector('.sf-nearby-filter-card')).backgroundColor);
    await mobilePage.evaluate(() => document.documentElement.classList.add('dark'));
    assertAccessible(await measureDialog());
    assert.notEqual(await mobilePage.evaluate(() => getComputedStyle(document.querySelector('.sf-nearby-filter-card')).backgroundColor), lightBackground);
    await mobilePage.evaluate(() => {
      const body = document.querySelector('.sf-nearby-filter-body');
      body.scrollTop = body.scrollHeight;
    });
    assert.equal(await mobilePage.evaluate(() => {
      const body = document.querySelector('.sf-nearby-filter-body').getBoundingClientRect();
      const rating = [...document.querySelectorAll('.sf-filter-section')].find(section => section.textContent.includes('Minimum rating')).getBoundingClientRect();
      return rating.bottom <= body.bottom + 1;
    }), true);
    await mobilePage.evaluate(() => document.querySelectorAll('input[name="nearby-origin"]')[1].click());
    assert.equal(await mobilePage.evaluate(() => document.querySelectorAll('input[name="nearby-origin"]')[1].checked), true);
    await mobilePage.evaluate(() => document.querySelector('[aria-label="Maximum straight-line distance"]').focus());
    await mobilePage.keyboard.press('ArrowLeft');
    assert.equal(await mobilePage.evaluate(() => document.querySelector('[aria-label="Maximum straight-line distance"]').value), '50');
    assert.equal(await mobilePage.evaluate(() => document.querySelector('#nearby-distance-explanation')), null);
    assertAccessible(await measureDialog());
    await mobilePage.keyboard.press('End');
    assertAccessible(await measureDialog());
    const cancelTap = await mobilePage.evaluate(() => {
      const rect = document.querySelector('button.sf-filter-secondary').getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    const tapTarget = await mobilePage.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.outerHTML.slice(0, 300), cancelTap);
    assert.match(tapTarget ?? '', /sf-filter-secondary/);
    await mobilePage.touchscreen.tap(cancelTap.x, cancelTap.y);
    await mobilePage.waitForFunction(() => !document.querySelector('[aria-labelledby="nearby-filter-title"]'));
    assert.equal(await mobilePage.evaluate(() => document.querySelector('[aria-labelledby="nearby-filter-title"]')), null);
    assert.equal(await mobilePage.evaluate(() => document.body.style.overflow), '');
    await mobilePage.evaluate(() => document.querySelector('button[title="Nearby spots"]').click());
    assertAccessible(await measureDialog());
    assert.equal(await mobilePage.evaluate(() => document.querySelector('[aria-label="Maximum straight-line distance"]').value), '50');
  } finally {
    await browser?.close();
    await server.close();
  }
});
