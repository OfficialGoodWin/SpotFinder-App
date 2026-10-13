import test from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

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
      await setDoc(doc(db, 'spot_ratings', 'spot-one_owner'), {
        spot_id: 'spot-one', user_id: 'owner', overall: 4, access: 4, condition: 4, safety: 4, crowdedness: 4, schema: 2,
      });
    });

    await assertSucceeds(getDoc(doc(owner, 'users', 'owner')));
    await assertFails(getDoc(doc(other, 'users', 'owner')));
    await assertFails(getDoc(doc(anonymous, 'users', 'owner')));
    await assertSucceeds(updateDoc(doc(owner, 'spots', 'spot-one'), { title: 'Owner edit' }));
    await assertFails(updateDoc(doc(other, 'spots', 'spot-one'), { title: 'Other edit' }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { email: 'leak@example.test' }));
    await assertFails(deleteDoc(doc(other, 'spots', 'spot-one')));
    await assertSucceeds(getDoc(doc(owner, 'spot_ratings', 'spot-one_owner')));
    await assertFails(getDoc(doc(other, 'spot_ratings', 'spot-one_owner')));
    await assertFails(setDoc(doc(unverified, 'spot_likes', 'spot-one_unverified'), { spot_id: 'spot-one', user_id: 'unverified' }));
    await assertSucceeds(setDoc(doc(owner, 'spot_likes', 'spot-one_owner'), { spot_id: 'spot-one', user_id: 'owner' }));
    await assertFails(getDoc(doc(owner, 'account_deletion_requests', 'owner')));
  } finally {
    await testEnv.cleanup();
  }
});
