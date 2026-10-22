async (page) => {
  await page.route('**/nominatim/search?*', async route => route.fulfill({json:[]}));
  await page.route('**/v1/suggest?*', async route => route.fulfill({status:503,body:'Unavailable'}));
  const search=page.locator('[data-spotfinder-search]');
  await search.fill('partialoutage');
  await page.getByText('Search is temporarily unavailable.').waitFor({timeout:10000});
  const partialOutageShown=await page.getByText('Search is temporarily unavailable.').isVisible();
  const falseEmptyShown=await page.getByText('No places found. Try another search.').count()>0;
  await page.route('**/nominatim/search?*', async route => route.fulfill({json:[
    {place_id:3,osm_type:'node',osm_id:3,name:'Partial Result',display_name:'Partial Result, Czechia',lat:'50.0755',lon:'14.4378'}
  ]}));
  await search.fill('partialresult');
  await page.getByText('Partial Result',{exact:true}).waitFor({timeout:10000});
  return {partialOutageShown,falseEmptyShown,usableProviderResult:await page.getByText('Partial Result',{exact:true}).isVisible()};
}
