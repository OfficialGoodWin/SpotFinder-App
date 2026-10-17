export function safeWebsite(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') ? url.href : null;
  } catch { return null; }
}

export function openingHoursLabel(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim() === '24/7' ? 'Open 24/7' : value.trim();
}

export function normalizePoiPhotos(remote = [], community = []) {
  const seen = new Set();
  return [
    ...remote.map(photo => ({ ...photo, kind: 'remote' })),
    ...community.map(photo => ({ url: photo.image || photo.photo, thumbnail_url: photo.thumbnail_url, kind: 'sf', photoId: photo.id })),
  ].filter(photo => {
    if (typeof photo.url !== 'string') return false;
    try {
      const url = new URL(photo.url);
      if (url.protocol !== 'https:' || seen.has(url.href)) return false;
      seen.add(url.href);
      return true;
    } catch { return false; }
  });
}
