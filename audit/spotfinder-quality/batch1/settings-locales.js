async (page) => {
  const checks=[];
  await page.setViewportSize({width:320,height:568});
  for (const lang of ['cs','de']) {
    await page.context().addCookies([{name:'spotfinder_language',value:lang,url:'http://127.0.0.1:5173/'}]);
    await page.reload();
    await page.getByRole('button',{name:/More map options|Další možnosti mapy|Weitere Kartenoptionen/}).click();
    await page.getByRole('button',{name:/^Settings$|^Nastavení$|^Einstellungen$/}).click();
    const slider=page.locator('#text-size');
    await slider.focus(); await slider.press('End');
    for (let i=0;i<10;i++) await slider.press('ArrowLeft');
    const metrics=await page.evaluate(() => {
      const dialog=document.querySelector('[role="dialog"]');
      return {overflow:[...dialog.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).length,
        scale:document.querySelector('#text-size').value, comboboxWidth:Math.round(dialog.querySelector('[role="combobox"]').getBoundingClientRect().width)};
    });
    checks.push({lang,...metrics});
  }
  return checks;
}
