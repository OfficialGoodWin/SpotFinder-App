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
  const admin = testEnv.authenticatedContext('admin', { email: 'admin@example.test', admin: true }).firestore();
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
      await setDoc(doc(db, 'spots', 'legacy-owned'), { title: 'Legacy', description: '', created_by: 'owner@example.test', status: 'published', is_public: false });
      await setDoc(doc(db, 'spot_ratings', 'spot-one_owner'), {
        spot_id: 'spot-one', user_id: 'owner', overall: 4, access: 4, condition: 4, safety: 4, crowdedness: 4, schema: 2,
      });
      await setDoc(doc(db, 'spot_drafts', 'draft-one'), {
        owner_uid: 'owner', title: 'Private draft', description: 'Only the owner can access this.',
        lat: 50.1, lng: 14.2, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
      });
      await setDoc(doc(db, 'poi_ratings', 'legacy-review'), {
        poi_id: '50.0000_14.0000_test', rating: 4, review: 'Existing review',
        created_by: 'registered-account', created_by_uid: 'owner', created_date: '2025-01-01',
      });
      await setDoc(doc(db, 'poi_photos', 'approved-photo'), {
        poi_id: '50.0000_14.0000_test', image: 'https://example.test/legacy.jpg',
        created_by_uid: 'owner', created_date: '2025-01-01',
      });
    });

    await assertSucceeds(getDoc(doc(owner, 'users', 'owner')));
    await assertSucceeds(getDoc(doc(anonymous, 'poi_photos', 'approved-photo')));
    await assertFails(setDoc(doc(owner, 'poi_photos', 'forged-photo'), {
      poi_id: '50.0000_14.0000_test', image: 'https://example.test/attacker.jpg',
      created_by_uid: 'owner', created_date: '2026-01-01',
    }));
    await assertFails(setDoc(doc(admin, 'poi_photos', 'forged-admin-photo'), {
      poi_id: '50.0000_14.0000_test', image: 'https://example.test/attacker.jpg',
      created_by_uid: 'admin', created_date: '2026-01-01',
    }));
    await assertSucceeds(getDoc(doc(anonymous, 'spots', 'public-place')));
    await assertFails(getDoc(doc(anonymous, 'spots', 'hidden-place')));
    await assertFails(getDoc(doc(anonymous, 'spots', 'private-place')));
    await assertFails(getDoc(doc(other, 'users', 'owner')));
    await assertFails(getDoc(doc(anonymous, 'users', 'owner')));
    await assertSucceeds(updateDoc(doc(owner, 'spots', 'spot-one'), { title: 'Owner edit' }));
    await assertSucceeds(updateDoc(doc(owner, 'spots', 'spot-one'), {
      description: 'Updated details', tags: ['Viewpoint', 'Quiet'], cost: 'free',
      access_difficulty: 'easy', parking: 'street', best_time: ['morning'], directions: 'Walk from the station.',
    }));
    const editedSpot = (await getDoc(doc(owner, 'spots', 'spot-one'))).data();
    if (editedSpot.rating !== 4 || editedSpot.status !== 'published') throw new Error('Owner edit changed protected data');
    await assertSucceeds(updateDoc(doc(owner, 'spots', 'legacy-owned'), { title: 'Legacy owner edit' }));
    await assertFails(updateDoc(doc(other, 'spots', 'spot-one'), { title: 'Other edit' }));
    await assertFails(updateDoc(doc(other, 'spots', 'legacy-owned'), { title: 'Other legacy edit' }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { email: 'leak@example.test' }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { unexpected_field: true }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { created_by_uid: 'other' }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { created_by: 'other@example.test' }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { status: 'hidden' }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { flag_count: 9, rating_count: 99 }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { needs_review: false, created_date: '2027-01-01' }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { image_url: 'https://example.invalid/image.jpg' }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { image_urls: ['https://example.invalid/image.jpg'], photo_metadata: [] }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { photo_metadata: [{ source: 'approved' }] }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { title: 10 }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { tags: ['good', 9] }));
    await assertFails(updateDoc(doc(owner, 'spots', 'spot-one'), { parking: 'unrecognized' }));
    await assertFails(updateDoc(doc(owner, 'spots', 'private-place'), { is_public: true }));
    await assertFails(updateDoc(doc(owner, 'spots', 'private-place'), { lat: 51, lng: 15, geohash: 'new' }));
    await assertFails(updateDoc(doc(owner, 'spots', 'private-place'), { geohash: 'new' }));
    await assertFails(updateDoc(doc(admin, 'spots', 'spot-one'), { status: 'hidden' }));
    await testEnv.withSecurityRulesDisabled(async context => {
      const serverDb = context.firestore();
      await setDoc(doc(serverDb, 'spots', 'trusted-create'), {
        title: 'Trusted spot', description: 'Created by trusted callable', created_by_uid: 'owner',
        status: 'published', is_public: true, lat: 50, lng: 14,
      });
      await updateDoc(doc(serverDb, 'spots', 'private-place'), { is_public: true });
      await updateDoc(doc(serverDb, 'spots', 'spot-one'), { status: 'hidden' });
      await updateDoc(doc(serverDb, 'spots', 'spot-one'), { status: 'published' });
    });
    await assertSucceeds(getDoc(doc(anonymous, 'spots', 'trusted-create')));
    await assertSucceeds(getDoc(doc(anonymous, 'spots', 'private-place')));
    await assertFails(deleteDoc(doc(other, 'spots', 'spot-one')));
    await assertSucceeds(getDoc(doc(owner, 'spot_ratings', 'spot-one_owner')));
    await assertFails(getDoc(doc(other, 'spot_ratings', 'spot-one_owner')));
    const ownRating = { spot_id: 'spot-one', user_id: 'owner', overall: 4, access: 0, condition: 0, safety: 0, crowdedness: 1, schema: 2 };
    await assertFails(setDoc(doc(owner, 'spot_ratings', 'spot-one_owner'), ownRating));
    await assertSucceeds(setDoc(doc(other, 'spot_ratings', 'spot-one_other'), { ...ownRating, user_id: 'other' }));
    await assertFails(setDoc(doc(unverified, 'spot_ratings', 'spot-one_unverified'), { ...ownRating, user_id: 'unverified' }));
    await assertFails(setDoc(doc(unverified, 'spot_saves', 'spot-one_unverified'), { spot_id: 'spot-one', user_id: 'unverified', created_date: '2026-01-01' }));
    await assertFails(setDoc(doc(unverified, 'bookmarks', 'unverified@example.test_spot-one'), { user_email: 'unverified@example.test', spot_id: 'spot-one', created_date: '2026-01-01' }));
    await assertSucceeds(setDoc(doc(owner, 'bookmarks', 'owner@example.test_spot-one'), { user_email: 'owner@example.test', spot_id: 'spot-one', created_date: '2026-01-01' }));
    await assertFails(setDoc(doc(unverified, 'spots', 'forged-public-spot'), { title: 'Forged', description: 'Forged', created_by_uid: 'unverified', status: 'published', is_public: true }));
    await assertFails(setDoc(doc(unverified, 'social_posts', 'forged-social'), { status: 'active', added_by: 'unverified' }));
    const candidateRating = { poi_id: '50.0000_14.0000_test', rating: 5, review: 'New review',
      created_by: 'registered-account', created_by_uid: 'owner', created_date: '2026-01-01' };
    await assertFails(setDoc(doc(owner, 'poi_ratings', 'arbitrary-rating'), candidateRating));
    await assertFails(setDoc(doc(owner, 'poi_ratings', 'impersonated-rating'), { ...candidateRating, created_by_uid: 'other' }));
    await assertFails(updateDoc(doc(owner, 'poi_ratings', 'legacy-review'), { rating: 1 }));
    await assertFails(updateDoc(doc(other, 'poi_ratings', 'legacy-review'), { created_by_uid: 'other', poi_id: 'other-poi' }));
    await assertSucceeds(getDoc(doc(anonymous, 'poi_ratings', 'legacy-review')));
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
    const report = { spot_id: 'trusted-create', reporter_email: 'other@example.test',
      reason: 'spam', note: 'Dummy report', status: 'open', created_date: '2026-01-01' };
    await assertFails(setDoc(doc(unverified, 'flags', 'trusted-create_unverified@example.test'),
      { ...report, reporter_email: 'unverified@example.test' }));
    await assertFails(setDoc(doc(other, 'flags', 'hidden-place_other@example.test'),
      { ...report, spot_id: 'hidden-place' }));
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'submission_blocks', 'other'),
        { expires_at: new Date(Date.now() + 3600000) });
    });
    await assertFails(setDoc(doc(other, 'flags', 'trusted-create_other@example.test'), report));
    await assertFails(setDoc(doc(other, 'spot_ratings', 'spot-one_other'),
      { ...ownRating, user_id: 'other' }));
    await testEnv.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'submission_blocks', 'other'),
        { expires_at: new Date(Date.now() - 3600000) });
    });
    await assertSucceeds(setDoc(doc(other, 'flags', 'trusted-create_other@example.test'), report));
    await testEnv.withSecurityRulesDisabled(async context => {
      await deleteDoc(doc(context.firestore(), 'submission_blocks', 'other'));
    });
    await assertFails(setDoc(doc(other, 'flags', 'trusted-create_other@example.test'), report));
    await assertFails(updateDoc(doc(other, 'flags', 'trusted-create_other@example.test'), { status: 'resolved' }));
  } finally {
    await testEnv.cleanup();
  }
});
