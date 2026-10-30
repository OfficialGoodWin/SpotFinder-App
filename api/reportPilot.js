import crypto from 'node:crypto';

const REASONS = {
  spot: ['wrong_info', 'wrong_location', 'closed_or_missing', 'duplicate', 'inappropriate', 'spam_scam', 'other_safety'],
  poi: ['wrong_info', 'wrong_location', 'closed_or_missing', 'duplicate', 'inappropriate', 'spam_scam', 'other_safety'],
  poi_photo: ['wrong_place', 'inappropriate', 'copyright', 'private_info', 'misleading', 'spam', 'other'],
  social_post: ['unrelated', 'inappropriate', 'spam', 'misleading', 'privacy', 'unavailable', 'other'],
};
const MAX_BODY_BYTES = 8192;
const HOUR = 3600000;
const FIVE_MINUTES = 300000;
const DAY = 86400000;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const result = (status, code, extra = {}, retryAfter) => ({ status, body: { code, ...extra }, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : {} });

function parseRequest(req) {
  const length = Number(req.headers?.['content-length'] || 0);
  if (!Number.isFinite(length) || length < 0 || length > MAX_BODY_BYTES) return result(413, 'PAYLOAD_TOO_LARGE');
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) return result(413, 'PAYLOAD_TOO_LARGE');
  } catch { return result(400, 'INVALID_PAYLOAD'); }
  if (!body || Array.isArray(body) || typeof body !== 'object') return result(400, 'INVALID_PAYLOAD');
  const allowed = ['category', 'subject', 'message', 'targetType', 'targetId', 'targetSnapshot', 'deviceId', 'idempotencyKey', 'turnstileToken'];
  if (Object.keys(body).some(key => !allowed.includes(key))) return result(400, 'INVALID_PAYLOAD');
  const { category, subject, message, targetType, targetId, targetSnapshot = {}, deviceId = '', idempotencyKey, turnstileToken } = body;
  if (!REASONS[targetType]?.includes(category) || typeof targetId !== 'string' || !/^[A-Za-z0-9_.:-]{1,200}$/.test(targetId)
    || typeof subject !== 'string' || subject.length > 200 || typeof message !== 'string' || message.length > 1000
    || typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)
    || typeof deviceId !== 'string' || deviceId.length > 200
    || (turnstileToken !== undefined && (typeof turnstileToken !== 'string' || turnstileToken.length > 2048))
    || !targetSnapshot || Array.isArray(targetSnapshot) || typeof targetSnapshot !== 'object') return result(400, 'INVALID_PAYLOAD');
  const snapshot = {};
  for (const [key, value] of Object.entries(targetSnapshot)) {
    if (!['name', 'title', 'lat', 'lon', 'image', 'created_by'].includes(key) || !['string', 'number'].includes(typeof value)) return result(400, 'INVALID_PAYLOAD');
    snapshot[key] = String(value).slice(0, 500);
  }
  return { category, subject, message: message.trim(), targetType, targetId, targetKey: `${targetType}:${targetId}`,
    targetSnapshot: snapshot, deviceHash: hash(deviceId || 'none'), idempotencyKey, turnstileToken };
}

