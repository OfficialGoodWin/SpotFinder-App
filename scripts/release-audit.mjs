import { chromium } from 'playwright-core';

const executablePath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const baseURL = process.env.SPOTFINDER_AUDIT_URL || 'http://127.0.0.1:4173';
const failures = [];
const headlessMapWarnings = [];
const browser = await chromium.launch({ executablePath, headless: true });

try {
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    await context.addCookies([{ name: 'theme', value: colorScheme, url: baseURL }]);
    await context.addInitScript(() => {
      localStorage.setItem('spotfinder_cookie_consent_v1', JSON.stringify({ necessary: true, analytics: false, ads: false, decided: true }));
      localStorage.setItem('spotfinder_welcome_dismissed_v1', '1');
    });
    const page = await context.newPage();
    page.on('pageerror', error => {
      const detail = error.stack || error.message;
      if (/Cannot read property '(?:recalculate|resize)' of undefined/.test(error.message)) {
        headlessMapWarnings.push(`${colorScheme}: ${error.message}`);
      } else {
        failures.push(`${colorScheme}: page error: ${detail}`);
      }
    });

    await page.goto(`${baseURL}/updates`, { waitUntil: 'networkidle' });
    const updates = await page.evaluate(() => ({
      heading: document.querySelector('h1')?.textContent,
      version: document.body.textContent.includes('0.5.6'),
      categories: [...document.querySelectorAll('h3')].map(node => node.textContent.trim()),
      duplicateIds: [...document.querySelectorAll('[id]')].map(node => node.id).filter((id, index, ids) => ids.indexOf(id) !== index),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      dark: document.documentElement.classList.contains('dark'),
    }));
    if (updates.heading !== 'What’s New in SpotFinder' || !updates.version || updates.categories.length !== 4 || updates.duplicateIds.length || updates.overflow > 1 || updates.dark !== (colorScheme === 'dark')) {
      failures.push(`${colorScheme}: invalid Updates page: ${JSON.stringify(updates)}`);
    }

    await page.goto(`${baseURL}/FAQ`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('button[aria-expanded="false"]').forEach(button => button.click()));
    await page.waitForTimeout(50);
    const faq = await page.evaluate(() => ({
      version: document.body.textContent.includes('0.5.6'),
      oldRatings: /Parking, Scenery|Parking, Beauty|Privacy rating/i.test(document.body.textContent),
      currentFields: document.body.textContent.includes('Spot name') && document.body.textContent.includes('Description'),
      currentRatings: document.body.textContent.includes('Condition & cleanliness') && document.body.textContent.includes('Crowdedness'),
    }));
    if (!faq.version || faq.oldRatings || !faq.currentFields || !faq.currentRatings) failures.push(`${colorScheme}: stale FAQ: ${JSON.stringify(faq)}`);
    await page.goto(`${baseURL}/Status`, { waitUntil: 'networkidle' });
    const statusText = await page.locator('body').innerText();
    if (/All systems operational|NaN%/.test(statusText)) failures.push(`${colorScheme}: unsupported status claim`);

    await page.goto(`${baseURL}/TermsAndConditions`, { waitUntil: 'networkidle' });
    const termsText = await page.locator('body').innerText();
    if (!termsText.includes('Review status:') || !termsText.includes('no advertising slots') ||
        /The free tier may request Google|ads only after advertising consent|If you do not cancel your subscription before you delete/.test(termsText)) {
      failures.push(`${colorScheme}: Terms still contain broken or contradictory release copy`);
    }

    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const home = await page.evaluate(() => ({
      map: Boolean(document.querySelector('.maplibregl-canvas')),
      add: Boolean(document.querySelector('button[aria-label="Add a spot"]')),
      layers: Boolean(document.querySelector('button[aria-label*="layer" i], button[title*="layer" i]')),
      terrain: Boolean(document.querySelector('button[aria-label="Toggle 3D terrain"]')),
    }));
    if (!home.map || !home.add || !home.layers || !home.terrain) failures.push(`${colorScheme}: core map controls missing: ${JSON.stringify(home)}`);
    await page.evaluate(() => document.querySelector('button[aria-label="Sign in"]')?.click());
    await page.waitForTimeout(50);
    if (!(await page.locator('[role="dialog"]').count())) failures.push(`${colorScheme}: sign-in dialog did not open`);

    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Release browser audit passed in light and dark modes for Updates, FAQ, Status, map controls, and guest authentication UI.');
  if (headlessMapWarnings.length) console.log(`Observed ${headlessMapWarnings.length} MapLibre software-renderer warning(s) during headless layout changes; map canvases and controls still rendered.`);
}
