import test from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';

const emulatorAvailable = Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST);

test('private draft photos are accessible only to their authenticated owner', { skip: !emulatorAvailable }, async () => {
  const projectId = 'spotfinder-draft-photo-rules-test';
  const testEnv = await initializeTestEnvironment({
    projectId,
    storage: { rules: readFileSync(new URL('../storage.rules', import.meta.url), 'utf8') },
  });
  const ownerStorage = testEnv.authenticatedContext('owner').storage(`${projectId}.firebasestorage.app`);
  const otherStorage = testEnv.authenticatedContext('other').storage(`${projectId}.firebasestorage.app`);
  const guestStorage = testEnv.unauthenticatedContext().storage(`${projectId}.firebasestorage.app`);
  const path = 'drafts/owner/draft-one/photo.jpg';
  try {
    await assertSucceeds(uploadBytes(ref(ownerStorage, path), new Blob(['jpeg'], { type: 'image/jpeg' })));
    await assertSucceeds(getBytes(ref(ownerStorage, path)));
    await assertFails(getBytes(ref(otherStorage, path)));
    await assertFails(getBytes(ref(guestStorage, path)));
    await assertFails(deleteObject(ref(otherStorage, path)));
    await assertSucceeds(deleteObject(ref(ownerStorage, path)));
    await assertFails(uploadBytes(ref(ownerStorage, 'drafts/other/draft-one/photo.jpg'), new Blob(['jpeg'], { type: 'image/jpeg' })));
    await assertFails(uploadBytes(ref(ownerStorage, 'drafts/owner/draft-one/photo.gif'), new Blob(['gif'], { type: 'image/gif' })));
  } finally {
    await testEnv.cleanup();
  }
});
