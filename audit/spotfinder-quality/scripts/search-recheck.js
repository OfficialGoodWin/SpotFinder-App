async page => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('https://spot-finder-app.vercel.app/', {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1200);
  const intro=page.getByRole('button',{name:'Dismiss introduction'});
  if(await intro.isVisible()) await intro.click();
  const search=page.getByRole('textbox',{name:'Search places and community spots'});
  await search.fill('Prague Castle');
  await page.waitForTimeout(6000);
  await page.screenshot({path:'audit/spotfinder-quality/screenshots/search-mobile-after-wait.png',fullPage:true});
  const first=(await page.locator('body').ariaSnapshot()).slice(0,7000);
  await search.fill('zzzznotaplace123456');
  await page.waitForTimeout(4500);
  await page.screenshot({path:'audit/spotfinder-quality/screenshots/search-no-results-mobile.png',fullPage:true});
  const second=(await page.locator('body').ariaSnapshot()).slice(0,7000);
  return {first,second};
}
