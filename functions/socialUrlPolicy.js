'use strict';

const INVALID_SOCIAL_URL_MESSAGE = 'Only supported Instagram or TikTok post links are allowed.';
const MAX_SOCIAL_URL_LENGTH = 500;

// Server-side source of truth. The frontend mirror is UX only; contract tests
// run both implementations against the same valid and hostile inputs.
function validateSocialPostUrl(input) {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_SOCIAL_URL_LENGTH) {
    return { ok: false, error: INVALID_SOCIAL_URL_MESSAGE };
  }
  if (input !== input.trim() || input.includes('\\') || !/^[\x21-\x7e]+$/.test(input)) {
    return { ok: false, error: INVALID_SOCIAL_URL_MESSAGE };
  }

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, error: INVALID_SOCIAL_URL_MESSAGE };
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) {
    return { ok: false, error: INVALID_SOCIAL_URL_MESSAGE };
  }

  if (parsed.hostname === 'www.instagram.com') {
    const match = parsed.pathname.match(/^\/(p|reel)\/([A-Za-z0-9_-]{1,64})\/?$/);
    if (!match) return { ok: false, error: INVALID_SOCIAL_URL_MESSAGE };
    const [, contentType, contentId] = match;
    return {
      ok: true,
      provider: 'instagram',
      contentType,
      contentId,
      canonicalUrl: `https://www.instagram.com/${contentType}/${contentId}/`,
    };
  }

  if (parsed.hostname === 'www.tiktok.com') {
    const match = parsed.pathname.match(/^\/@([A-Za-z0-9._]{2,24})\/video\/([0-9]{10,30})\/?$/);
    if (!match) return { ok: false, error: INVALID_SOCIAL_URL_MESSAGE };
    const [, username, contentId] = match;
    return {
      ok: true,
      provider: 'tiktok',
      contentType: 'video',
      contentId,
      canonicalUrl: `https://www.tiktok.com/@${username}/video/${contentId}`,
    };
  }

  return { ok: false, error: INVALID_SOCIAL_URL_MESSAGE };
}

module.exports = { validateSocialPostUrl, INVALID_SOCIAL_URL_MESSAGE, MAX_SOCIAL_URL_LENGTH };
