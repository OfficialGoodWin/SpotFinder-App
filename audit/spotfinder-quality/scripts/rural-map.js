async page => {
  const search=page.getByRole('textbox',{name:'Search places and community spots'});
  await search.fill('Hrubá Skála');
  await page.waitForTimeout(3500);
  const before=(await page.locator('body').ariaSnapshot()).slice(0,4000);
  const matches=page.getByRole('button',{name:/^Hrubá Skála/});
  if(await matches.count()) await matches.first().click();
  await page.waitForTimeout(5500);
  await page.screenshot({path:'audit/spotfinder-quality/screenshots/map-rural-hruba-skala.png'});
  return {matches:await matches.count(),before,after:(await page.locator('body').ariaSnapshot()).slice(0,4000)};
}
