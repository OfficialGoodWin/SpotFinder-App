export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
      },
    });
  }

  const url = new URL(req.url);
  const country = url.searchParams.get('country');
  
  if (!country) {
    return new Response('Missing country parameter', { status: 400 });
  }

  const targetUrl = `https://github.com/OfficialGoodWin/SpotFinder-App/releases/latest/download/${country}.pmtiles`;

  if (req.method === 'HEAD') {
    const response = await fetch(targetUrl, { method: 'HEAD', redirect: 'follow' });
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(null, { status: response.status, headers });
  }

  try {
    const fetchHeaders = {};
    // Forward Range header so chunked downloads work on Android
    const range = req.headers.get('range') || req.headers.get('Range');
    if (range) fetchHeaders['Range'] = range;

    // Fetch the asset, automatically following the 302 redirect from GitHub to Azure Blob
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: fetchHeaders,
    });

    if (!response.ok && response.status !== 206) {
      return new Response(`Upstream error: ${response.status}`, { status: response.status });
    }

    // Create a new Headers object from the upstream response
    const headers = new Headers(response.headers);
    
    // Inject CORS headers so the browser allows the streaming response
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    // Stream the body back to the client
    return new Response(response.body, {
      status: response.status, // will be 206 for range requests
      headers: headers,
    });
  } catch (err) {
    return new Response(`Proxy error: ${err.message}`, { status: 500 });
  }
}
