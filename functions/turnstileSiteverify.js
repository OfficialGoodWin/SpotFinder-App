// Prepared verifier for future protected actions. No production handler imports it yet.
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

class TurnstileUnavailableError extends Error {
  constructor() {
    super('Challenge verification is temporarily unavailable. Please try again.');
    this.name = 'TurnstileUnavailableError';
  }
}

async function verifyTurnstileToken(token, {
  secret,
  expectedAction,
  allowedHostnames,
  fetchImpl = fetch,
  now = Date.now(),
} = {}) {
  if (!secret || !expectedAction || !Array.isArray(allowedHostnames) || !allowedHostnames.length) {
    throw new Error('Turnstile verification is not configured');
  }
  if (typeof token !== 'string' || !token || token.length > 2048) {
    return { ok: false, reason: 'invalid_token' };
  }

  let result;
  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new TurnstileUnavailableError();
    result = await response.json();
  } catch {
    throw new TurnstileUnavailableError();
  }

  if (result?.success !== true) {
    const expired = result?.['error-codes']?.includes('timeout-or-duplicate');
    return { ok: false, reason: expired ? 'expired_or_reused' : 'invalid_token' };
  }
  const hostname = String(result.hostname || '').toLowerCase();
  if (!allowedHostnames.map(value => value.toLowerCase()).includes(hostname)) {
    return { ok: false, reason: 'wrong_hostname' };
  }
  if (result.action !== expectedAction) return { ok: false, reason: 'wrong_action' };
  const challengeTime = Date.parse(result.challenge_ts);
  if (!Number.isFinite(challengeTime) || challengeTime > now + 30_000 || now - challengeTime > 300_000) {
    return { ok: false, reason: 'expired_or_reused' };
  }
  return { ok: true };
}

module.exports = { verifyTurnstileToken, TurnstileUnavailableError };
