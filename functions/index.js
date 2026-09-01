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
admin.initializeApp();
const db = admin.firestore();

// ─── Shared spam heuristics (server-side source of truth) ─────────────────
const BLOCKED_SUBSTRINGS = [
  'viagra', 'porn', 'xxx', 'nudes', 'onlyfans',
  'crypto airdrop', 'free bitcoin', 'click here to claim',
  'whatsapp me', 'telegram me', 'nigerian prince',
];
const URL_REGEX = /(https?:\/\/|www\.)[^\s]+/gi;
const REPEATED_CHAR_REGEX = /(.)\1{6,}/;
const REPEATED_WORD_REGEX = /\b(\w+)\b(?:\s+\1\b){3,}/i;

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

// ─── Feedback: spam scan (public, unauthenticated write surface) ──────────
exports.onFeedbackCreated = functions.firestore
  .document('feedback/{docId}')
  .onCreate(async (snap) => {
    const feedback = snap.data();
    const { score, reasons } = spamScore(feedback.message);
    if (score >= 5) {
      await snap.ref.update({ hidden: true, moderation_note: `auto_hidden:${reasons.join(',')}` });
    }
  });