export async function processReport(req, { db, verifyAuth, verifyChallenge, now = Date.now, challengeSecret, allowedHostnames }) {
  if (req.method !== 'POST') return result(405, 'METHOD_NOT_ALLOWED');
  const payload = parseRequest(req);
  if (payload.status) return payload;
  const bearer = /^Bearer ([^\s]+)$/.exec(String(req.headers?.authorization || ''));
  if (!bearer) return result(401, 'AUTH_REQUIRED');
  let user;
  try { user = await verifyAuth(bearer[1]); } catch { return result(401, 'VERIFIED_AUTH_REQUIRED'); }
  if (!user?.uid || user.email_verified !== true || user.firebase?.sign_in_provider === 'anonymous') return result(401, 'VERIFIED_AUTH_REQUIRED');
  const uid = user.uid;
  const limitRef = db.collection('server_rate_limits').doc(`report_${hash(uid)}`);
  const targetHash = hash(payload.targetKey);
  const idemHash = hash(payload.idempotencyKey);
  const reportRef = db.collection('reports').doc();
  const timestamp = now();

  // Preserve the existing callable's open-report behavior during the pilot.
  const existing = await db.collection('reports').where('reporter_uid', '==', uid)
    .where('target_key', '==', payload.targetKey).where('status', '==', 'open').limit(1).get();
  if (!existing.empty) return result(200, 'ALREADY_REPORTED', { success: true, alreadyReported: true, id: existing.docs[0].id });

  const blocked = await Promise.all([
    db.collection('submission_blocks').doc(uid).get(),
    db.collection('report_blocks').doc(`uid_${uid}`).get(),
    db.collection('report_blocks').doc(`device_${payload.deviceHash}`).get(),
  ]);
  const expiry = blocked[0].data()?.expires_at;
  const expiryMs = expiry?.toDate?.()?.getTime() ?? new Date(expiry).getTime();
  if ((blocked[0].exists && Number.isFinite(expiryMs) && expiryMs > timestamp) || blocked[1].exists || blocked[2].exists)
    return result(403, 'REPORTER_BLOCKED');

  // Firestore-backed targets must exist; dataset POIs have no Firestore record.
  const collection = { spot: 'spots', poi_photo: 'poi_photos', social_post: 'social_posts' }[payload.targetType];
  let trustedSnapshot = payload.targetSnapshot;
  if (collection) {
    const target = await db.collection(collection).doc(payload.targetId).get();
    if (!target.exists || (payload.targetType === 'spot' && (target.data()?.is_public !== true
      || !['published', 'pending_trust'].includes(target.data()?.status)))
      || (payload.targetType === 'social_post' && target.data()?.status !== 'active')) return result(404, 'INVALID_TARGET');
    trustedSnapshot = {};
    for (const key of ['name', 'title', 'lat', 'lon', 'image', 'created_by']) {
      const value = target.data()?.[key];
      if (typeof value === 'string' || typeof value === 'number') trustedSnapshot[key] = String(value).slice(0, 500);
    }
  }

  let challenged = false;
  if (payload.turnstileToken) {
    if (!challengeSecret || !allowedHostnames?.length) return result(503, 'CHALLENGE_UNAVAILABLE');
    try {
      const check = await verifyChallenge(payload.turnstileToken, {
        secret: challengeSecret, expectedAction: 'submit_report', allowedHostnames, now: timestamp,
      });
      if (!check.ok) return result(403, 'INVALID_CHALLENGE', { reason: check.reason });
      challenged = true;
    } catch { return result(503, 'CHALLENGE_UNAVAILABLE'); }
  }

  return db.runTransaction(async tx => {
    const limit = await tx.get(limitRef);
    const old = limit.exists ? limit.data() : {};
    if (old.recentKeys?.[idemHash]?.expiresAt > timestamp) return result(200, 'ALREADY_REPORTED', { success: true, alreadyReported: true, id: old.recentKeys[idemHash].reportId });
    if (old.recentTargets?.[targetHash]?.expiresAt > timestamp) return result(200, 'ALREADY_REPORTED', { success: true, alreadyReported: true, id: old.recentTargets[targetHash].reportId });
    const hourStart = timestamp - Number(old.hourStart) < HOUR ? Number(old.hourStart) : timestamp;
    const shortStart = timestamp - Number(old.shortStart) < FIVE_MINUTES ? Number(old.shortStart) : timestamp;
    const hourCount = hourStart === old.hourStart ? Number(old.hourCount) || 0 : 0;
    const shortCount = shortStart === old.shortStart ? Number(old.shortCount) || 0 : 0;
    if (hourCount >= 8) return result(429, 'REPORT_HARD_LIMIT', {}, Math.max(1, Math.ceil((hourStart + HOUR - timestamp) / 1000)));
    if (shortCount >= 4) return result(429, 'REPORT_COOLDOWN', {}, Math.max(1, Math.ceil((shortStart + FIVE_MINUTES - timestamp) / 1000)));
    if (hourCount >= 2 && !challenged) {
      if (!challengeSecret || !allowedHostnames?.length) return result(503, 'CHALLENGE_UNAVAILABLE');
      return result(403, 'CHALLENGE_REQUIRED', { action: 'submit_report' });
    }
    const createdAt = new Date(timestamp).toISOString();
    const liveEntries = entries => Object.fromEntries(Object.entries(entries || {}).filter(([, entry]) => entry?.expiresAt > timestamp).slice(-192));
    const recentKeys = liveEntries(old.recentKeys);
    const recentTargets = liveEntries(old.recentTargets);
    recentKeys[idemHash] = { reportId: reportRef.id, expiresAt: timestamp + DAY };
    recentTargets[targetHash] = { reportId: reportRef.id, expiresAt: timestamp + DAY };
    tx.set(limitRef, { hourStart, hourCount: hourCount + 1, shortStart, shortCount: shortCount + 1,
      recentKeys, recentTargets, updatedAt: createdAt });
    tx.set(reportRef, { category: payload.category, subject: payload.subject, message: payload.message,
      target_type: payload.targetType, target_id: payload.targetId, target_key: payload.targetKey,
      target_snapshot: trustedSnapshot, status: 'open', reporter_uid: uid, reporter_email: user.email || null,
      ip_hash: null, device_hash: payload.deviceHash, created_at: createdAt, recaptcha_score: null });
    return result(200, 'REPORT_CREATED', { success: true, id: reportRef.id });
  });
}
