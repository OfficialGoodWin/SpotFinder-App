async (page) => {
  const zoomLabel = () => page.locator('[aria-hidden="true"]').filter({hasText:/^\d+$/}).first().textContent();
  const before = await zoomLabel();
  await page.getByRole('button',{name:'Zoom in'}).click();
  await page.waitForTimeout(350);
  const afterZoom = await zoomLabel();
  const map = page.getByRole('region',{name:'Map'});
  const bounds = await map.boundingBox();
  if (bounds) {
    const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
    await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x+60,y+30,{steps:5}); await page.mouse.up();
  }
  await page.getByRole('button',{name:'Open nearby spots filters'}).click();
  const nearbyOpen = await page.getByText('Maximum distance').count() > 0;
  await page.screenshot({path:'audit/spotfinder-quality/batch1/nearby-mobile.png'});
  return {before,afterZoom,dragGestureSent:!!bounds,nearbyOpen, mapVisible:await map.isVisible()};
}
