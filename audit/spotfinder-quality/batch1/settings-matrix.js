async (page) => {
  const sizes = [[320, 568], [375, 667], [390, 844], [430, 932], [1366, 768]];
  const scales = [100, 150, 200, 250];
  const rows = [];
  const slider = page.getByRole('slider', { name: 'Text size percentage' });
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const scale of scales) {
      await slider.focus();
      await slider.press('Home');
      if (scale === 250) await slider.press('End');
      else for (let step = 75; step < scale; step += 5) await slider.press('ArrowRight');
      const row = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const body = dialog.querySelector('.overflow-y-auto');
        const viewport = document.documentElement.clientWidth;
        const offenders = [...dialog.querySelectorAll('*')].filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > viewport + 1 || r.left < -1);
        });
        return { width: viewport, scale: Number(document.querySelector('#text-size').value), overflowCount: offenders.length,
          maxRight: Math.round(Math.max(...[...dialog.querySelectorAll('.sf-section')].map(el => el.getBoundingClientRect().right))),
          scrollable: body.scrollHeight > body.clientHeight, bottomReachable: (() => { body.scrollTop = body.scrollHeight; return body.scrollTop + body.clientHeight >= body.scrollHeight - 1; })() };
      });
      rows.push(row);
      if ((width === 320 && scale === 200) || (width === 390 && scale === 100)) {
        await page.screenshot({ path: `audit/spotfinder-quality/batch1/settings-${width}-${scale}.png` });
      }
    }
  }
  return rows;
}
