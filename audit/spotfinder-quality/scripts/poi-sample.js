async page => {
  await page.mouse.click(254,94);
  await page.waitForTimeout(1300);
  await page.screenshot({path:'audit/spotfinder-quality/screenshots/poi-detail-rural.png'});
  return {url:page.url(),snapshot:(await page.locator('body').ariaSnapshot()).slice(0,9000)};
}
