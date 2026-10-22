async page => {
  await page.setViewportSize({width:320,height:568});
  await page.goto('https://spot-finder-app.vercel.app/',{waitUntil:'domcontentloaded'});
  const intro=page.getByRole('button',{name:'Dismiss introduction'});if(await intro.isVisible())await intro.click();
  await page.getByRole('button',{name:'More map options'}).click();
  const snap=(await page.locator('body').ariaSnapshot()).slice(-4000);
  return snap;
}
