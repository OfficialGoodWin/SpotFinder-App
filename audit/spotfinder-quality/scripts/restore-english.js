async page => {
  await page.getByRole('combobox',{name:'Sprache auswählen'}).click();
  await page.getByRole('option',{name:/English \(US\)/}).click();
  await page.getByRole('switch',{name:'Dark Mode'}).click();
  return {lang:await page.getByRole('combobox',{name:'Select Language'}).innerText(),root:await page.evaluate(()=>document.documentElement.className)};
}
