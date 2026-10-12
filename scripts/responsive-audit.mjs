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
    }

    if (width === 1024) {
      await page.evaluate(() => document.querySelector('button[aria-label="Open settings"]')?.click());
      await page.waitForTimeout(50);
      const box = await page.evaluate(() => {
        const rect = document.querySelector('[role="dialog"] section')?.getBoundingClientRect();
        return rect && { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      if (!box || box.width > width + 1 || box.height > height + 1) failures.push('Settings dialog exceeds 1024x768 viewport');
      await page.keyboard.press('Escape');
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
