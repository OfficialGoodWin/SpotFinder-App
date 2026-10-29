'use strict';

async function isSubmissionBlocked(db, uid, now = Date.now()) {
  if (!uid) return false;
  const block = await db.collection('submission_blocks').doc(uid).get();
  if (!block.exists) return false;
  const expiry = block.data()?.expires_at;
  const expiryDate = expiry?.toDate?.() || new Date(expiry);
  return Number.isFinite(expiryDate.getTime()) && expiryDate.getTime() > now;
}

module.exports = { isSubmissionBlocked };
