async (page) => {
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => localStorage.setItem('spotfinder_text_scale_v1','100'));
  await page.reload();
  await page.getByRole('button',{name:'More map options'}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.screenshot({path:'audit/spotfinder-quality/batch1/settings-390-100-final.png'});
  return {dialogVisible:await page.getByRole('dialog').isVisible(),scale:await page.locator('#text-size').inputValue()};
}
