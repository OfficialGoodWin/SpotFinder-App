async page => {
  await page.setViewportSize({width:390,height:844});
  const results={};
  async function home(){
    await page.goto('https://spot-finder-app.vercel.app/',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1200);
    const intro=page.getByRole('button',{name:'Dismiss introduction'});
    if(await intro.isVisible()) await intro.click();
  }
  await home();
  await page.getByRole('button',{name:'Open nearby spots filters'}).click();
  results.nearby=(await page.locator('body').ariaSnapshot()).slice(0,7000);
  await page.screenshot({path:'audit/spotfinder-quality/screenshots/nearby-mobile.png',fullPage:true});
  await home();
  await page.getByRole('button',{name:'Add a spot'}).click();
  await page.locator('.maplibregl-canvas').click({position:{x:180,y:350}});
  await page.waitForTimeout(1200);
  results.create=(await page.locator('body').ariaSnapshot()).slice(0,9000);
  await page.screenshot({path:'audit/spotfinder-quality/screenshots/create-spot-mobile.png',fullPage:true});
  await home();
  await page.getByRole('button',{name:'Open Blejski grad'}).click();
  await page.waitForTimeout(500);
  results.spot=(await page.locator('body').ariaSnapshot()).slice(0,9000);
  await page.screenshot({path:'audit/spotfinder-quality/screenshots/spot-mobile.png',fullPage:true});
  return results;
}
