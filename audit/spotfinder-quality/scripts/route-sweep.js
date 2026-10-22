async page => {
  const base = 'https://spot-finder-app.vercel.app';
  const paths = ['/', '/FAQ', '/Status', '/updates', '/PrivacyPolicy', '/TermsAndConditions', '/CookiePolicy', '/RefundPolicy', '/news', '/news/five-places-near-prague', '/spot/AIyFTk1eTE7gD5INyomX', '/Admin', '/StatusAdmin', '/definitely-not-a-route'];
  const captures = new Set(['/FAQ', '/Status', '/updates', '/TermsAndConditions', '/news', '/definitely-not-a-route']);
  const results = [];
  for (const path of paths) {
    try {
      const response = await page.goto(base + path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(path === '/' || path.startsWith('/spot/') ? 1800 : 700);
      if (captures.has(path)) await page.screenshot({ path: `audit/spotfinder-quality/screenshots/route-${path.slice(1).replaceAll('/', '-') || 'home'}.png`, fullPage: true });
      const pageData = await page.evaluate(() => ({
        title: document.title,
        h1: [...document.querySelectorAll('h1')].map(node => node.textContent.trim()).slice(0, 3),
        mainText: document.querySelector('main')?.textContent.trim().slice(0, 260) || '',
        canonical: document.querySelector('link[rel="canonical"]')?.href || '',
        robots: document.querySelector('meta[name="robots"]')?.content || '',
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      }));
      results.push({ path, status: response?.status(), url: page.url(), ...pageData });
    } catch (error) { results.push({ path, error: String(error) }); }
  }
  return results;
}
