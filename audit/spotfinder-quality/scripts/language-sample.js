async page => {
  const result={};
  await page.getByRole('option',{name:/Čeština/}).click();
  result.czech=(await page.locator('body').ariaSnapshot()).slice(0,7800);
  await page.screenshot({path:'audit/spotfinder-quality/screenshots/settings-czech.png'});
  await page.getByRole('combobox',{name:/Select Language|Vybrat jazyk|Jazyk/}).click();
  await page.getByRole('option',{name:/Deutsch · Partial/}).click();
  result.german=(await page.locator('body').ariaSnapshot()).slice(0,7800);
  await page.screenshot({path:'audit/spotfinder-quality/screenshots/settings-german.png'});
  return result;
}
