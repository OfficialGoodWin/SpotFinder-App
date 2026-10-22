async page => {
  await page.setViewportSize({width:1366,height:768});
  await page.goto('https://spot-finder-app.vercel.app/',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1000);
  const intro=page.getByRole('button',{name:'Dismiss introduction'}); if(await intro.isVisible()) await intro.click();
  await page.getByRole('button',{name:'Open settings'}).click();
  const snapshot=(await page.locator('body').ariaSnapshot()).slice(0,9000);
  const controls=await page.evaluate(()=>[...document.querySelectorAll('[role="switch"],select,input[type="range"]')].map(e=>({html:e.outerHTML.slice(0,400),value:e.value})));
  return {snapshot,controls};
}
