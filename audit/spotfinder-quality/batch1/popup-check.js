async (page) => {
  const result = await page.evaluate(async () => {
    const {createTrafficPopupContent, createAdminPoiPopupContent} = await import('/src/lib/mapPopupContent.js');
    const special = '<example> & "quoted text"';
    const traffic = createTrafficPopupContent('works', {roadNumbers:[special], from:special, to:special});
    const admin = createAdminPoiPopupContent({name:special, houseNumber:special, street:special, city:special, postcode:special},
      {key:'custom',name:special,color:'red; background:url(javascript:alert(1))'});
    const panel = document.createElement('div');
    panel.id = 'popup-test-evidence';
    panel.style.cssText = 'position:fixed;left:12px;top:90px;z-index:9999;background:white;padding:12px;max-width:290px;border:1px solid #aaa';
    panel.append(traffic, document.createElement('hr'), admin);
    document.body.append(panel);
    return {trafficLiteral:traffic.textContent.includes(special), adminLiteral:admin.textContent.includes(special),
      interpretedElements:panel.querySelectorAll('example').length, safeColor:admin.firstElementChild.style.color,
      trafficRows:traffic.children.length, adminRows:admin.children.length};
  });
  await page.screenshot({path:'audit/spotfinder-quality/batch1/popup-literal-text.png'});
  await page.evaluate(() => document.querySelector('#popup-test-evidence').remove());
  return result;
}
