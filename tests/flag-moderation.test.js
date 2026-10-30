import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { reconcileSpotFlags } = require('../functions/flagModeration.js');
const { isSubmissionBlocked } = require('../functions/submissionBlock.js');

test('flag reconciliation, moderation decisions, retries and account blocks',
  { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const app = initializeApp({ projectId: 'demo-spotfinder-fix5-validation' }, 'fix5-validation');
    const db = getFirestore(app);
    const reconcile = (spotId, extra = {}) => reconcileSpotFlags({ db, spotId,
      deleteField: () => FieldValue.delete(), ...extra });
    const flag = (id, spotId, email) => db.collection('flags').doc(id).set({
      spot_id: spotId, reporter_email: email, status: 'open', reason: 'spam',
    });
    const spot = async id => (await db.collection('spots').doc(id).get()).data();
    try {
      await db.collection('spots').doc('threshold').set({ status: 'published', is_public: true, flag_count: 0 });
      for (const id of ['a', 'b', 'c']) {
        await flag(`threshold_${id}`, 'threshold', `${id}@example.test`);
        await reconcile('threshold');
      }
      assert.equal((await spot('threshold')).flag_count, 3);
      assert.equal((await spot('threshold')).status, 'published');
      assert.equal((await spot('threshold')).auto_flag_moderation, undefined);

      const one = await reconcile('threshold', { flagId: 'threshold_a', resolution: 'dismissed' });
      assert.equal(one.openCount, 2);
      assert.equal((await spot('threshold')).status, 'published');
      assert.equal((await spot('threshold')).auto_flag_moderation, undefined);
      const replay = await reconcile('threshold', { flagId: 'threshold_a', resolution: 'dismissed' });
      assert.equal(replay.alreadyResolved, true);
      await reconcile('threshold'); // Delayed onWrite replay.
      assert.equal((await spot('threshold')).flag_count, 2);
      await reconcile('threshold', { flagId: 'threshold_b', resolution: 'dismissed' });
      await reconcile('threshold', { flagId: 'threshold_c', resolution: 'dismissed' });
      assert.equal((await spot('threshold')).flag_count, 0);
      assert.equal((await spot('threshold')).status, 'published');

      await db.collection('spots').doc('historically-flagged').set({ status: 'flagged', is_public: true,
        flag_count: 3, auto_flag_moderation: { previous_status: 'published', threshold: 3 } });
      for (const id of ['a', 'b', 'c']) await flag(`historically-flagged_${id}`, 'historically-flagged', `${id}@example.test`);
      await reconcile('historically-flagged');
      assert.equal((await spot('historically-flagged')).status, 'flagged');
      await reconcile('historically-flagged', { flagId: 'historically-flagged_a', resolution: 'dismissed' });
      assert.equal((await spot('historically-flagged')).status, 'published');

      await db.collection('spots').doc('rejected').set({ status: 'rejected', is_public: false, flag_count: 3 });
      await flag('rejected_a', 'rejected', 'a@example.test');
      await reconcile('rejected', { flagId: 'rejected_a', resolution: 'dismissed' });
      assert.equal((await spot('rejected')).status, 'rejected');

      await db.collection('spots').doc('manual').set({ status: 'pending_trust', is_public: true, flag_count: 0 });
      for (const id of ['a', 'b', 'c']) await flag(`manual_${id}`, 'manual', `${id}@example.test`);
      await reconcile('manual');
      await db.collection('spots').doc('manual').update({ status: 'rejected', auto_flag_moderation: FieldValue.delete() });
      await reconcile('manual', { flagId: 'manual_a', resolution: 'dismissed' });
      assert.equal((await spot('manual')).status, 'rejected');
      await reconcile('manual', { flagId: 'manual_b', resolution: 'dismissed' });
      await reconcile('manual', { flagId: 'manual_c', resolution: 'dismissed' });
      assert.equal((await spot('manual')).flag_count, 0);
      assert.equal((await spot('manual')).status, 'rejected');

      await db.collection('spots').doc('manual-flagged').set({ status: 'flagged', is_public: true, flag_count: 1 });
      await flag('manual-flagged_a', 'manual-flagged', 'a@example.test');
      await reconcile('manual-flagged', { flagId: 'manual-flagged_a', resolution: 'dismissed' });
      assert.equal((await spot('manual-flagged')).status, 'flagged');

      await db.collection('spots').doc('duplicate-reporter').set({ status: 'published', is_public: true, flag_count: 0 });
      await flag('duplicate-1', 'duplicate-reporter', 'one@example.test');
      await flag('duplicate-2', 'duplicate-reporter', 'ONE@example.test');
      await reconcile('duplicate-reporter');
      assert.equal((await spot('duplicate-reporter')).flag_count, 1);
      assert.equal((await spot('duplicate-reporter')).status, 'published');

      await db.collection('spots').doc('upheld').set({ status: 'published', is_public: true, flag_count: 0 });
      await flag('upheld_a', 'upheld', 'a@example.test');
      await reconcile('upheld', { flagId: 'upheld_a', resolution: 'upheld' });
      assert.equal((await spot('upheld')).status, 'hidden');
      await reconcile('upheld');
      assert.equal((await spot('upheld')).status, 'hidden');

      const blockRef = db.collection('submission_blocks').doc('blocked-account');
      assert.equal(await isSubmissionBlocked(db, 'blocked-account'), false);
      await blockRef.set({ expires_at: new Date(Date.now() + 3600000) });
      assert.equal(await isSubmissionBlocked(db, 'blocked-account'), true);
      await blockRef.set({ expires_at: new Date(Date.now() - 1000) });
      assert.equal(await isSubmissionBlocked(db, 'blocked-account'), false);
      await blockRef.delete();
      assert.equal(await isSubmissionBlocked(db, 'blocked-account'), false);
    } finally { await deleteApp(app); }
  });
