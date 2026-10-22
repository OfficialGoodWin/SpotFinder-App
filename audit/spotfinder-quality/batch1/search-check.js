async (page) => {
  await page.setViewportSize({width:390,height:844});
  let failure = false;
  const calls = [];
  const item = q => ({place_id: 1, osm_type:'node', osm_id:1, name:q === 'fastnext' ? 'Fast Result' : 'Prague', display_name:'Prague, Czechia', lat:'50.0755', lon:'14.4378'});
  await page.route('**/nominatim/search?*', async route => {
    const q = new URL(route.request().url()).searchParams.get('q');
    calls.push({provider:'osm',q});
    if (q === 'slowfirst') await new Promise(resolve => setTimeout(resolve, 700));
    if (failure) await route.fulfill({status:503,body:'Unavailable'});
    else await route.fulfill({json: ['Prague','fastnext','retrycase'].includes(q) ? [item(q)] : []});
  });
  await page.route('**/v1/suggest?*', async route => {
    const q = new URL(route.request().url()).searchParams.get('query');
    calls.push({provider:'mapy',q});
    if (failure) await route.fulfill({status:503,body:'Unavailable'});
    else await route.fulfill({json:{items:[]}});
  });
  const search = page.getByRole('textbox',{name:'Search places and community spots'});
  await search.fill('Prague');
  await page.getByText('Czechia', {exact:true}).waitFor({timeout:10000});
  await page.screenshot({path:'audit/spotfinder-quality/batch1/search-results.png'});
  const found = await page.getByText('Czechia', {exact:true}).count();
  await search.fill('zzzznotaplace123456');
  await page.getByText('No places found. Try another search.').waitFor({timeout:10000});
  await page.screenshot({path:'audit/spotfinder-quality/batch1/search-empty.png'});
  const empty = await page.getByText('No places found. Try another search.').count();
  await search.fill('');
  const emptyInputNeutral = await page.getByText('No places found. Try another search.').count() === 0;
  failure = true;
  await search.fill('retrycase');
  await page.getByText('Search is temporarily unavailable.').waitFor({timeout:10000});
  await page.screenshot({path:'audit/spotfinder-quality/batch1/search-failure.png'});
  failure = false;
  await page.getByRole('button',{name:'Retry'}).click();
  await page.getByText('Czechia', {exact:true}).waitFor({timeout:10000});
  const retryWorked = await page.getByText('Search is temporarily unavailable.').count() === 0;
  await search.fill('slowfirst');
  await page.waitForTimeout(450);
  await search.fill('fastnext');
  await page.getByText('Fast Result').waitFor({timeout:10000});
  await page.waitForTimeout(850);
  const staleAbsent = await page.getByText('Prague', {exact:true}).count() === 0;
  await page.getByRole('button',{name:/Fast Result/}).first().click();
  const selected = await search.inputValue();
  return {found,empty,emptyInputNeutral,retryWorked,staleAbsent,selected,calls};
}
