const crypto = require('node:crypto');

// Server-owned, per-spot state. Triggers always read the current document, so
// delivery order and duplicate events cannot replay an older public value.
const publicFields = ['is_public', 'status', 'needs_review', 'discovery_state', 'flag_count',
  'sensitive_location', 'lat', 'lng', 'title', 'category', 'locality', 'tags', 'spot_type',
  // Ratings are refreshed during scheduled/manual full reconciliation, not
  // journaled on every interaction.
  'access_difficulty', 'has_social', 'created_date',
  'public_thumbnail_url', 'resolved_category'];

function fingerprint(data) {
  const selected = Object.fromEntries(publicFields.map(key => [key, data?.[key] ?? null]));
  return crypto.createHash('sha256').update(JSON.stringify(selected)).digest('hex');
}

function publishable(data) {
  return Boolean(data && data.is_public === true && data.status === 'published'
    && data.needs_review !== true && data.discovery_state !== 'hidden'
    && (data.flag_count == null || data.flag_count === 0)
    && data.sensitive_location !== true && Number.isFinite(data.lat)
    && Number.isFinite(data.lng) && data.lat >= -90 && data.lat <= 90
    && data.lng >= -180 && data.lng <= 180);
}

function initialJournal(data) {
  return { fingerprint: fingerprint(data), version: 1, ever_public: publishable(data),
    dirty: true, updated_at: new Date().toISOString() };
}

async function mutateSpotWithPublication(db, spotId, { patch = null, remove = false, authorize = () => true } = {}) {
  if (!spotId || spotId.includes('/') || (remove && patch)) throw new TypeError('Invalid spot mutation');
  const spotRef = db.collection('spots').doc(spotId);
  const journalRef = db.collection('spot_snapshot_changes').doc(spotId);
  const feedRef = db.collection('spot_snapshot_revocation_feed').doc('current');
  const revokedRef = db.collection('spot_snapshot_revocations').doc(spotId);
  return db.runTransaction(async tx => {
    const [spot, journal, feed] = await Promise.all([tx.get(spotRef), tx.get(journalRef), tx.get(feedRef)]);
    if (!spot.exists) return { found: false };
    const before = spot.data();
    if (!authorize(before)) return { found: true, authorized: false };
    const after = remove ? null : { ...before, ...patch };
    const wasPublic = publishable(before) || journal.data()?.ever_public === true;
    const nowPublic = publishable(after);
    const shouldRevoke = wasPublic && !nowPublic;
    const nextHash = fingerprint(after);
    const journalChanged = !journal.exists || journal.data().fingerprint !== nextHash || shouldRevoke;
    if (remove) tx.delete(spotRef);
    else tx.update(spotRef, patch);
    if (journalChanged) tx.set(journalRef, { fingerprint: nextHash,
      version: (journal.data()?.version || 0) + 1, ever_public: wasPublic || nowPublic,
      dirty: true, updated_at: new Date().toISOString() }, { merge: true });
    if (shouldRevoke) {
      const ids = feed.exists && Array.isArray(feed.data().revoked) ? feed.data().revoked : null;
      if (!ids || (ids.length >= 500 && !ids.includes(spotId))) throw new Error('Revocation feed unavailable or full');
      if (!ids.includes(spotId)) tx.update(feedRef, { revoked: [...ids, spotId], updated_at: new Date().toISOString() });
      tx.set(revokedRef, { revoked: true, at: new Date().toISOString() }, { merge: true });
    }
    return { found: true, authorized: true, revoked: shouldRevoke, journalChanged };
  });
}

async function recordSpotChange(db, spotId, { forceRevoke = false, wasPublic = false } = {}) {
  if (!spotId || spotId.includes('/')) throw new TypeError('Invalid spot ID');
  const spotRef = db.collection('spots').doc(spotId);
  const journalRef = db.collection('spot_snapshot_changes').doc(spotId);
  const revokedRef = db.collection('spot_snapshot_revocations').doc(spotId);
  const feedRef = db.collection('spot_snapshot_revocation_feed').doc('current');
  return db.runTransaction(async tx => {
    const [spot, journal, feed] = await Promise.all([tx.get(spotRef), tx.get(journalRef), tx.get(feedRef)]);
    const data = spot.exists ? spot.data() : null;
    const hash = fingerprint(data);
    const prior = journal.exists ? journal.data() : null;
    const visible = publishable(data);
    const everPublic = visible || wasPublic || prior?.ever_public === true;
    const unsafe = (forceRevoke && everPublic) || (!visible && (wasPublic || prior?.ever_public === true));
    const feedIds = feed.exists && Array.isArray(feed.data().revoked) ? feed.data().revoked : null;
    if (prior?.fingerprint === hash && (!unsafe || feedIds?.includes(spotId))) return false;
    tx.set(journalRef, { fingerprint: hash, version: (prior?.version || 0) + 1,
      ever_public: everPublic, dirty: true, updated_at: new Date().toISOString() }, { merge: true });
    // Tombstones are permanent for this phase. Republished IDs need a reviewed
    // reset protocol; old static deployment URLs can otherwise resurrect them.
    if (unsafe) {
      const ids = feedIds;
      if (!ids) throw new Error('Revocation feed unavailable');
      if (!ids.includes(spotId)) {
        if (ids.length >= 500) throw new Error('Snapshot revocation feed is full');
        tx.set(feedRef, { format: 1, revoked: [...ids, spotId], updated_at: new Date().toISOString() });
      }
      tx.set(revokedRef, { revoked: true, at: new Date().toISOString() }, { merge: true });
    }
    return true;
  });
}

module.exports = { recordSpotChange, mutateSpotWithPublication, fingerprint, publishable, initialJournal };
