async page => {
  const base = 'https://spot-finder-app.vercel.app/';
  const results = {};
  async function reset() {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const intro = page.getByRole('button', { name: 'Dismiss introduction' });
    if (await intro.isVisible()) await intro.click();
  }
  async function capture(key) {
    await page.waitForTimeout(1700);
    await page.screenshot({ path: `audit/spotfinder-quality/screenshots/${key}-desktop.png` });
    results[key] = { url: page.url(), snapshot: (await page.locator('body').ariaSnapshot()).slice(0, 8000) };
  }
  try {
    await reset();
    await page.getByRole('textbox', { name: 'Search places and community spots' }).fill('Prague Castle');
    await capture('search-results');
  } catch (error) { results.search = { error: String(error) }; }
  for (const [key, name] of [
    ['add-spot', 'Add a spot'],
    ['drafts', 'Drafts'],
    ['sign-in', 'Sign in'],
  ]) {
    try {
      await reset();
      await page.getByRole('button', { name }).click();
      await capture(key);
    } catch (error) { results[key] = { error: String(error) }; }
  }
  return results;
}
