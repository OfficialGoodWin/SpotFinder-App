async (page) => {
  await page.setViewportSize({width: 320, height: 568});
  const cookie = page.getByRole('button', {name: 'Keep optional services off'});
  if (await cookie.count()) await cookie.click();
  const intro = page.getByRole('button', {name: 'Dismiss introduction'});
  if (await intro.count()) await intro.click();
  await page.getByRole('button', {name: 'More map options'}).click();
  await page.getByRole('button', {name: 'Settings', exact: true}).click();
  const slider = page.getByRole('slider', {name:'Text size percentage'});
  await slider.focus(); await slider.press('End');
  for (let i = 0; i < 10; i++) await slider.press('ArrowLeft');
  await page.getByRole('link', {name: /What's new/}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'audit/spotfinder-quality/batch1/settings-320-200-final.png'});
  const layout = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const text = dialog.querySelector('a[href="/updates"] > .flex-1');
    const r = text.getBoundingClientRect();
    return {scale:document.querySelector('#text-size').value, releaseTextWidth:Math.round(r.width), viewport:innerWidth,
      overflow:[...dialog.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > innerWidth+1).length};
  });
  return layout;
}
