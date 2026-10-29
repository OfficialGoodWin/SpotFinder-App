import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import policy from '../functions/poiRatingPolicy.js';
import { visiblePoiRatings } from '../src/lib/poiRatings.js';

const { validatePoiRatingInput, ratingDocumentId, moderationForRating, upsertPoiRating } = policy;
const poiId = '50.0000_14.0000_test';
const safeScore = () => ({ score: 0, reasons: [] });

test('rating input and moderation use review, not comment', () => {
  assert.deepEqual(validatePoiRatingInput({ poiId, rating: 4, review: 'Useful review' }),
    { poiId, rating: 4, review: 'Useful review' });
  for (const input of [
    { poiId: 'invalid~poi', rating: 4, review: '' },
    { poiId, rating: 6, review: '' },
    { poiId, rating: 4.5, review: '' },
    { poiId, rating: 4, review: 42 },
    { poiId, rating: 4, review: 'x'.repeat(1001) },
    { poiId, rating: 4, review: '', created_by_uid: 'other' },
    { poiId, rating: 4, review: '', hidden: false },
  ]) assert.throws(() => validatePoiRatingInput(input));
  let inspected;
  const result = moderationForRating({ review: 'blocked review', comment: 'ignore this' }, text => {
    inspected = text;
    return { score: 5, reasons: ['blocked_term'] };
  });
  assert.equal(inspected, 'blocked review');
  assert.equal(result.hidden, true);
  assert.equal(result.moderation_note, 'auto_hidden:blocked_term');
  assert.equal(ratingDocumentId(poiId, 'owner'), ratingDocumentId(poiId, 'owner'));
  assert.notEqual(ratingDocumentId(poiId, 'owner'), ratingDocumentId(poiId, 'other'));
});

test('both POI views receive one visible vote per UID and readable review text', () => {
  const rows = visiblePoiRatings([
    { id: 'new', created_by_uid: 'owner', rating: 5, review: 'Edited text' },
    { id: 'old', created_by_uid: 'owner', rating: 1, review: 'Legacy text' },
    { id: 'other', created_by_uid: 'other', rating: 3, review: 'Another review' },
    { id: 'hidden', created_by_uid: 'third', rating: 1, review: 'Spam', hidden: true },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].comment, 'Edited text');
  assert.equal(rows.reduce((sum, row) => sum + row.rating, 0) / rows.length, 4);
});

test('emulator transaction creates one rating, edits it, and preserves legacy documents',
  { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const app = initializeApp({ projectId: 'demo-spotfinder-poi-ratings' }, 'poi-ratings-test');
    const db = getFirestore(app);
    try {
      const input = validatePoiRatingInput({ poiId, rating: 5, review: 'First review' });
      const first = await upsertPoiRating({ db, uid: 'owner', input, spamScore: safeScore });
      assert.equal(first.updated, false);
      assert.equal(first.id, ratingDocumentId(poiId, 'owner'));
      const second = await upsertPoiRating({ db, uid: 'owner',
        input: validatePoiRatingInput({ poiId, rating: 4, review: 'Edited review' }), spamScore: safeScore });
      assert.equal(second.updated, true);
      assert.equal(second.id, first.id);
      const ownerRows = await db.collection('poi_ratings').where('poi_id', '==', poiId)
        .where('created_by_uid', '==', 'owner').get();
      assert.equal(ownerRows.size, 1);
      assert.equal(ownerRows.docs[0].data().review, 'Edited review');
      assert.equal(ownerRows.docs[0].data().created_by_uid, 'owner');
      await upsertPoiRating({ db, uid: 'other', input, spamScore: safeScore });
      const otherRows = await db.collection('poi_ratings').where('poi_id', '==', poiId)
        .where('created_by_uid', '==', 'other').get();
      assert.equal(otherRows.size, 1);

      const concurrentPoi = '52.0000_16.0000_race';
      const concurrentInput = validatePoiRatingInput({ poiId: concurrentPoi, rating: 3, review: 'Concurrent review' });
      await Promise.allSettled([
        upsertPoiRating({ db, uid: 'race-owner', input: concurrentInput, spamScore: safeScore }),
        upsertPoiRating({ db, uid: 'race-owner', input: concurrentInput, spamScore: safeScore }),
      ]);
      const concurrentRows = await db.collection('poi_ratings').where('poi_id', '==', concurrentPoi)
        .where('created_by_uid', '==', 'race-owner').get();
      assert.equal(concurrentRows.size, 1);

      const legacyPoi = '51.0000_15.0000_legacy';
      await db.collection('poi_ratings').doc('legacy-one').set({ poi_id: legacyPoi,
        created_by_uid: 'legacy-owner', rating: 1, review: 'Keep original one', created_date: '2025-01-01' });
      await db.collection('poi_ratings').doc('legacy-two').set({ poi_id: legacyPoi,
        created_by_uid: 'legacy-owner', rating: 2, review: 'Keep original two', created_date: '2025-01-02' });
      const legacyResult = await upsertPoiRating({ db, uid: 'legacy-owner',
        input: validatePoiRatingInput({ poiId: legacyPoi, rating: 5, review: 'Updated by owner' }), spamScore: safeScore });
      assert.equal(legacyResult.updated, true);
      const legacyRows = await db.collection('poi_ratings').where('poi_id', '==', legacyPoi).get();
      assert.equal(legacyRows.size, 2);
      assert.equal(legacyRows.docs.filter(doc => doc.data().hidden !== true).length, 1);
      assert.equal(legacyRows.docs.find(doc => doc.data().duplicate_superseded === true).data().review, 'Keep original one');
    } finally { await deleteApp(app); }
  });
