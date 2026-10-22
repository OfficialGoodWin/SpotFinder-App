async page => {
  const base='https://spot-finder-app.vercel.app';
  const paths=['/robots.txt','/sitemap.xml','/news','/news/five-places-near-prague','/definitely-not-a-route','/spot/AIyFTk1eTE7gD5INyomX'];
  const result=[];
  for(const path of paths){
    const response=await page.request.get(base+path);
    const body=await response.text();
    result.push({path,status:response.status(),contentType:response.headers()['content-type'],length:body.length,title:body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]||'',canonical:body.match(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i)?.[1]||'',description:body.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1]||'',hasArticleJsonLd:/"@(type|context)"\s*:\s*"(Article|BlogPosting|https:\/\/schema.org)"/.test(body),hasNoindex:/noindex/i.test(body),spotReferences:(body.match(/<loc>/g)||[]).length,preview:body.slice(0,350)});
  }
  return result;
}
