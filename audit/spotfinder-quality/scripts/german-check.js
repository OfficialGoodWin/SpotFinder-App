async page => {
  await page.getByRole('combobox',{name:'Vyberte jazyk'}).click();
  await page.getByRole('option',{name:/Deutsch · Partial/}).first().click();
  await page.screenshot({path:'audit/spotfinder-quality/screenshots/settings-german.png'});
  return (await page.locator('body').ariaSnapshot()).slice(0,7800);
}
