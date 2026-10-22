async (page) => {
  await page.reload();
  const cookie=page.getByRole('button',{name:'Keep optional services off'});
  if (await cookie.count()) await cookie.click();
  const intro=page.getByRole('button',{name:'Dismiss introduction'});
  if (await intro.count()) await intro.click();
  await page.evaluate(async () => {
    const {mountPopupFixture}=await import('/audit/spotfinder-quality/batch1/popup-map-fixture.js');
    window.__popupFixture=await mountPopupFixture();
  });
  await page.getByRole('button',{name:'Traffic fixture'}).click();
  const trafficVisible=await page.locator('.maplibregl-popup-content').getByText('<example> & "quoted text"',{exact:false}).count()>0;
  await page.screenshot({path:'audit/spotfinder-quality/batch1/traffic-popup-open.png'});
  await page.locator('.maplibregl-popup-close-button').click();
  const trafficClosed=await page.locator('.maplibregl-popup').count()===0;
  await page.getByRole('button',{name:'Admin fixture'}).click();
  const adminVisible=(await page.locator('.maplibregl-popup-content').textContent()).includes('<example> & "quoted text"');
  const parsed=await page.locator('.maplibregl-popup-content example').count();
  await page.screenshot({path:'audit/spotfinder-quality/batch1/admin-popup-open.png'});
  await page.locator('.maplibregl-popup-close-button').click();
  const adminClosed=await page.locator('.maplibregl-popup').count()===0;
  return {trafficVisible,trafficClosed,adminVisible,adminClosed,interpretedElements:parsed};
}
