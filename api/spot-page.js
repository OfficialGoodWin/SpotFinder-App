import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { canonicalSpotUrl, validSpotId, PUBLIC_ORIGIN } from '../src/lib/spotLinks.js';
import { getPublicSpotPhotos, getSpotDisplayName } from '../src/lib/spotPresentation.js';

const shellPath = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const fallbackImage = `${PUBLIC_ORIGIN}/og-image.png`;
const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const jsonForHtml = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const cleanText = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

export function isPublicSpot(spot) {
  return spot?.is_public === true
    && ['published', 'pending_trust'].includes(spot.status)
    && !['hidden', 'private', 'removed', 'rejected'].includes(String(spot.discovery_state || '').toLowerCase());
}

export function renderSpotDocument(shell, spot, id) {
  const title = cleanText(getSpotDisplayName(spot)) || 'Community spot';
  const description = cleanText(spot.description).slice(0, 500) || `Explore ${title} on the SpotFinder community map.`;
  const canonical = canonicalSpotUrl(id);
  const photo = getPublicSpotPhotos(spot).map(item => item.url).find(url => {
    try { return new URL(url).protocol === 'https:'; } catch { return false; }
  }) || fallbackImage;
  const pageTitle = `${title} | SpotFinder`;
  const publicPublished = spot.status === 'published';
  const sensitiveLocation = spot.sensitive_location === true || spot.location_sensitive === true;
  const tags = [
    `<title>${escapeHtml(pageTitle)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${publicPublished && !sensitiveLocation ? 'index,follow' : 'noindex,follow'}" />`,
    `<meta name="spotfinder:server-spot" content="${escapeHtml(id)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(pageTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(photo)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(pageTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(photo)}" />`,
  ];
  if (publicPublished) {
    const place = { '@context': 'https://schema.org', '@type': 'Place', name: title, description, url: canonical };
    if (photo !== fallbackImage) place.image = photo;
    const latitude = Number(spot.lat), longitude = Number(spot.lng ?? spot.lon);
    if (!sensitiveLocation && spot.lat != null && (spot.lng ?? spot.lon) != null && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      place.geo = { '@type': 'GeoCoordinates', latitude, longitude };
    }
    tags.push(`<script type="application/ld+json">${jsonForHtml(place)}</script>`);
  }
  const headPattern = /<title>SpotFinder<\/title>[\s\S]*?(?=\s*<!-- Google Analytics)/;
  if (!headPattern.test(shell) || !shell.includes('<div id="root"></div>')) throw new Error('Spot page shell is incompatible');
  const content = `<main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><p><a href="/">Explore the SpotFinder map</a></p></main>`;
  return shell.replace(headPattern, tags.join('\n    ')).replace('<div id="root"></div>', `<div id="root">${content}</div>`);
}

function send(response, request, status, body, cache = 'no-store') {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', cache);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method === 'HEAD') return response.end();
  return response.end(body);
}

const errorPage = (status, message) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${status} | SpotFinder</title></head><body><main><h1>${escapeHtml(message)}</h1><p><a href="/">Back to the map</a></p></main></body></html>`;

export function createSpotPageHandler({ lookup, readShell = () => readFile(shellPath, 'utf8') }) {
  return async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      return send(response, request, 405, errorPage(405, 'Method not allowed'));
    }
    const id = typeof request.query?.spotId === 'string' ? request.query.spotId : new URL(request.url, 'http://localhost').searchParams.get('spotId');
    if (!validSpotId(id)) return send(response, request, 404, errorPage(404, 'Spot not found'));
    try {
      const spot = await lookup(id);
      if (!isPublicSpot(spot)) return send(response, request, 404, errorPage(404, 'Spot not found'), 'public, s-maxage=15, max-age=0');
      const html = renderSpotDocument(await readShell(), spot, id);
      return send(response, request, 200, html, spot.status === 'published' ? 'public, s-maxage=30, max-age=0' : 'public, s-maxage=15, max-age=0');
    } catch (error) {
      console.error('Spot page request failed:', error);
      return send(response, request, 503, errorPage(503, 'Spot temporarily unavailable'));
    }
  };
}

export default createSpotPageHandler({
  async lookup(id) {
    const { adminDb } = await import('./_firebaseAdmin.js');
    const snapshot = await adminDb.collection('spots').doc(id).get();
    return snapshot.exists ? snapshot.data() : null;
  },
});
