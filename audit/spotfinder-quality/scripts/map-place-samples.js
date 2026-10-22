async page => {
  await page.setViewportSize({width:1366,height:768});
  const out={};
  for(const [query,key] of [['Prague Castle','city'],['Turnov','town']]){
    await page.goto('https://spot-finder-app.vercel.app/',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1000);
    const intro=page.getByRole('button',{name:'Dismiss introduction'});if(await intro.isVisible())await intro.click();
    const search=page.getByRole('textbox',{name:'Search places and community spots'});
    await search.fill(query);
    await page.waitForTimeout(3500);
    const buttons=page.getByRole('button',{name:new RegExp('^'+query)});
    const count=await buttons.count();
    if(count) await buttons.first().click();
    await page.waitForTimeout(2500);
    await page.screenshot({path:`audit/spotfinder-quality/screenshots/map-${key}-selected.png`});
    out[key]={url:page.url(),count,snapshot:(await page.locator('body').ariaSnapshot()).slice(0,7000)};
  }
  return out;
}
