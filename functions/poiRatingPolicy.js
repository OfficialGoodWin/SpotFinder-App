'use strict';

const crypto = require('node:crypto');

// The current POI UI uses makePOIId(lat, lon, name) for ratings on both views.
const POI_ID_PATTERN = /^-?\d{1,3}\.\d{4}_-?\d{1,3}\.\d{4}_[a-z0-9]{0,20}$/;

function validatePoiRatingInput(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)
      || Object.keys(data).some(key => !['poiId', 'rating', 'review'].includes(key))) {
    throw new TypeError('Invalid POI rating fields');
  }
  const poiId = data?.poiId;
  const rating = data?.rating;
  const review = data?.review;
  if (typeof poiId !== 'string' || !POI_ID_PATTERN.test(poiId)
      || !Number.isInteger(rating) || rating < 1 || rating > 5
      || typeof review !== 'string' || review.length > 1000) {
    throw new TypeError('Invalid POI rating or review');
  }
  return { poiId, rating, review };
}

function ratingDocumentId(poiId, uid) {
  return `rating_${crypto.createHash('sha256').update(JSON.stringify([poiId, uid])).digest('hex')}`;
}

function moderationForRating(ratingRecord, spamScore) {
  const { score, reasons } = spamScore(ratingRecord.review);
  return {
    hidden: score >= 5,
    needs_review: score > 0 && score < 5,
    moderation_note: score >= 5 ? `auto_hidden:${reasons.join(',')}`
      : score > 0 ? `low_confidence:${reasons.join(',')}` : null,
  };
}

async function upsertPoiRating({ db, uid, input, spamScore }) {
  const ratings = db.collection('poi_ratings');
  const canonical = ratings.doc(ratingDocumentId(input.poiId, uid));
  const existingQuery = ratings.where('poi_id', '==', input.poiId)
    .where('created_by_uid', '==', uid).limit(26);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(existingQuery);
    if (snapshot.size > 25) throw new Error('legacy-duplicate-limit');
    const existing = snapshot.docs.sort((a, b) =>
      String(b.data().created_date || '').localeCompare(String(a.data().created_date || '')) || a.id.localeCompare(b.id));
    const target = existing.find(doc => doc.id === canonical.id)
      || existing.find(doc => doc.data().duplicate_superseded !== true) || existing[0];
    const moderation = moderationForRating(input, spamScore);
    const prior = target?.data() || {};
    const preserveHidden = prior.hidden === true
      && prior.duplicate_superseded !== true
      && !String(prior.moderation_note || '').startsWith('auto_hidden:');
    const payload = {
      rating: input.rating, review: input.review, updated_date: new Date().toISOString(),
      hidden: preserveHidden || moderation.hidden,
      needs_review: moderation.needs_review,
      moderation_note: moderation.moderation_note || (preserveHidden ? prior.moderation_note || null : null),
      duplicate_superseded: false,
    };
    if (target) transaction.update(target.ref, payload);
    else transaction.create(canonical, {
      poi_id: input.poiId, created_by: 'registered-account', created_by_uid: uid,
      created_date: new Date().toISOString(), source: 'trusted_callable', ...payload,
    });
    for (const duplicate of existing) {
      if (duplicate.id !== target?.id) transaction.update(duplicate.ref, { duplicate_superseded: true, hidden: true });
    }
    return { id: target?.id || canonical.id, updated: Boolean(target) };
  });
}

module.exports = { validatePoiRatingInput, ratingDocumentId, moderationForRating, upsertPoiRating };
