// Vercel serverless function — fetches Mapy.cz place photos
// GET /api/mapy-photos?name=PLACE_NAME&lat=49.75&lon=13.51
//
// Does everything server-side to avoid CORS:
// 1. Old api.mapy.cz suggest (returns userData.source + userData.id)
// 2. Firmy.cz detail page → __NEXT_DATA__ JSON → sdn.cz photo URLs

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { name, lat, lon } = req.query;
  if (!name || !lat || !lon) {
    return res.status(400).json({ error: 'Missing name, lat or lon', photos: [] });
  }

  const debug = [];
  const photos = [];
  const latF = parseFloat(lat);
  const lonF = parseFloat(lon);

  // ── Step 1: OLD api.mapy.cz suggest — returns userData.source + userData.id ──
  // The new api.mapy.com/v1/suggest does NOT return source/id. The old one does.
  let source = null, placeId = null;
  try {
    const suggestUrl = `https://api.mapy.cz/suggest?phrase=${encodeURIComponent(name)}&count=8&preferNear=${lonF},${latF}&preferNearPrecision=200&enableCategories=1&lang=cs`;
    debug.push(`Old suggest: ${suggestUrl}`);
    const r = await fetch(suggestUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://mapy.cz/',
        'Accept': 'application/json',
      },
    });
    debug.push(`Old suggest status: ${r.status}`);
    if (r.ok) {
      const data = await r.json();
      debug.push(`Old suggest raw: ${JSON.stringify(data).slice(0, 600)}`);
      const items = data.result || data.items || [];
      // Pick closest result with userData.source
      let bestDist = Infinity;
      for (const item of items) {
        const ud = item.userData || {};
        const iLat = ud.latitude ?? item.position?.lat;
        const iLon = ud.longitude ?? item.position?.lon;
        if (!iLat || !iLon) continue;
        const dist = Math.hypot(iLat - latF, iLon - lonF);
        if (dist < bestDist && ud.source) {
          bestDist = dist;
          source = ud.source;
          placeId = ud.id;
        }
      }
      debug.push(`Best match: source=${source} id=${placeId} dist=${bestDist}`);
    }
  } catch (e) {
    debug.push(`Old suggest error: ${e.message}`);
  }

  // ── Step 2a: Firmy.cz detail page if source=firm ─────────────────────────
  if (source === 'firm' && placeId) {
    try {
      const url = `https://www.firmy.cz/detail?id=${placeId}`;
      debug.push(`Firmy.cz: ${url}`);
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'cs-CZ,cs;q=0.9',
          'Referer': 'https://www.firmy.cz/',
        },
      });
      debug.push(`Firmy.cz status: ${r.status}`);
      if (r.ok) {
        const html = await r.text();
        // Extract __NEXT_DATA__ embedded JSON
        const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (m) {
          try {
            const nd = JSON.parse(m[1]);
            extractSdnUrls(nd, photos);
            debug.push(`Firmy __NEXT_DATA__ photos: ${photos.length}`);
          } catch (e) {
            debug.push(`__NEXT_DATA__ parse error: ${e.message}`);
          }
        }
        // Also raw scan
        if (!photos.length) {
          scanForSdnUrls(html, photos);
          debug.push(`Firmy raw scan photos: ${photos.length}`);
        }
      }
    } catch (e) {
      debug.push(`Firmy.cz error: ${e.message}`);
    }
  }

  // ── Step 2b: Mapy.cz gallery page for any source ─────────────────────────
  if (!photos.length && source && placeId) {
    try {
      const url = `https://mapy.com/cs/dopravni?source=${source}&id=${placeId}&gallery=1`;
      debug.push(`Mapy gallery: ${url}`);
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'cs-CZ,cs;q=0.9',
          'Referer': 'https://mapy.com/',
          'Cookie': 'lps=cs',
        },
      });
      debug.push(`Mapy gallery status: ${r.status}`);
      if (r.ok) {
        const html = await r.text();
        const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (m) {
          try {
            const nd = JSON.parse(m[1]);
            extractSdnUrls(nd, photos);
            debug.push(`Mapy __NEXT_DATA__ photos: ${photos.length}`);
          } catch {}
        }
        if (!photos.length) {
          scanForSdnUrls(html, photos);
          debug.push(`Mapy raw scan photos: ${photos.length}`);
          // Log a snippet so we can debug
          const sdnIdx = html.indexOf('sdn.cz');
          if (sdnIdx > -1) {
            debug.push(`sdn.cz ctx: ${html.slice(Math.max(0, sdnIdx - 80), sdnIdx + 150)}`);
          } else {
            debug.push(`No sdn.cz found. Page snippet: ${html.slice(0, 800)}`);
          }
        }
      }
    } catch (e) {
      debug.push(`Mapy gallery error: ${e.message}`);
    }
  }

  // ── Step 2c: api.mapy.com/v1/place ───────────────────────────────────────
  if (!photos.length && source && placeId) {
    try {
      const MAPY_KEY = 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';
      const url = `https://api.mapy.com/v1/place/${encodeURIComponent(source)}:${encodeURIComponent(placeId)}?apikey=${MAPY_KEY}&lang=cs`;
      debug.push(`api.mapy.com/v1/place: ${url}`);
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      debug.push(`v1/place status: ${r.status}`);
      if (r.ok) {
        const data = await r.json();
        debug.push(`v1/place keys: ${Object.keys(data).join(', ')}`);
        debug.push(`v1/place snippet: ${JSON.stringify(data).slice(0, 600)}`);
        extractSdnUrls(data, photos);
        const pa = data.photos || data.photo || [];
        for (const p of pa) {
          const u = p.url || p.big || p.src || (typeof p === 'string' ? p : null);
          if (u && !photos.includes(normaliseSdnUrl(u))) photos.push(normaliseSdnUrl(u));
        }
        debug.push(`v1/place photos found: ${photos.length}`);
      }
    } catch (e) {
      debug.push(`v1/place error: ${e.message}`);
    }
  }

  const unique = [...new Set(photos.filter(Boolean))].slice(0, 10);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ photos: unique, debug, source, id: placeId });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSdnUrl(url) {
  return typeof url === 'string' && (
    url.includes('.sdn.cz') || url.includes('d.seznam.cz') ||
    url.includes('img.firmy.cz') || url.includes('im.seznam.cz')
  );
}

