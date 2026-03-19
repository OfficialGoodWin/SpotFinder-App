// Vercel serverless function — scrapes Mapy.cz place page and extracts gallery image URLs
// Called as: /api/mapy-photos?source=firm&id=13528807

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { source, id } = req.query;
  if (!source || !id) {
    return res.status(400).json({ error: 'Missing source or id' });
  }

  try {
    const url = `https://mapy.com/en/dopravni?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'cs,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Referer': 'https://mapy.com/',
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Mapy.cz returned ${response.status}` });
    }

    const html = await response.text();

    const photos = [];

    // 1. Look for gallery JSON blob embedded in the page (most reliable)
    //    Mapy.cz often embeds a __NEXT_DATA__ or window.__initialState__ with photo arrays
    const jsonMatches = [
      // Next.js data
      html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/),
      // Inline state
      html.match(/window\.__initialState__\s*=\s*({[\s\S]*?});\s*<\/script>/),
      // SMap state
      html.match(/SMap\.config\s*=\s*({[\s\S]*?});\s*(?:\/\/|<\/script>)/),
    ];

    for (const match of jsonMatches) {
      if (!match) continue;
      try {
        const obj = JSON.parse(match[1]);
        // Recursively search for photo URL arrays
        extractPhotoUrls(obj, photos);
        if (photos.length) break;
      } catch {}
    }

    // 2. Scrape img tags inside gallery-related containers
    if (!photos.length) {
      // gallery-container divs
      const galleryBlocks = html.match(/<div[^>]*class="[^"]*gallery[^"]*"[^>]*>([\s\S]*?)<\/div>/gi) || [];
      for (const block of galleryBlocks) {
        const imgs = block.matchAll(/<img[^>]+src="([^"]+)"/gi);
        for (const m of imgs) {
          const u = m[1];
          if (isPhotoUrl(u)) photos.push(normaliseUrl(u));
        }
      }
    }

    // 3. Any img with photo-like URLs in the whole page
    if (!photos.length) {
      const allImgs = html.matchAll(/<img[^>]+src="([^"]+)"/gi);
      for (const m of allImgs) {
        const u = m[1];
        if (isPhotoUrl(u)) photos.push(normaliseUrl(u));
      }
    }

    // 4. Try the Firmy.cz API directly — firm IDs are Firmy.cz business listings
    //    which have a public JSON API
    if (!photos.length && source === 'firm') {
      const firmPhotos = await fetchFirmyPhotos(id);
      photos.push(...firmPhotos);
    }

    // Deduplicate
    const unique = [...new Set(photos)].slice(0, 10);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ photos: unique });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPhotoUrl(url) {
  if (!url || url.startsWith('data:')) return false;
  const lower = url.toLowerCase();
  // Must look like a real photo URL (not icon/sprite/logo)
  const photoHosts = ['d.seznam.cz', 'im.seznam.cz', 'img.firmy.cz', 'foto.mapy.cz',
                       'cdnjs', 'cdn.', 'photo', 'gallery', 'img.'];
  const isKnownHost = photoHosts.some(h => lower.includes(h));
  const looksLikePhoto = /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url);
  const notIcon = !lower.includes('icon') && !lower.includes('logo') && !lower.includes('sprite') && !lower.includes('avatar');
  return (isKnownHost || looksLikePhoto) && notIcon;
}

function normaliseUrl(url) {
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return 'https://mapy.com' + url;
  return url;
}

function extractPhotoUrls(obj, out, depth = 0) {
  if (depth > 12 || out.length >= 10) return;
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) extractPhotoUrls(item, out, depth + 1);
    return;
  }
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string' && isPhotoUrl(val)) {
      out.push(normaliseUrl(val));
    } else if (typeof val === 'object' && val !== null) {
      extractPhotoUrls(val, out, depth + 1);
    }
  }
}

// Firmy.cz has a public API for business photos
async function fetchFirmyPhotos(firmId) {
  try {
    const url = `https://www.firmy.cz/api/v1/company/${firmId}/photos`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
        'Referer': 'https://www.firmy.cz/',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    // Response is usually { photos: [{ url, thumb, ... }] } or just an array
    const arr = data.photos || data.items || (Array.isArray(data) ? data : []);
    return arr.map(p => p.url || p.big || p.original || p.src).filter(Boolean).slice(0, 8);
  } catch {
    return [];
  }
}
