async page => {
  await page.getByRole('button', { name: 'View Blejski grad photo full screen' }).click();
  await page.screenshot({ path: 'audit/spotfinder-quality/screenshots/spot-photo-fullscreen-desktop.png' });
  return { url: page.url(), snapshot: await page.locator('body').ariaSnapshot() };
}