function normaliseSdnUrl(url) {
  if (!url) return null;
  const base = url.split('?')[0];
  return `${base}?fl=res,1200,1200,1`;
}

function extractSdnUrls(obj, out, depth = 0) {
  if (depth > 15 || out.length >= 10 || obj == null) return;
  if (typeof obj === 'string') {
    if (isSdnUrl(obj) && !obj.includes(',40,') && !obj.includes(',80,') && !obj.includes(',100,')) {
      const n = normaliseSdnUrl(obj);
      if (n && !out.includes(n)) out.push(n);
    }
    return;
  }
  if (Array.isArray(obj)) { for (const i of obj) extractSdnUrls(i, out, depth + 1); return; }
  if (typeof obj === 'object') { for (const v of Object.values(obj)) extractSdnUrls(v, out, depth + 1); }
}

function scanForSdnUrls(html, out) {
  const pattern = /["'`]?(https?:\/\/d[\w-]*\.sdn\.cz\/[^\s"'`>]+\.(?:jpeg|jpg|png|webp)(?:\?[^\s"'`>]*)?)["'`]?/gi;
  let match;
  while ((match = pattern.exec(html)) !== null && out.length < 10) {
    const url = match[1];
    if (url.includes(',40,') || url.includes(',80,') || url.includes(',100,')) continue;
    const n = normaliseSdnUrl(url);
    if (n && !out.includes(n)) out.push(n);
  }
}