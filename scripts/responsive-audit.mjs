import { chromium } from 'playwright-core';

const executablePath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const baseURL = process.env.SPOTFINDER_AUDIT_URL || 'http://127.0.0.1:4173';
const viewports = [
  [320, 700], [375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [1440, 900], [1920, 1080],
  [667, 375], [844, 390],
];

const browser = await chromium.launch({ executablePath, headless: true });
const failures = [];
try {
  for (const [width, height] of viewports) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce', colorScheme: 'light' });
    await page.goto(`${baseURL}/faq`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);
    const faq = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    if (faq.overflow > 1) failures.push(`FAQ ${width}x${height}: ${faq.overflow}px horizontal overflow`);

    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('spotfinder_cookie_consent_v1', JSON.stringify({ necessary: true, analytics: false, ads: false, decided: true }));
      localStorage.setItem('spotfinder_welcome_dismissed_v1', '1');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    const home = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    if (home.overflow > 1) failures.push(`Home ${width}x${height}: ${home.overflow}px horizontal overflow`);

    if (width === 320) {
      await page.evaluate(() => document.querySelector('button[aria-label="Sign in"]')?.click());
      await page.waitForTimeout(50);
      const box = await page.evaluate(() => {
        const rect = document.querySelector('[role="dialog"] > div')?.getBoundingClientRect();
        return rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      if (!box || box.width > width + 1 || box.y < -1 || box.y + box.height > height + 1) failures.push('Auth modal is clipped at 320px');
      await page.keyboard.press('Escape');

      await page.evaluate(() => localStorage.setItem('spotfinder_text_scale_v1', '250'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(150);
      const scaledHome = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      if (scaledHome.overflow > 1) failures.push(`Home at 250% text: ${scaledHome.overflow}px horizontal overflow`);
      await page.evaluate(() => document.querySelector('button[aria-label="More map options"]')?.click());
      await page.waitForTimeout(50);
      await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Settings')?.click());
      await page.waitForTimeout(50);
      const scaledSettings = await page.evaluate(() => {
        const panel = document.querySelector('[role="dialog"] section');
        const rect = panel?.getBoundingClientRect();
        const slider = document.querySelector('#text-size');
        const close = document.querySelector('[role="dialog"] button[aria-label="Close"]')?.getBoundingClientRect();
        return { rect: rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, close: close && { x: close.x, y: close.y, width: close.width, height: close.height }, overflow: panel ? panel.scrollWidth - panel.clientWidth : null, value: slider?.value };
      });
      if (!scaledSettings.rect || scaledSettings.rect.width > width + 1 || scaledSettings.rect.x < -1 || scaledSettings.rect.y < -1 || scaledSettings.rect.y + scaledSettings.rect.height > height + 1 || !scaledSettings.close || scaledSettings.close.x + scaledSettings.close.width > width + 1 || scaledSettings.overflow > 1 || scaledSettings.value !== '250') failures.push(`Settings does not remain contained or restore 250% text at 320px: ${JSON.stringify(scaledSettings)}`);
      await page.evaluate(() => { localStorage.setItem('spotfinder_text_scale_v1', '100'); document.documentElement.style.fontSize = '100%'; document.documentElement.dataset.sfTextScale = 'standard'; });
    }

    if (width === 1024) {
      await page.evaluate(() => document.querySelector('button[aria-label="Open settings"]')?.click());
      await page.waitForTimeout(50);
      const box = await page.evaluate(() => {
        const element = document.querySelector('[role="dialog"] section');
        const rect = element?.getBoundingClientRect();
        const style = element && getComputedStyle(element);
        return rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height, maxHeight: style.maxHeight, rootSize: getComputedStyle(document.documentElement).fontSize, className: element.className };
      });
      if (!box || box.width > width + 1 || box.height > height + 1) failures.push(`Settings dialog exceeds 1024x768 viewport: ${JSON.stringify(box)}`);
      await page.keyboard.press('Escape');
    }

    if (width === 844 && height === 390) {
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
          getCurrentPosition: success => success({ coords: { latitude: 50.0755, longitude: 14.4378, accuracy: 10 } }),
          watchPosition: () => 1,
          clearWatch: () => {},
        } });
        document.querySelector('button[aria-label="Nearby spots filters"]')?.click();
      });
      await page.waitForTimeout(100);
      const landscapeFilter = await page.evaluate(() => {
        const card = document.querySelector('.sf-nearby-filter-card')?.getBoundingClientRect();
        const toolbar = document.querySelector('button[aria-label="Open settings"]')?.closest('.absolute.bottom-0')?.getBoundingClientRect();
        const settings = document.querySelector('button[aria-label="Open settings"]')?.getBoundingClientRect();
        const hitElement = settings && document.elementFromPoint(settings.x + settings.width / 2, settings.y + settings.height / 2);
        const hit = hitElement?.closest('button')?.getAttribute('aria-label');
        return { card: card && { top: card.top, bottom: card.bottom, left: card.left, right: card.right }, toolbarTop: toolbar?.top, settings: settings && { x: settings.x, y: settings.y, width: settings.width, height: settings.height }, hit, hitElement: hitElement && { tag: hitElement.tagName, className: hitElement.getAttribute('class'), ariaLabel: hitElement.getAttribute('aria-label') } };
      });
      if (!landscapeFilter.card || landscapeFilter.card.bottom > (landscapeFilter.toolbarTop ?? height) + 1 || landscapeFilter.card.left < -1 || landscapeFilter.card.right > width + 1) failures.push(`Nearby filter does not fit landscape: ${JSON.stringify(landscapeFilter)}`);
      if (landscapeFilter.hit !== 'Open settings') failures.push(`Bottom toolbar is blocked while Nearby filters are open: ${JSON.stringify(landscapeFilter)}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Responsive audit passed for ${viewports.map(v => v.join('x')).join(', ')}.`);
}
