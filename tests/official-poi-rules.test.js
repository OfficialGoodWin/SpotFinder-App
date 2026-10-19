import test from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

test('official POI authoring records are private and server-write-only', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const env = await initializeTestEnvironment({ projectId: 'spotfinder-official-poi-rules',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
  const guest = env.unauthenticatedContext().firestore();
  const ordinary = env.authenticatedContext('ordinary', { email_verified: true, admin: false }).firestore();
  const forged = env.authenticatedContext('forged', { email_verified: true, owner_uid: 'admin', isAdmin: true }).firestore();
  const admin = env.authenticatedContext('admin', { admin: true, email_verified: false }).firestore();
  const collections = ['official_poi_changes', 'official_poi_revisions', 'official_poi_audit', 'official_poi_publications'];
  try {
    await env.withSecurityRulesDisabled(async context => {
      for (const name of collections) await setDoc(doc(context.firestore(), name, 'record'), { privateNote: 'admin only', revision: 1 });
    });
    for (const name of collections) {
      for (const client of [guest, ordinary, forged]) {
        await assertFails(getDoc(doc(client, name, 'record')));
        await assertFails(setDoc(doc(client, name, 'new'), { admin: true, emailVerified: true, ownerUid: 'admin' }));
        await assertFails(updateDoc(doc(client, name, 'record'), { revision: 2 }));
        await assertFails(deleteDoc(doc(client, name, 'record')));
      }
      await assertSucceeds(getDoc(doc(admin, name, 'record')));
      await assertFails(setDoc(doc(admin, name, 'new'), { revision: 1 }));
      await assertFails(updateDoc(doc(admin, name, 'record'), { revision: 2 }));
      await assertFails(deleteDoc(doc(admin, name, 'record')));
    }
  } finally { await env.cleanup(); }
});
