export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url);
  const country = url.searchParams.get('country');
  
  if (!country) {
    return new Response('Missing country parameter', { status: 400 });
  }

  const targetUrl = `https://github.com/OfficialGoodWin/SpotFinder-App/releases/latest/download/${country}.pmtiles`;

  try {
    // Fetch the asset, automatically following the 302 redirect from GitHub to Azure Blob
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
    });

    if (!response.ok) {
      return new Response(`Upstream error: ${response.status}`, { status: response.status });
    }

    // Create a new Headers object from the upstream response
    const headers = new Headers(response.headers);
    
    // Inject CORS headers so the browser allows the streaming response
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');

    // Stream the body back to the client
    return new Response(response.body, {
      status: response.status,
      headers: headers,
    });
  } catch (err) {
    return new Response(`Proxy error: ${err.message}`, { status: 500 });
  }
}
