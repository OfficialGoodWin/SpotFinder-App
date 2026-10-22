async page => {
  await page.addInitScript(() => {
    window.__auditMetrics={lcp:0,cls:0,longTasks:0};
    try {new PerformanceObserver(list=>{for(const e of list.getEntries()) window.__auditMetrics.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});}catch{}
    try {new PerformanceObserver(list=>{for(const e of list.getEntries()) if(!e.hadRecentInput) window.__auditMetrics.cls+=e.value;}).observe({type:'layout-shift',buffered:true});}catch{}
    try {new PerformanceObserver(list=>{window.__auditMetrics.longTasks+=list.getEntries().length;}).observe({type:'longtask',buffered:true});}catch{}
  });
  const samples=[];
  for(let i=0;i<2;i++){
    const start=Date.now();
    await page.goto('https://spot-finder-app.vercel.app/',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(5500);
    samples.push(await page.evaluate(elapsed=>{
      const n=performance.getEntriesByType('navigation')[0];
      const resources=performance.getEntriesByType('resource');
      return {elapsedMs:elapsed,domContentLoadedMs:Math.round(n.domContentLoadedEventEnd),loadMs:Math.round(n.loadEventEnd),lcpMs:Math.round(window.__auditMetrics.lcp),cls:Math.round(window.__auditMetrics.cls*1000)/1000,longTasks:window.__auditMetrics.longTasks,resources:resources.length,jsResources:resources.filter(r=>r.name.includes('.js')).length,pmtilesRequests:resources.filter(r=>r.name.includes('ambient-poi.pmtiles')).length,firestoreRequests:resources.filter(r=>r.name.includes('firestore.googleapis.com')).length};
    },Date.now()-start));
  }
  return samples;
}
