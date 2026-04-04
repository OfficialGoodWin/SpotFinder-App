export const config = {
  runtime: 'edge',
};

// CORS headers applied to every response — built fresh, never copied from upstream.
// Azure CDN (where GitHub releases are hosted) may return its own CORS headers that
// would override ours if we did new Headers(response.headers) first.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

export default async function handler(req) {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);
  const country = url.searchParams.get('country');

  if (!country || !/^[A-Z]{2}$/.test(country)) {
    return new Response('Missing or invalid country parameter', { status: 400, headers: CORS });
  }

  const targetUrl = `https://github.com/OfficialGoodWin/SpotFinder-App/releases/latest/download/${country}.pmtiles`;

  // Forward Range header from client — required for chunked Android downloads
  const upstreamHeaders = {};
  const range = req.headers.get('Range') || req.headers.get('range');
  if (range) upstreamHeaders['Range'] = range;

  try {
    const response = await fetch(targetUrl, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      redirect: 'follow',
      headers: upstreamHeaders,
    });

    if (!response.ok && response.status !== 206) {
      return new Response(`Upstream error: ${response.status}`, { status: response.status, headers: CORS });
    }

    // Build clean headers from scratch — do NOT copy upstream headers first.
    // Copying Azure's headers risks inheriting a mismatched Access-Control-Allow-Origin
    // which the browser sees and blocks, even after we try to overwrite it.
    const headers = {
      ...CORS,
      'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
    };

    // Pass through size/range headers so the client knows total length and can show progress
    const contentLength = response.headers.get('Content-Length');
    const contentRange  = response.headers.get('Content-Range');
    const acceptRanges  = response.headers.get('Accept-Ranges');
    if (contentLength) headers['Content-Length']  = contentLength;
    if (contentRange)  headers['Content-Range']   = contentRange;
    if (acceptRanges)  headers['Accept-Ranges']   = acceptRanges;

    return new Response(req.method === 'HEAD' ? null : response.body, {
      status: response.status,
      headers,
    });

  } catch (err) {
    return new Response(`Proxy error: ${err.message}`, { status: 500, headers: CORS });
  }
}