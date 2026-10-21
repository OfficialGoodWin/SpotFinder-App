export const PUBLIC_ORIGIN = 'https://www.spotfinder.live';

export function validSpotId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

export function canonicalSpotUrl(id) {
  if (!validSpotId(id)) return null;
  return `${PUBLIC_ORIGIN}/spot/${encodeURIComponent(id)}`;
}

export function spotIdFromLocation(pathname, search = '') {
  const match = /^\/spot\/([^/]+)\/?$/i.exec(pathname);
  if (match) {
    try { return { id: decodeURIComponent(match[1]), isSpotLink: true }; }
    catch { return { id: null, isSpotLink: true }; }
  }
  const legacyId = new URLSearchParams(search).get('spot');
  return { id: legacyId, isSpotLink: legacyId !== null };
}

export async function shareSpotLink({ id, title, navigatorApi = globalThis.navigator }) {
  const url = canonicalSpotUrl(id);
  if (!url) return 'unavailable';
  if (navigatorApi?.share) {
    try {
      await navigatorApi.share({ title, text: `Explore ${title} on SpotFinder.`, url });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigatorApi?.clipboard?.writeText(url);
    return navigatorApi?.clipboard?.writeText ? 'copied' : 'unavailable';
  } catch { return 'unavailable'; }
}
