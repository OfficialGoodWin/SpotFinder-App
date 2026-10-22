async page => {
  await page.getByRole('switch',{name:'Dark Mode'}).click();
  await page.screenshot({path:'audit/spotfinder-quality/screenshots/settings-dark.png'});
  const dark=await page.evaluate(()=>({rootClass:document.documentElement.className,checked:document.querySelector('[aria-label="Dark Mode"]')?.getAttribute('aria-checked')}));
  await page.getByRole('combobox',{name:'Select Language'}).click();
  const langMenu=(await page.locator('body').ariaSnapshot()).slice(-7000);
  return {dark,langMenu};
}
