async page => {
  return await page.evaluate(()=>{
    const dialog=document.querySelector('[role="dialog"]');
    const targets=[dialog,...dialog.querySelectorAll('h2,h3,button,input,[role="switch"],[role="combobox"]')];
    return targets.slice(0,35).map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,text:(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,45),x:Math.round(r.x),right:Math.round(r.right),width:Math.round(r.width),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,overflowX:getComputedStyle(el).overflowX};});
  });
}
