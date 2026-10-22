async (page) => {
  await page.context().addCookies([{name:'spotfinder_language',value:'en',url:'http://127.0.0.1:5173/'}]);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => localStorage.setItem('spotfinder_text_scale_v1','100'));
  await page.reload();
  const tiles=[];
  page.on('request', request => {if (request.url().includes('tiles.openfreemap.org/planet/')) tiles.push(request.url());});
  await page.route('**/nominatim/search?*', async route => route.fulfill({json:[
    {place_id:2,osm_type:'node',osm_id:2,name:'Vienna',display_name:'Vienna, Austria',lat:'48.2082',lon:'16.3738'}
  ]}));
  await page.route('**/v1/suggest?*', async route => route.fulfill({json:{items:[]}}));
  const search=page.locator('[data-spotfinder-search]');
  await search.fill('Vienna');
  await page.getByText('Austria',{exact:true}).waitFor({timeout:10000});
  await page.getByRole('button',{name:/Vienna Austria/}).first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({path:'audit/spotfinder-quality/batch1/search-selected-vienna.png'});
  return {selected:await search.inputValue(),zoom:await page.locator('[aria-hidden="true"]').filter({hasText:/^\d+$/}).first().textContent(),
    tileRequests:tiles.filter(url=>/\/15\//.test(url)).slice(0,5)};
}
