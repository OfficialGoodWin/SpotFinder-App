'use strict';

const crypto = require('crypto');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

// Share the API pilot's recentTargets claim so cached callable clients and
// the Vercel route cannot create two open reports for the same UID and target.
async function createLegacyReportWithClaim({ db, uid, targetKey, report, now = Date.now() }) {
  const claimRef = db.collection('server_rate_limits').doc(`report_${hash(uid)}`);
  const reportRef = db.collection('reports').doc();
  const targetHash = hash(targetKey);
  return db.runTransaction(async tx => {
    const claimSnap = await tx.get(claimRef);
    const old = claimSnap.exists ? claimSnap.data() : {};
    const claimed = old.recentTargets?.[targetHash];
    if (claimed?.expiresAt > now) return { success: true, alreadyReported: true, id: claimed.reportId };
    const existing = await tx.get(db.collection('reports').where('reporter_uid', '==', uid)
      .where('target_key', '==', targetKey).where('status', '==', 'open').limit(1));
    if (!existing.empty) return { success: true, alreadyReported: true, id: existing.docs[0].id };
    const recentTargets = Object.fromEntries(Object.entries(old.recentTargets || {})
      .filter(([, entry]) => entry?.expiresAt > now).slice(-192));
    recentTargets[targetHash] = { reportId: reportRef.id, expiresAt: now + 86400000 };
    tx.set(claimRef, { recentTargets }, { merge: true });
    tx.create(reportRef, report);
    return { success: true, id: reportRef.id };
  });
}

module.exports = { createLegacyReportWithClaim };
