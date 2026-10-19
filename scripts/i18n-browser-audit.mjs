import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { LANGUAGES, LANGUAGE_VARIANTS } from '../src/locales/translations.js';

const browser = await chromium.launch({ executablePath: process.env.SPOTFINDER_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const baseURL = process.env.SPOTFINDER_AUDIT_URL || 'http://127.0.0.1:4173';
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('spotfinder_cookie_consent_v1', JSON.stringify({ necessary: true, analytics: false, ads: false, decided: true }));
    localStorage.setItem('spotfinder_welcome_dismissed_v1', '1');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open settings' }).waitFor();
  await page.getByRole('button', { name: 'Open settings' }).click();
  await page.getByRole('combobox', { name: 'Select language' }).click();
  await page.getByRole('option', { name: /Čeština/ }).click();
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'cs');
  await page.getByRole('heading', { name: 'Jazyk' }).waitFor();
  await page.setViewportSize({ width: 375, height: 812 });
  const settingsOverflow = await page.evaluate(() => {
    const panel = document.querySelector('[role="dialog"] section');
    return panel ? panel.scrollWidth - panel.clientWidth : null;
  });
  assert.ok(settingsOverflow !== null && settingsOverflow <= 1, `Czech Settings overflow: ${settingsOverflow}`);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Přepnout 3D terén' }).waitFor();
  await page.getByRole('button', { name: 'Otevřít filtry míst v okolí' }).click();
  await page.getByRole('heading', { name: 'Místa v okolí' }).waitFor();
  assert.ok(await page.getByRole('button', { name: 'Zobrazit okolí' }).isVisible());
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'cs');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByRole('button', { name: 'Otevřít nastavení' }).click();
  await page.getByRole('combobox', { name: 'Vyberte jazyk' }).click();
  await page.getByRole('option', { name: /English \(US\)/ }).click();
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  await page.getByRole('heading', { name: 'Language' }).waitFor();
  for (const { code } of [...LANGUAGES, ...LANGUAGE_VARIANTS]) {
    await page.context().addCookies([{ name: 'spotfinder_language', value: code, url: baseURL }]);
    await page.goto(`${baseURL}/faq`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(expected => document.documentElement.lang === expected, code);
    const title = await page.locator('h1').first().textContent();
    assert.ok(title && !/^[a-zA-Z]+\.[a-zA-Z]+$/.test(title), `${code}: raw key in FAQ title`);
  }
  console.log('English/Czech switching, open dialog, Nearby, map controls, refresh persistence, mobile Settings, and public FAQ rendering for every locale passed.');
} finally {
  await browser.close();
}
