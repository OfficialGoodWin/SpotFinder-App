async page => {
  await page.setViewportSize({width:320,height:568});
  const slider=page.getByRole('slider',{name:'Text size percentage'});
  await slider.focus();
  await slider.press('End');
  for(let i=0;i<10;i++) await slider.press('ArrowLeft');
  await page.waitForTimeout(500);
  const data=await page.evaluate(()=>({slider:document.querySelector('#text-size')?.value,overflow:document.documentElement.scrollWidth>innerWidth,scrollWidth:document.documentElement.scrollWidth,width:innerWidth}));
  await page.screenshot({path:'audit/spotfinder-quality/screenshots/settings-200pct-320.png',fullPage:true});
  return {data,snapshot:(await page.locator('body').ariaSnapshot()).slice(-5500)};
}
