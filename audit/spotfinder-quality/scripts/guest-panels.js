async page => {
  const base = 'https://spot-finder-app.vercel.app/';
  const results = {};
  async function inspect(key, buttonName) {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const intro = page.getByRole('button', { name: 'Dismiss introduction' });
    if (await intro.isVisible()) await intro.click();
    await page.getByRole('button', { name: buttonName }).click();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `audit/spotfinder-quality/screenshots/${key}-desktop.png` });
    results[key] = { url: page.url(), snapshot: (await page.locator('body').ariaSnapshot()).slice(0, 6500) };
  }
  for (const [key, button] of [
    ['layers', 'Map layers'],
    ['nearby', 'Open nearby spots filters'],
    ['settings', 'Open settings'],
  ]) {
    try { await inspect(key, button); }
    catch (error) { results[key] = { error: String(error) }; }
  }
  return results;
}
