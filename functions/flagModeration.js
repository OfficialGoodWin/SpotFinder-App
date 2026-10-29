'use strict';

const FLAG_AUTO_HIDE_THRESHOLD = 3;
const RESTORABLE_STATUSES = new Set(['published', 'pending_trust']);

class FlagModerationError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function countDistinctOpenFlags(snapshot, excludeId = null) {
  const reporters = new Set();
  for (const row of snapshot.docs) {
    if (row.id === excludeId) continue;
    const email = row.data().reporter_email;
    if (typeof email === 'string' && email.trim()) reporters.add(email.trim().toLowerCase());
  }
  return reporters.size;
}

function spotFlagPatch(spot, openCount, { upheld = false, deleteField }) {
  const patch = {};
  if (spot.flag_count !== openCount) patch.flag_count = openCount;
  const marker = spot.auto_flag_moderation;

  if (upheld) {
    if (RESTORABLE_STATUSES.has(spot.status) || spot.status === 'flagged') patch.status = 'hidden';
    if (marker) patch.auto_flag_moderation = deleteField();
    return patch;
  }
  if (openCount >= FLAG_AUTO_HIDE_THRESHOLD && spot.is_public === true
      && RESTORABLE_STATUSES.has(spot.status)) {
    patch.status = 'flagged';
    patch.auto_flag_moderation = { previous_status: spot.status, threshold: FLAG_AUTO_HIDE_THRESHOLD };
  } else if (openCount < FLAG_AUTO_HIDE_THRESHOLD && marker) {
    if (spot.status === 'flagged' && spot.is_public === true
        && RESTORABLE_STATUSES.has(marker.previous_status)) patch.status = marker.previous_status;
    patch.auto_flag_moderation = deleteField();
  }
  return patch;
}

async function reconcileSpotFlags({ db, spotId, deleteField, resolution = null, flagId = null }) {
  if (typeof spotId !== 'string' || !spotId || spotId.includes('/'))
    throw new FlagModerationError('invalid-argument', 'Invalid spot ID.');
  return db.runTransaction(async tx => {
    let flagRef, flagSnapshot, alreadyResolved = false;
    if (flagId) {
      flagRef = db.collection('flags').doc(flagId);
      flagSnapshot = await tx.get(flagRef);
      if (!flagSnapshot.exists || flagSnapshot.data().spot_id !== spotId)
        throw new FlagModerationError('not-found', 'Flag not found.');
      if (flagSnapshot.data().status !== 'open') {
        if (flagSnapshot.data().status !== 'resolved' || flagSnapshot.data().resolution !== resolution)
          throw new FlagModerationError('failed-precondition', 'Flag was already resolved differently.');
        alreadyResolved = true;
      }
    }
    const spotRef = db.collection('spots').doc(spotId);
    const spotSnapshot = await tx.get(spotRef);
    const openFlags = await tx.get(db.collection('flags').where('spot_id', '==', spotId).where('status', '==', 'open'));
    const openCount = countDistinctOpenFlags(openFlags, flagSnapshot && !alreadyResolved ? flagId : null);
    if (!alreadyResolved && flagRef) tx.update(flagRef, {
      status: 'resolved', resolution, resolved_date: new Date().toISOString(),
    });
    if (!spotSnapshot.exists) return { spotId, openCount, spotStatus: null, alreadyResolved };
    const patch = spotFlagPatch(spotSnapshot.data(), openCount, {
      upheld: resolution === 'upheld' && !alreadyResolved, deleteField,
    });
    if (Object.keys(patch).length) tx.update(spotRef, patch);
    return { spotId, openCount, spotStatus: patch.status || spotSnapshot.data().status, alreadyResolved };
  });
}

module.exports = { countDistinctOpenFlags, spotFlagPatch, reconcileSpotFlags, FlagModerationError };
