// Vercel serverless function — fetches Mapy.cz place photos
// Called as: GET /api/mapy-photos?source=firm&id=13528807
//
// Strategy: The page is JS-rendered so we can't just parse the HTML.
// Instead we look for the CDN URL pattern (d*.sdn.cz) which is always
// present in <script> tags as JSON-embedded data, and also try the
// Firmy.cz public JSON endpoint which works for source=firm places.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { source, id } = req.query;
  if (!source || !id) {
    return res.status(400).json({ error: 'Missing source or id', photos: [] });
  }

  const photos = [];

  // ── Strategy 1: Firmy.cz JSON API (works for source=firm) ───────────────
  // Firmy.cz exposes a public JSON detail endpoint used by their own frontend
  if (source === 'firm') {
    try {
      const firmUrl = `https://www.firmy.cz/detail?id=${id}`;
      const firmRes = await fetch(firmUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'cs,en;q=0.8',
          'Referer': 'https://www.firmy.cz/',
        },
      });

      if (firmRes.ok) {
        const html = await firmRes.text();

        // Firmy.cz embeds __NEXT_DATA__ with the full place data including photos
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (nextDataMatch) {
          try {
            const nextData = JSON.parse(nextDataMatch[1]);
            extractSdnUrls(nextData, photos);
          } catch {}
        }

        // Also scan all script tags for sdn.cz URLs
        if (!photos.length) {
          scanForSdnUrls(html, photos);
        }
      }
    } catch {}
  }

  // ── Strategy 2: Mapy.cz place page ──────────────────────────────────────
  // The gallery URL with &gallery=1 triggers photo loading in the page data
  if (!photos.length) {
    try {
      const mapyUrl = `https://mapy.com/en/dopravni?source=${source}&id=${id}&gallery=1`;
      const mapyRes = await fetch(mapyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'cs,en;q=0.8',
          'Referer': 'https://mapy.com/',
        },
      });

      if (mapyRes.ok) {
        const html = await mapyRes.text();

        // Look for __NEXT_DATA__ first
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (nextDataMatch) {
          try {
            const nextData = JSON.parse(nextDataMatch[1]);
            extractSdnUrls(nextData, photos);
          } catch {}
        }

        // Scan all script content for sdn.cz image patterns
        if (!photos.length) {
          scanForSdnUrls(html, photos);
        }
      }
    } catch {}
  }

  // ── Strategy 3: Mapy.cz internal place API (JSON endpoint) ──────────────
  // The Mapy.cz API has a place detail endpoint that sometimes returns photos
  if (!photos.length) {
    try {
      const MAPY_KEY = 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';
      const placeRes = await fetch(
        `https://api.mapy.com/v1/place/${encodeURIComponent(source)}:${encodeURIComponent(id)}?apikey=${MAPY_KEY}&lang=cs`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json',
          },
        }
      );
      if (placeRes.ok) {
        const placeData = await placeRes.json();
        extractSdnUrls(placeData, photos);
        // Also check explicit photos array
        const photoArr = placeData.photos || placeData.photo || [];
        for (const p of photoArr) {
          const u = p.url || p.big || p.src || (typeof p === 'string' ? p : null);
          if (u && isSdnUrl(u)) photos.push(normaliseSdnUrl(u));
        }
      }
    } catch {}
  }

  const unique = [...new Set(photos)].slice(0, 10);
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({ photos: unique, source, id });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// The CDN pattern from your example: https://d34-a.sdn.cz/d_34/c_img_ob_B/HASH/file.jpeg
// General pattern: https://d{N}-{letter}.sdn.cz/... or https://d.sdn.cz/...
// We want the large version: ?fl=res,2200,2200,1 (not the 40x40 placeholder)
function isSdnUrl(url) {
  return typeof url === 'string' && (
    url.includes('.sdn.cz') ||
    url.includes('d.seznam.cz') ||
    url.includes('img.firmy.cz') ||
    url.includes('im.seznam.cz')
  );
}

function normaliseSdnUrl(url) {
  if (!url) return null;
  // Strip any existing fl= param and replace with high-res version
  const base = url.replace(/[?&]fl=[^&]*/g, '').replace(/[?&]$/, '');
  // Add high-res transform
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}fl=res,1200,1200,1`;
}

// Recursively walk a parsed JSON object and collect sdn.cz URLs
function extractSdnUrls(obj, out, depth = 0) {
  if (depth > 15 || out.length >= 10 || obj === null || obj === undefined) return;
  if (typeof obj === 'string') {
    if (isSdnUrl(obj) && !obj.includes('fl=res,40,40')) {
      // Skip tiny placeholder thumbnails (40x40)
      const norm = normaliseSdnUrl(obj);
      if (norm) out.push(norm);
    }
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) extractSdnUrls(item, out, depth + 1);
    return;
  }
  if (typeof obj === 'object') {
    for (const val of Object.values(obj)) extractSdnUrls(val, out, depth + 1);
  }
}

// Scan raw HTML/JS text for sdn.cz URL strings
function scanForSdnUrls(html, out) {
  // Match quoted sdn.cz URLs, skipping tiny placeholders
  const pattern = /["'](https?:\/\/d[\w-]*\.sdn\.cz\/[^"'?]+\.(?:jpeg|jpg|png|webp)(?:\?[^"']*)?)['"]/gi;
  let match;
  while ((match = pattern.exec(html)) !== null && out.length < 10) {
    const url = match[1];
    // Skip 40x40 placeholders
    if (url.includes('fl=res,40,40') || url.includes('fl=res,80,80')) continue;
    const norm = normaliseSdnUrl(url);
    if (norm && !out.includes(norm)) out.push(norm);
  }
}