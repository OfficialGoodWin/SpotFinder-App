async (page) => {
  const checks = [];
  for (const [lang, message] of [
    ['cs','Žádná místa nenalezena. Zkuste jiné hledání.'],
    ['de','Keine Orte gefunden. Versuchen Sie eine andere Suche.'],
  ]) {
    await page.context().addCookies([{name:'spotfinder_language',value:lang,url:'http://127.0.0.1:5173/'}]);
    await page.reload();
    const search = page.locator('[data-spotfinder-search]');
    await search.fill('zzzznotaplace123456');
    await page.getByText(message).waitFor({timeout:10000});
    checks.push({lang, htmlLang:await page.locator('html').getAttribute('lang'), messageVisible:await page.getByText(message).isVisible()});
  }
  return checks;
}
