import test from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

test('Firestore rules enforce private profiles, ownership, and verified interactions', { skip: !emulatorAvailable }, async () => {
  const projectId = 'spotfinder-firestore-rules-test';
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
  const owner = testEnv.authenticatedContext('owner', { email: 'owner@example.test', email_verified: true }).firestore();
  const other = testEnv.authenticatedContext('other', { email: 'other@example.test', email_verified: true }).firestore();
  const unverified = testEnv.authenticatedContext('unverified', { email: 'unverified@example.test', email_verified: false }).firestore();
  const anonymous = testEnv.unauthenticatedContext().firestore();

  try {
    await testEnv.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', 'owner'), { date_of_birth: '2000-02-29', email: 'owner@example.test' });
      await setDoc(doc(db, 'spots', 'spot-one'), {
        title: 'Safe title', description: 'Safe description', created_by_uid: 'owner', created_by: 'registered-account',
        rating: 4, rating_count: 1, status: 'published',
      });
      await setDoc(doc(db, 'spots', 'public-place'), { created_by_uid: 'owner', is_public: true, status: 'published', lat: 50, lng: 14 });
      await setDoc(doc(db, 'spots', 'hidden-place'), { created_by_uid: 'owner', is_public: true, status: 'hidden', lat: 50, lng: 14 });
      await setDoc(doc(db, 'spots', 'private-place'), { created_by_uid: 'owner', is_public: false, status: 'published', lat: 50, lng: 14 });
      await setDoc(doc(db, 'spot_ratings', 'spot-one_owner'), {
        spot_id: 'spot-one', user_id: 'owner', overall: 4, access: 4, condition: 4, safety: 4, crowdedness: 4, schema: 2,
      });
      await setDoc(doc(db, 'spot_drafts', 'draft-one'), {
        owner_uid: 'owner', title: 'Private draft', description: 'Only the owner can access this.',
        lat: 50.1, lng: 14.2, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
      });
    });

    await assertSucceeds(getDoc(doc(owner, 'users', 'owner')));
    await assertSucceeds(getDoc(doc(anonymous, 'spots', 'public-place')));
    await assertFails(getDoc(doc(anonymous, 'spots', 'hidden-place')));
    await assertFails(getDoc(doc(anonymous, 'spots', 'private-place')));
    await assertFails(getDoc(doc(other, 'users', 'owner')));
    await assertFails(getDoc(doc(anonymous, 'users', 'owner')));
    await assertSucceeds(updateDoc(doc(owner, 'spots', 'spot-one'), { title: 'Owner edit' }));
    await assertFails(updateDoc(doc(other, 'spots', 'spot-one'), { title: 'Other edit' }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { email: 'leak@example.test' }));
    await assertFails(deleteDoc(doc(other, 'spots', 'spot-one')));
    await assertSucceeds(getDoc(doc(owner, 'spot_ratings', 'spot-one_owner')));
    await assertFails(getDoc(doc(other, 'spot_ratings', 'spot-one_owner')));
    await assertSucceeds(getDoc(doc(owner, 'spot_drafts', 'draft-one')));
    await assertFails(getDoc(doc(other, 'spot_drafts', 'draft-one')));
    await assertSucceeds(getDocs(query(collection(owner, 'spot_drafts'), where('owner_uid', '==', 'owner'))));
    await assertFails(getDocs(collection(other, 'spot_drafts')));
    await assertFails(updateDoc(doc(owner, 'spot_drafts', 'draft-one'), { owner_uid: 'other' }));
    await assertFails(deleteDoc(doc(other, 'spot_drafts', 'draft-one')));
    await assertSucceeds(deleteDoc(doc(owner, 'spot_drafts', 'draft-one')));
    await assertFails(setDoc(doc(unverified, 'spot_likes', 'spot-one_unverified'), { spot_id: 'spot-one', user_id: 'unverified' }));
    await assertSucceeds(setDoc(doc(owner, 'spot_likes', 'spot-one_owner'), { spot_id: 'spot-one', user_id: 'owner' }));
    await assertFails(getDoc(doc(owner, 'account_deletion_requests', 'owner')));
  } finally {
    await testEnv.cleanup();
  }
});
