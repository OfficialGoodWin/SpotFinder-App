async page => {
  const sizes = [[320,568],[375,667],[390,844],[430,932],[768,1024],[1024,768],[1366,768],[1920,1080]];
  const results = [];
  for (const [width,height] of sizes) {
    await page.setViewportSize({width,height});
    await page.goto('https://spot-finder-app.vercel.app/', {waitUntil:'domcontentloaded'});
    await page.waitForTimeout(1500);
    if ([320,390,768,1024].includes(width)) await page.screenshot({path:`audit/spotfinder-quality/screenshots/map-${width}x${height}.png`,fullPage:true});
    const data = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      width: innerWidth,
      heading: document.querySelector('h1')?.textContent?.trim() || '',
      buttons: [...document.querySelectorAll('button')].filter(el => { const r=el.getBoundingClientRect(); return r.width && r.height && r.left < innerWidth && r.top < innerHeight && r.right > 0 && r.bottom > 0; }).map(el => ({name:el.getAttribute('aria-label') || el.textContent.trim().slice(0,30), width:Math.round(el.getBoundingClientRect().width), height:Math.round(el.getBoundingClientRect().height)})).slice(0,30)
    }));
    results.push({viewport:`${width}x${height}`,...data});
  }
  return results;
}
