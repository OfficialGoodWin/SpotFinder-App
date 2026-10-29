import { firebaseConfig } from '@/api/firebaseConfig';

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
    ...community.filter(photo => {
      try {
        const url = new URL(photo.image || photo.photo);
        const prefix = `/v0/b/${encodeURIComponent(firebaseConfig.storageBucket)}/o/`;
        if (url.origin !== 'https://firebasestorage.googleapis.com' || !url.pathname.startsWith(prefix)
            || url.hash || url.searchParams.get('alt') !== 'media' || !url.searchParams.get('token')
            || [...url.searchParams].length !== 2) return false;
        const encodedPath = url.pathname.slice(prefix.length);
        const path = decodeURIComponent(encodedPath);
        if (encodeURIComponent(path) !== encodedPath) return false;
        return path === `poi-enrichment/${photo.id}.jpg`
          || (typeof photo.created_by_uid === 'string'
            && /^[A-Za-z0-9-]+\.jpg$/.test(path.slice(`community/${photo.created_by_uid}/`.length))
            && path.startsWith(`community/${photo.created_by_uid}/`));
      } catch { return false; }
    }).map(photo => ({ url: photo.image || photo.photo,
      kind: 'sf', photoId: photo.id, credit: photo.attribution || null })),
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

