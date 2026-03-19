// Vercel serverless function — fetches Mapy.cz place photos
// GET /api/mapy-photos?source=firm&id=13528807

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { source, id } = req.query;
  if (!source || !id) {
    return res.status(400).json({ error: 'Missing source or id', photos: [] });
  }

  const debug = [];
  const photos = [];

  // ── Strategy 1: Firmy.cz page (source=firm) ─────────────────────────────
  if (source === 'firm') {
    try {
      const url = `https://www.firmy.cz/detail?id=${id}`;
      debug.push(`Trying Firmy.cz: ${url}`);
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'cs',
        },
      });
      debug.push(`Firmy.cz status: ${r.status}`);
      if (r.ok) {
        const html = await r.text();
        debug.push(`Firmy.cz HTML length: ${html.length}`);
        scanForSdnUrls(html, photos, debug);
        debug.push(`After Firmy.cz scan: ${photos.length} photos`);
      }
    } catch (e) {
      debug.push(`Firmy.cz error: ${e.message}`);
    }
  }

  // ── Strategy 2: Mapy.cz gallery page ────────────────────────────────────
  if (!photos.length) {
    try {
      const url = `https://mapy.com/cs/dopravni?source=${source}&id=${id}&gallery=1`;
      debug.push(`Trying Mapy.cz: ${url}`);
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'cs',
          'Referer': 'https://mapy.com/',
        },
      });
      debug.push(`Mapy.cz status: ${r.status}`);
      if (r.ok) {
        const html = await r.text();
        debug.push(`Mapy.cz HTML length: ${html.length}`);
        // Log a snippet around any sdn.cz occurrence
        const sdnIdx = html.indexOf('sdn.cz');
        if (sdnIdx > -1) {
          debug.push(`sdn.cz context: ...${html.slice(Math.max(0, sdnIdx - 60), sdnIdx + 120)}...`);
        } else {
          debug.push('No sdn.cz found in Mapy.cz HTML');
          // Log first 500 chars to understand page structure
          debug.push(`HTML head: ${html.slice(0, 500)}`);
        }
        scanForSdnUrls(html, photos, debug);
        debug.push(`After Mapy.cz scan: ${photos.length} photos`);
      }
    } catch (e) {
      debug.push(`Mapy.cz error: ${e.message}`);
    }
  }

  // ── Strategy 3: api.mapy.com/v1/place ───────────────────────────────────
  if (!photos.length) {
    try {
      const MAPY_KEY = 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';
      const url = `https://api.mapy.com/v1/place/${encodeURIComponent(source)}:${encodeURIComponent(id)}?apikey=${MAPY_KEY}&lang=cs`;
      debug.push(`Trying api.mapy.com: ${url}`);
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      debug.push(`api.mapy.com status: ${r.status}`);
      if (r.ok) {
        const data = await r.json();
        debug.push(`api.mapy.com keys: ${Object.keys(data).join(', ')}`);
        debug.push(`api.mapy.com snippet: ${JSON.stringify(data).slice(0, 400)}`);
        extractSdnUrls(data, photos);
        debug.push(`After api.mapy.com scan: ${photos.length} photos`);
      }
    } catch (e) {
      debug.push(`api.mapy.com error: ${e.message}`);
    }
  }

  const unique = [...new Set(photos)].slice(0, 10);
  res.setHeader('Cache-Control', 'no-store'); // no cache while debugging
  return res.status(200).json({ photos: unique, debug, source, id });
}

function isSdnUrl(url) {
  return typeof url === 'string' && (
    url.includes('.sdn.cz') ||
    url.includes('d.seznam.cz') ||
    url.includes('img.firmy.cz') ||
    url.includes('im.seznam.cz')
  );
}

function normaliseSdnUrl(url) {
  const base = url.split('?')[0];
  return `${base}?fl=res,1200,1200,1`;
}

function extractSdnUrls(obj, out, depth = 0) {
  if (depth > 15 || out.length >= 10 || obj == null) return;
  if (typeof obj === 'string') {
    if (isSdnUrl(obj) && !obj.includes(',40,') && !obj.includes(',80,')) {
      const n = normaliseSdnUrl(obj);
      if (!out.includes(n)) out.push(n);
    }
    return;
  }
  if (Array.isArray(obj)) { for (const i of obj) extractSdnUrls(i, out, depth + 1); return; }
  if (typeof obj === 'object') { for (const v of Object.values(obj)) extractSdnUrls(v, out, depth + 1); }
}

function scanForSdnUrls(html, out, debug = []) {
  // Match sdn.cz image URLs inside any quotes or unquoted in JSON
  const pattern = /["'`]?(https?:\/\/d[\w-]*\.sdn\.cz\/[^\s"'`>]+\.(?:jpeg|jpg|png|webp)(?:\?[^\s"'`>]*)?)["'`]?/gi;
  let match;
  let scanned = 0;
  while ((match = pattern.exec(html)) !== null) {
    scanned++;
    const url = match[1];
    if (url.includes(',40,') || url.includes(',80,') || url.includes(',100,')) continue;
    const n = normaliseSdnUrl(url);
    if (!out.includes(n)) out.push(n);
    if (out.length >= 10) break;
  }
  debug.push(`scanForSdnUrls: scanned ${scanned} matches, kept ${out.length}`);
}