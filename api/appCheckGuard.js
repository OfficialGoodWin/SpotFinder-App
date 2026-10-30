// App Check is an app attestation, independent of Firebase Auth and Turnstile.
export async function verifyAppCheckRequest(req, { verifyToken, allowedAppIds, expectedProjectId, adminProjectId }) {
  if (!expectedProjectId || expectedProjectId !== adminProjectId || !Array.isArray(allowedAppIds) || !allowedAppIds.length) {
    return { ok: false, status: 503, code: 'APP_CHECK_NOT_CONFIGURED' };
  }
  const token = req.headers?.['x-firebase-appcheck'];
  if (typeof token !== 'string' || !token || token.length > 8192) {
    return { ok: false, status: 401, code: 'APP_CHECK_REQUIRED' };
  }
  try {
    // Admin SDK verifies signature, expiry, and project before returning appId.
    const claims = await verifyToken(token);
    if (!allowedAppIds.includes(claims?.appId)) return { ok: false, status: 401, code: 'APP_CHECK_INVALID' };
    return { ok: true, appId: claims.appId };
  } catch {
    return { ok: false, status: 401, code: 'APP_CHECK_INVALID' };
  }
}

export async function requireVercelAppCheck(req, res, { adminApp, adminAppCheck, enforceEnv = 'VERCEL_APPCHECK_ENFORCE', required = false }) {
  // Explicit rollout switch: old clients remain usable while token metrics
  // and real flows are checked. Do not turn this on in the same client release.
  if (!required && process.env[enforceEnv] !== 'true') return true;
  const reply = await verifyAppCheckRequest(req, {
    verifyToken: token => adminAppCheck.verifyToken(token),
    allowedAppIds: (process.env.FIREBASE_ALLOWED_APP_IDS || '').split(',').map(value => value.trim()).filter(Boolean),
    expectedProjectId: process.env.FIREBASE_PROJECT_ID,
    adminProjectId: adminApp.options.projectId,
  });
  if (reply.ok) return true;
  res.setHeader('Cache-Control', 'no-store');
  res.status(reply.status).json({ code: reply.code });
  return false;
}
