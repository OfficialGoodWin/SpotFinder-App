
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);
  const country = url.searchParams.get('country');

  if (!country || !/^[A-Z]{2}(-[A-Z]+)?$/.test(country)) {
    return new Response('Bad request', { status: 400, headers: CORS });
  }

  const githubUrl = `https://github.com/OfficialGoodWin/SpotFinder-App/releases/latest/download/${country}.pmtiles`;

  const range = req.headers.get('range') || req.headers.get('Range');

  // Step 1: hit GitHub with redirect:manual to grab the Azure CDN Location URL
  // If we use redirect:follow the browser ends up seeing Azure's CORS headers, not ours
  const githubRes = await fetch(githubUrl, { method: 'GET', redirect: 'manual' });
  const azureUrl = githubRes.headers.get('location');

  if (!azureUrl) {
    return new Response('File not found', { status: 404, headers: CORS });
  }

  // Step 2: fetch from Azure directly, forwarding Range header for chunked downloads
  const upstreamHeaders = {};
  if (range) upstreamHeaders['Range'] = range;

  const azureRes = await fetch(azureUrl, {
    method: req.method === 'HEAD' ? 'HEAD' : 'GET',
    headers: upstreamHeaders,
    redirect: 'follow',
  });

  if (!azureRes.ok && azureRes.status !== 206) {
    return new Response(`Upstream error: ${azureRes.status}`, { status: azureRes.status, headers: CORS });
  }

  // Step 3: return Azure body under our CORS headers — never copy Azure headers
  const headers = { ...CORS, 'Content-Type': 'application/octet-stream' };
  const cl = azureRes.headers.get('Content-Length');
  const cr = azureRes.headers.get('Content-Range');
  const ar = azureRes.headers.get('Accept-Ranges');
  if (cl) headers['Content-Length'] = cl;
  if (cr) headers['Content-Range'] = cr;
  if (ar) headers['Accept-Ranges'] = ar;

  return new Response(req.method === 'HEAD' ? null : azureRes.body, {
    status: azureRes.status,
    headers,
  });
}