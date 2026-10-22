async page => {
  const urls=['https://www.spotfinder.live/','https://spotfinder.live/','https://www.spotfinder.live/news','https://www.spotfinder.live/sitemap.xml'];
  const result=[];
  for(const url of urls){
    try { const r=await page.request.get(url,{timeout:12000}); result.push({url,status:r.status(),finalUrl:r.url(),type:r.headers()['content-type'],length:(await r.body()).length}); }
    catch(error){result.push({url,error:String(error)});}
  }
  return result;
}
