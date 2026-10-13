import { chromium } from 'playwright-core';

const executablePath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const baseURL = process.env.SPOTFINDER_AUDIT_URL || 'http://127.0.0.1:4173';
const consentKey = 'spotfinder_cookie_consent_v1';
const blockedProviderPattern = /(?:google-analytics\.com|analytics\.google\.com|googletagmanager\.com|googlesyndication\.com|doubleclick\.net|adtrafficquality\.google)/i;
const routes = [
  '/', '/FAQ', '/Status', '/updates', '/Admin', '/StatusAdmin',
  '/PrivacyPolicy', '/CookiePolicy', '/TermsAndConditions', '/RefundPolicy',
];
const scenarios = [
  { name: 'new visitor', stored: null },
  { name: 'previous analytics acceptance', stored: { necessary: true, analytics: true, ads: false, decided: true } },
  { name: 'previous rejection', stored: { necessary: true, analytics: false, ads: false, decided: true } },
  { name: 'previous advertising acceptance', stored: { necessary: true, analytics: false, ads: true, decided: true } },
];

const browser = await chromium.launch({ executablePath, headless: true });
const failures = [];
const observedGoogleHosts = new Set();

try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.addInitScript(({ key, stored }) => {
      localStorage.clear();
      if (stored) localStorage.setItem(key, JSON.stringify(stored));
      document.cookie = '_ga=legacy; path=/';
      document.cookie = '_ga_TEST=legacy; path=/';
      document.cookie = '__gads=legacy; path=/';
    }, { key: consentKey, stored: scenario.stored });

    const page = await context.newPage();
    page.on('request', request => {
      const url = request.url();
      if (blockedProviderPattern.test(url)) failures.push(`${scenario.name}: prohibited request ${url}`);
      try {
        const host = new URL(url).hostname;
        if (host.includes('google') || host.includes('gstatic') || host.includes('firebase')) observedGoogleHosts.add(host);
      } catch {
        // Ignore non-URL browser requests.
      }
    });

    for (const route of routes) {
      await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(150);
      const state = await page.evaluate(() => ({
        gtagType: typeof window.gtag,
        adsType: typeof window.adsbygoogle,
        scripts: [...document.scripts].map(script => script.src).filter(Boolean),
        adSlots: document.querySelectorAll('ins.adsbygoogle, [data-ad-client], [data-ad-slot]').length,
        cookies: document.cookie,
      }));
      if (state.gtagType !== 'undefined') failures.push(`${scenario.name} ${route}: window.gtag exists`);
      if (state.adsType !== 'undefined') failures.push(`${scenario.name} ${route}: window.adsbygoogle exists`);
      if (state.scripts.some(url => blockedProviderPattern.test(url))) failures.push(`${scenario.name} ${route}: prohibited script element exists`);
      if (state.adSlots) failures.push(`${scenario.name} ${route}: ${state.adSlots} ad slot(s) exist`);
      if (/(?:^|;\s*)(?:_ga(?:_|=)|__gads=|__gpi=|__eoi=)/.test(state.cookies)) failures.push(`${scenario.name} ${route}: legacy analytics/ad cookie remains`);
    }

    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.mouse.click(400, 300);
    await page.reload({ waitUntil: 'networkidle', timeout: 30_000 });
    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Privacy network audit passed: ${scenarios.length} clean-session states × ${routes.length} routes, plus home interaction/reload.`);
  console.log(`Observed essential/other Google-family hosts: ${[...observedGoogleHosts].sort().join(', ') || 'none'}`);
}
