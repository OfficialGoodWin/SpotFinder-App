/**
 * Cloud Functions — moderation & anti-spam enforcement layer.
 *
 * WHY THIS FILE EXISTS
 * ---------------------
 * Firestore Security Rules can validate the *shape* of a write (field types,
 * ranges, ownership) but cannot: run text-spam heuristics, maintain
 * cross-document counters safely, or apply per-user/per-IP rate limits.
 * The client-side checks in src/lib/moderation.js are trivially bypassed by
 * anyone calling the Firebase SDK directly. This file is the real
 * enforcement point: it runs with the Admin SDK (bypasses Security Rules)
 * and is the only thing allowed to change moderation/aggregate fields.
 *
 * Deploy with: firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
admin.initializeApp();
const db = admin.firestore();

// ─── Feedback email notifications ──────────────────────────────────────────
// The feedback form in FAQ.jsx was only ever writing to Firestore — nothing
// ever sent a notification anywhere, so submissions silently piled up with
// no alert to the team. This uses SMTP via nodemailer; set these as Cloud
// Functions config/env vars before deploying:
//   firebase functions:config:set smtp.host="smtp.example.com" smtp.port="587" \
//     smtp.user="you@example.com" smtp.pass="app-password" \
//     feedback.to="redm1234@outlook.cz"
// (Any SMTP provider works — Gmail with an App Password, SendGrid, Postmark,
// your email host's SMTP, etc. Swap in a provider-specific SDK instead of
// nodemailer if you prefer.)
function getMailTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP environment variables are not configured.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendFeedbackEmail(feedback) {
  const transport = getMailTransport();
  await transport.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.FEEDBACK_TO || 'redm1234@outlook.cz',
    replyTo: feedback.email || undefined,
    subject: 'New SpotFinder feedback',
    text: [
      `From: ${feedback.email || '(no email given)'}`,
      `Language: ${feedback.language || 'unknown'}`,
      '',
      feedback.message || '',
    ].join('\n'),
  });
}
// ─── Shared spam heuristics (server-side source of truth) ─────────────────
const BLOCKED_SUBSTRINGS = [
  'viagra', 'porn', 'xxx', 'nudes', 'onlyfans',
  'crypto airdrop', 'free bitcoin', 'click here to claim',
  'whatsapp me', 'telegram me', 'nigerian prince',
];
const URL_REGEX = /(https?:\/\/|www\.)[^\s]+/gi;
const REPEATED_CHAR_REGEX = /(.)\1{6,}/;
const REPEATED_WORD_REGEX = /\b(\w+)\b(?:\s+\1\b){3,}/i;

function getRequestIp(context) {
  const req = context?.rawRequest;
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req?.socket?.remoteAddress || req?.ip || 'unknown';
}

function hashIp(ip) {
  const salt = process.env.ANTI_SPAM_IP_SALT || process.env.RECAPTCHA_SECRET_KEY || 'spotfinder-anti-spam';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

function isAllowedRecaptchaHostname(hostname) {
  const configured = (process.env.RECAPTCHA_ALLOWED_HOSTNAMES || 'spotfinder.cz,www.spotfinder.cz,localhost,127.0.0.1')
    .split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  return configured.includes(String(hostname || '').toLowerCase());
}

async function verifyRecaptcha(token, action) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) throw new Error('RECAPTCHA_SECRET_KEY is not configured');
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing_token' };

  const body = new URLSearchParams({ secret, response: token });
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error(`reCAPTCHA verification HTTP ${response.status}`);
  const result = await response.json();
  return {
    ok: result.success === true
      && Number(result.score || 0) >= Number(process.env.RECAPTCHA_MIN_SCORE || 0.5)
      && result.action === action
      && isAllowedRecaptchaHostname(result.hostname),
    score: Number(result.score || 0),
    hostname: result.hostname || '',
    reason: result['error-codes']?.join(',') || '',
  };
}

async function checkIpRateLimit(ipHash, action, max, windowMs) {
  return checkServerRateLimit(`ip_${ipHash}`, action, max, windowMs);
}

function spamScore(text = '') {
  const raw = String(text || '').trim();
  let score = 0;
  const reasons = [];
  if (raw.length > 2000) { score += 2; reasons.push('too_long'); }
  const lower = raw.toLowerCase();
  if (BLOCKED_SUBSTRINGS.some((t) => lower.includes(t))) { score += 5; reasons.push('blocked_term'); }
  const links = raw.match(URL_REGEX) || [];
  if (links.length > 1) { score += 3; reasons.push('excess_links'); }
  if (REPEATED_CHAR_REGEX.test(raw)) { score += 2; reasons.push('repeated_characters'); }
  if (REPEATED_WORD_REGEX.test(raw)) { score += 2; reasons.push('repeated_words'); }
  return { score, reasons };
}

// ─── Per-user rate limiting via a transactional counter doc ────────────────
// Returns true if the action is allowed (and records it).
async function checkServerRateLimit(uid, action, max, windowMs) {
  const ref = db.collection('rate_limits').doc(`${uid}_${action}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? snap.data() : { count: 0, windowStart: now };
    if (now - data.windowStart > windowMs) {
      tx.set(ref, { count: 1, windowStart: now });
      return true;
    }
    if (data.count >= max) return false;
    tx.set(ref, { count: data.count + 1, windowStart: data.windowStart });
    return true;
  });
}

// Best-effort caller identity: Firestore triggers don't carry the writer's
// source IP, so IP-based bans (ip_bans collection) can only be enforced on
// requests that pass through an HTTPS callable/endpoint (e.g. put the
// create-spot / create-rating calls behind a callable function instead of
// direct client SDK writes) or via a Cloud Armor / App Check rule at the
// edge. This trigger enforces what it *can* see: per-account rate limits
// and content heuristics.

// ─── Spots: rate-limit + spam scan on create ───────────────────────────────
exports.onSpotCreated = functions.firestore
  .document('spots/{spotId}')
  .onCreate(async (snap, context) => {
    const spot = snap.data();
    const uid = context.auth?.uid;

    const updates = {};

    if (uid) {
      const allowed = await checkServerRateLimit(uid, 'add_spot', 10, 24 * 60 * 60 * 1000); // 10/day
      if (!allowed) {
        updates.status = 'flagged';
        updates.moderation_note = 'auto_flagged:rate_limit_exceeded';
      }
    }

    const { score, reasons } = spamScore(spot.description);
    if (score >= 5) {
      updates.status = 'flagged';
      updates.moderation_note = `auto_flagged:${reasons.join(',')}`;
    } else if (score > 0) {
      updates.needs_review = true;
      updates.moderation_note = `low_confidence:${reasons.join(',')}`;
    }

    if (Object.keys(updates).length > 0) {
      await snap.ref.update(updates);
    }
  });

// ─── Per-user spot ratings: recompute trusted aggregates ───────────────────
// Client writes a small per-user doc (validated by Security Rules); this
// function is the ONLY thing that ever updates the aggregate fields on the
// parent spot, so no client can fabricate an average rating.
exports.onSpotRatingWritten = functions.firestore
  .document('spot_ratings/{ratingId}')
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : change.before.data();
    const spotId = after.spot_id;
    if (!spotId) return;

    const ratingsSnap = await db.collection('spot_ratings').where('spot_id', '==', spotId).get();
    const rows = ratingsSnap.docs.map((d) => d.data());

    const avg = (field) => {
      const vals = rows.map((r) => r[field]).filter((v) => typeof v === 'number' && v > 0);
      return vals.length
        ? { avg: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10, count: vals.length }
        : { avg: 0, count: 0 };
    };

    const parking = avg('parking');
    const beauty = avg('beauty');
    const privacy = avg('privacy');
    const overallVals = [parking.avg, beauty.avg, privacy.avg].filter((v) => v > 0);
    const overall = overallVals.length
      ? Math.round((overallVals.reduce((s, v) => s + v, 0) / overallVals.length) * 10) / 10
      : 0;

    await db.collection('spots').doc(spotId).update({
      parking_rating: parking.avg, parking_rating_count: parking.count,
      beauty_rating: beauty.avg, beauty_rating_count: beauty.count,
      privacy_rating: privacy.avg, privacy_rating_count: privacy.count,
      rating: overall, rating_count: rows.length,
    });
  });

// ─── Flags: recompute flag_count / auto-hide server-side ───────────────────
const FLAG_AUTO_HIDE_THRESHOLD = 3;

exports.onFlagCreated = functions.firestore
  .document('flags/{flagId}')
  .onCreate(async (snap) => {
    const flag = snap.data();
    const spotId = flag.spot_id;
    if (!spotId) return;

    const openFlags = await db.collection('flags')
      .where('spot_id', '==', spotId)
      .where('status', '==', 'open')
      .get();

    const updates = { flag_count: openFlags.size };
    if (openFlags.size >= FLAG_AUTO_HIDE_THRESHOLD) {
      updates.status = 'flagged';
    }
    await db.collection('spots').doc(spotId).update(updates);
  });

// ─── POI ratings / reviews: spam scan on create ────────────────────────────
exports.onPoiRatingCreated = functions.firestore
  .document('poi_ratings/{docId}')
  .onCreate(async (snap, context) => {
    const rating = snap.data();
    const uid = context.auth?.uid;

    if (uid) {
      const allowed = await checkServerRateLimit(uid, 'poi_rating', 20, 60 * 60 * 1000); // 20/hour
      if (!allowed) {
        await snap.ref.update({ hidden: true, moderation_note: 'auto_hidden:rate_limit_exceeded' });
        return;
      }
    }

    const { score, reasons } = spamScore(rating.comment);
    if (score >= 5) {
      await snap.ref.update({ hidden: true, moderation_note: `auto_hidden:${reasons.join(',')}` });
    } else if (score > 0) {
      await snap.ref.update({ needs_review: true, moderation_note: `low_confidence:${reasons.join(',')}` });
    }
  });

// ─── Feedback: protected public submit endpoint ─────────────────────────────
// Guest-friendly: Firebase anonymous auth supplies a stable session key while
// reCAPTCHA + IP limits stop an attacker from creating unlimited sessions.
exports.submitFeedback = functions.https.onCall(async (data, context) => {
  const payload = data || {};
  const message = String(payload.message || '').trim();
  const email = String(payload.email || '').trim().slice(0, 320);
  const language = String(payload.language || 'en').trim().slice(0, 16);
  const recaptchaToken = payload.recaptchaToken;

  if (!message) {
    throw new functions.https.HttpsError('invalid-argument', 'Message is required.');
  }
  if (message.length > 3000) {
    throw new functions.https.HttpsError('invalid-argument', 'Message is too long.');
  }

  const captcha = await verifyRecaptcha(recaptchaToken, 'feedback');
  if (!captcha.ok) {
    console.warn('Feedback rejected by reCAPTCHA', { score: captcha.score, hostname: captcha.hostname, reason: captcha.reason });
    throw new functions.https.HttpsError('permission-denied', 'reCAPTCHA verification failed.');
  }

  const ipHash = hashIp(getRequestIp(context));
  const uid = context.auth?.uid || 'no-auth';
  const sessionAllowed = await checkServerRateLimit(uid, 'feedback', 5, 60 * 60 * 1000);
  const ipAllowed = await checkIpRateLimit(ipHash, 'feedback', 10, 60 * 60 * 1000);

  if (!sessionAllowed || !ipAllowed) {
    throw new functions.https.HttpsError('resource-exhausted', 'Too many feedback submissions. Try again later.');
  }

  const spam = spamScore(message);
  const ref = db.collection('feedback').doc();
  await ref.set({
    email: email || null,
    message,
    language,
    created_at: new Date().toISOString(),
    recaptcha_score: captcha.score,
    recaptcha_action: 'feedback',
    anonymous_session: context.auth?.token?.firebase?.sign_in_provider === 'anonymous',
    ip_hash: ipHash,
    hidden: spam.score >= 5,
    moderation_note: spam.score >= 5 ? `auto_hidden:${spam.reasons.join(',')}` : (spam.score > 0 ? `low_confidence:${spam.reasons.join(',')}` : null),
  });

  // `onFeedbackCreated` remains the single notification path, so a successful
  // callable submission produces exactly one email.
  return { success: true, id: ref.id };
});

// ─── Feedback: legacy trigger / defense-in-depth ──────────────────────────
exports.onFeedbackCreated = functions.firestore
  .document('feedback/{docId}')
  .onCreate(async (snap) => {
    const feedback = snap.data();
    const { score, reasons } = spamScore(feedback.message);
    if (score >= 5) {
      await snap.ref.update({ hidden: true, moderation_note: `auto_hidden:${reasons.join(',')}` });
      return; // don't email obvious spam
    }

    await sendFeedbackEmail(feedback).catch((err) => {
      // Never let a broken mail provider block feedback from being saved —
      // it's already in Firestore either way, this is just the notification.
      console.error('Failed to send feedback notification email:', err);
    });
  });

// ─── Votes: recompute trusted up/down aggregates server-side ───────────────
// Mirrors onSpotRatingWritten — clients write only their own vote doc
// (validated by Security Rules), this function is the only thing allowed to
// touch upvote_count/downvote_count/quality_score on the spot.
exports.onVoteWritten = functions.firestore
  .document('votes/{voteId}')
  .onWrite(async (change) => {
    const data = change.after.exists ? change.after.data() : change.before.data();
    const spotId = data?.spot_id;
    if (!spotId) return;

    const votesSnap = await db.collection('votes').where('spot_id', '==', spotId).get();
    let up = 0, down = 0;
    votesSnap.forEach((d) => {
      const type = d.data().type;
      if (type === 'up') up += 1;
      else if (type === 'down') down += 1;
    });

    await db.collection('spots').doc(spotId).update({
      upvote_count: up,
      downvote_count: down,
      quality_score: up - down,
    });
  });

// ─── Admin audit log helper, called from the admin-only functions below ────
async function logAdminAction(action, performedBy, details = {}) {
  await db.collection('admin_audit_log').add({
    action,
    performed_by: performedBy,
    performed_at: new Date().toISOString(),
    ...details,
  });
}

function assertIsAdmin(context) {
  const isAdmin = context.auth?.token?.admin === true || context.auth?.token?.email === 'superadmin@spotfinder.cz';
  if (!context.auth || !isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
}

// ─── Admin actions as callables (so every admin action is logged server-side,
// instead of trusting the client to also write an audit entry) ─────────────
exports.adminBanIP = functions.https.onCall(async (data, context) => {
  assertIsAdmin(context);
  const { ip, reason } = data || {};
  if (!ip) throw new functions.https.HttpsError('invalid-argument', 'ip is required.');
  await db.collection('ip_bans').doc(ip).set({
    ip, reason: reason || 'Violation of terms', banned_by: context.auth.token.email, banned_at: new Date().toISOString(),
  });
  await logAdminAction('ban_ip', context.auth.token.email, { ip, reason });
  return { success: true };
});

exports.adminUnbanIP = functions.https.onCall(async (data, context) => {
  assertIsAdmin(context);
  const { ip } = data || {};
  if (!ip) throw new functions.https.HttpsError('invalid-argument', 'ip is required.');
  await db.collection('ip_bans').doc(ip).delete();
  await logAdminAction('unban_ip', context.auth.token.email, { ip });
  return { success: true };
});

exports.adminResolveFlag = functions.https.onCall(async (data, context) => {
  assertIsAdmin(context);
  const { flagId, resolution } = data || {};
  if (!flagId || !['upheld', 'dismissed'].includes(resolution)) {
    throw new functions.https.HttpsError('invalid-argument', 'flagId and a valid resolution are required.');
  }
  await db.collection('flags').doc(flagId).update({
    status: 'resolved', resolution, resolved_date: new Date().toISOString(),
  });
  await logAdminAction('resolve_flag', context.auth.token.email, { flagId, resolution });
  return { success: true };
});

exports.adminDeleteSpot = functions.https.onCall(async (data, context) => {
  assertIsAdmin(context);
  const { spotId } = data || {};
  if (!spotId) throw new functions.https.HttpsError('invalid-argument', 'spotId is required.');
  await db.collection('spots').doc(spotId).delete();
  await logAdminAction('delete_spot', context.auth.token.email, { spotId });
  return { success: true };
});

exports.setAdminClaim = require('./setAdminClaim').setAdminClaim;
