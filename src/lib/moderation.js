/**
 * moderation.js — lightweight client-side content moderation & anti-spam helpers.
 *
 * IMPORTANT: this module gives users fast feedback and stops obviously bad
 * submissions before they leave the device, but it is NOT a security
 * boundary. A malicious client can call the Firebase SDK directly and skip
 * this file entirely. The authoritative checks MUST also run server-side
 * (Cloud Functions triggers — see /functions/index.js) and be enforced by
 * Firestore Security Rules. See SECURITY_REVIEW.md, section "Moderation &
 * Anti-Spam Architecture" for the full write-up.
 */

// Small, easily-extended block list. Keep this out of user-facing error
// text so we don't teach spammers exactly what trips the filter.
const BLOCKED_SUBSTRINGS = [
  'viagra', 'porn', 'xxx', 'nudes', 'onlyfans',
  'crypto airdrop', 'free bitcoin', 'click here to claim',
  'whatsapp me', 'telegram me', 'nigerian prince',
];

const URL_REGEX = /(https?:\/\/|www\.)[^\s]+/gi;
const REPEATED_CHAR_REGEX = /(.)\1{6,}/; // aaaaaaa, !!!!!!!
const REPEATED_WORD_REGEX = /\b(\w+)\b(?:\s+\1\b){3,}/i; // "spam spam spam spam"

/**
 * Evaluate free-text content (spot descriptions, reviews, feedback notes)
 * for spam / low-quality signals.
 *
 * @param {string} text
 * @param {{ maxLength?: number, maxLinks?: number }} [opts]
 * @returns {{ ok: boolean, score: number, reasons: string[] }}
 *   score is 0 (clean) upward; ok === false means "block submission",
 *   ok === true but score > 0 means "allow, but flag for review".
 */
export function checkContent(text, opts = {}) {
  const { maxLength = 2000, maxLinks = 1 } = opts;
  const reasons = [];
  let score = 0;

  const raw = (text || '').trim();

  if (raw.length > maxLength) {
    reasons.push('too_long');
    score += 2;
  }

  const lower = raw.toLowerCase();
  if (BLOCKED_SUBSTRINGS.some((term) => lower.includes(term))) {
    reasons.push('blocked_term');
    score += 5; // hard block
  }

  const links = raw.match(URL_REGEX) || [];
  if (links.length > maxLinks) {
    reasons.push('excess_links');
    score += 3;
  }

  if (REPEATED_CHAR_REGEX.test(raw)) {
    reasons.push('repeated_characters');
    score += 2;
  }

  if (REPEATED_WORD_REGEX.test(raw)) {
    reasons.push('repeated_words');
    score += 2;
  }

  // Shouting: long, mostly-uppercase text.
  const letters = raw.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 20) {
    const upper = raw.replace(/[^A-Z]/g, '');
    if (upper.length / letters.length > 0.8) {
      reasons.push('all_caps');
      score += 1;
    }
  }

  return { ok: score < 5, score, reasons };
}

/**
 * Very small client-side rate limiter backed by localStorage. Used only to
 * curb accidental double-submits and casual abuse from a single device —
 * trivially bypassed by clearing storage or using another device/browser,
 * so it must be paired with a server-side per-user/per-IP limit
 * (Cloud Functions + Firestore counters, see functions/index.js).
 *
 * @param {string} key   unique key for the action, e.g. `rate:add_spot:${uid}`
 * @param {number} max   max allowed actions per window
 * @param {number} windowMs window size in ms
 * @returns {boolean} true if the action is allowed (and records it), false if rate-limited
 */
export function checkClientRateLimit(key, max, windowMs) {
  try {
    const now = Date.now();
    const raw = window.localStorage.getItem(key);
    const entry = raw ? JSON.parse(raw) : { count: 0, start: now };

    if (now - entry.start > windowMs) {
      window.localStorage.setItem(key, JSON.stringify({ count: 1, start: now }));
      return true;
    }

    if (entry.count >= max) return false;

    entry.count += 1;
    window.localStorage.setItem(key, JSON.stringify(entry));
    return true;
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — fail open on
    // the client since the server-side limit is the real backstop.
    return true;
  }
}

/**
 * Convenience wrapper combining a content check + rate limit for a
 * "create" action. Returns a user-facing message key (for i18n) on failure,
 * or null when the submission may proceed.
 */
export function moderateSubmission({ text, rateLimitKey, maxPerWindow = 5, windowMs = 10 * 60 * 1000 }) {
  if (rateLimitKey && !checkClientRateLimit(rateLimitKey, maxPerWindow, windowMs)) {
    return { allowed: false, reasonKey: 'moderation.tooManySubmissions' };
  }
  if (typeof text === 'string') {
    const result = checkContent(text);
    if (!result.ok) {
      return { allowed: false, reasonKey: 'moderation.contentBlocked', details: result.reasons };
    }
  }
  return { allowed: true };
}
