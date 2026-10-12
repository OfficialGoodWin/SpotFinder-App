import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexedDB } from 'fake-indexeddb';
import {
  deleteGuestDraft,
  getGuestDraftOwnerKey,
  listGuestDrafts,
  normalizeSpotDraft,
  saveGuestDraft,
} from '../src/lib/spotDrafts.js';
import { deleteGuestDraftPhotos, loadGuestDraftPhoto, persistGuestDraftPhotos } from '../src/lib/guestDraftPhotos.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const completeDraft = {
  id: 'draft-one', title: 'River bend', description: 'Quiet access beside the old bridge.',
  lat: 50.1, lng: 14.2, tags: ['Sunset', 'PhotoSpot'], cost: 'free',
  accessDifficulty: 'moderate', parking: 'street', bestTime: ['sunset'],
  directions: 'Use the marked path.', socialUrl: 'https://www.instagram.com/p/example/',
  overallRating: 4, accessRating: 3, conditionRating: 4, safetyRating: 5, crowdednessRating: 2,
  photo_refs: [{ path: 'drafts/user/draft-one/photo.jpg', name: 'photo.jpg', type: 'image/jpeg', size: 123 }],
};

test('guest save survives a fresh read and preserves fields plus IndexedDB references', () => {
  const storage = new MemoryStorage();
  const owner = getGuestDraftOwnerKey(storage);
  const localRef = { local_id: `${owner}:draft-one:0`, name: 'photo.jpg', type: 'image/jpeg', size: 123 };
  saveGuestDraft(storage, owner, { ...completeDraft, photo_refs: [localRef] });
  const [restored] = listGuestDrafts(storage, owner);
  for (const field of ['title', 'description', 'lat', 'lng', 'cost', 'accessDifficulty', 'parking', 'directions', 'socialUrl', 'overallRating', 'accessRating', 'conditionRating', 'safetyRating', 'crowdednessRating']) {
    assert.deepEqual(restored[field], normalizeSpotDraft(completeDraft)[field]);
  }
  assert.deepEqual(restored.tags, completeDraft.tags);
  assert.deepEqual(restored.bestTime, completeDraft.bestTime);
  assert.deepEqual(restored.photo_refs, [localRef]);
});

test('guest draft photo bytes survive an IndexedDB round trip and are deleted with the draft', async () => {
  const owner = 'guest-photo-owner';
  const blob = new Blob(['jpeg-bytes'], { type: 'image/jpeg' });
  Object.defineProperty(blob, 'name', { value: 'river.jpg' });
  const [ref] = await persistGuestDraftPhotos(owner, 'draft-photo-test', [blob], indexedDB);
  const restored = await loadGuestDraftPhoto(ref, owner, indexedDB);
  assert.equal(restored.size, blob.size);
  assert.equal(restored.type, 'image/jpeg');
  await assert.rejects(() => loadGuestDraftPhoto(ref, 'different-owner', indexedDB), /another browser profile/);
  await deleteGuestDraftPhotos(owner, 'draft-photo-test', indexedDB);
  await assert.rejects(() => loadGuestDraftPhoto(ref, owner, indexedDB), /missing/);
});

test('guest draft photo persistence keeps the existing three-photo limit', async () => {
  const owner = 'guest-three-photo-owner';
  const files = ['one', 'two', 'three'].map((value, index) => {
    const blob = new Blob([value], { type: 'image/jpeg' });
    Object.defineProperty(blob, 'name', { value: `${index}.jpg` });
    return blob;
  });
  const refs = await persistGuestDraftPhotos(owner, 'three-photo-draft', files, indexedDB);
  assert.equal(refs.length, 3);
  const restored = await Promise.all(refs.map(ref => loadGuestDraftPhoto(ref, owner, indexedDB)));
  assert.deepEqual(restored.map(file => file.size), files.map(file => file.size));
  await deleteGuestDraftPhotos(owner, 'three-photo-draft', indexedDB);
});

test('saving an edited draft updates the same record instead of duplicating it', () => {
  const storage = new MemoryStorage();
  const owner = getGuestDraftOwnerKey(storage);
  saveGuestDraft(storage, owner, completeDraft);
  saveGuestDraft(storage, owner, { ...completeDraft, title: 'Updated river bend', parking: 'paid' });
  const drafts = listGuestDrafts(storage, owner);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].title, 'Updated river bend');
  assert.equal(drafts[0].parking, 'paid');
});

test('guest drafts are isolated by owner and can be deleted without touching another owner', () => {
  const storage = new MemoryStorage();
  saveGuestDraft(storage, 'guest-a', completeDraft);
  saveGuestDraft(storage, 'guest-b', { ...completeDraft, id: 'draft-two' });
  deleteGuestDraft(storage, 'guest-a', completeDraft.id);
  assert.equal(listGuestDrafts(storage, 'guest-a').length, 0);
  assert.equal(listGuestDrafts(storage, 'guest-b').length, 1);
});

test('storage failure is surfaced and does not report a saved draft', () => {
  const storage = new MemoryStorage();
  storage.setItem = () => { const error = new Error('full'); error.name = 'QuotaExceededError'; throw error; };
  assert.throws(() => saveGuestDraft(storage, 'guest-a', completeDraft), /no space available/);
});

test('cloud draft rules bind reads and writes to auth uid and exclude anonymous accounts', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /match \/spot_drafts\/\{draftId\}/);
  assert.match(rules, /validDraftCoordinates\(request\.resource\.data\)/);
  assert.match(rules, /resource\.data\.owner_uid == request\.auth\.uid/);
  assert.match(rules, /request\.resource\.data\.owner_uid == request\.auth\.uid/);
  assert.match(rules, /sign_in_provider != 'anonymous'/);
  assert.match(rules, /match \/spot_publications\/\{publicationId\}[\s\S]*allow read, write: if false/);
});

test('cloud draft save does not pre-read a document that may not exist', () => {
  const source = readFileSync(new URL('../src/api/firebaseClient.js', import.meta.url), 'utf8');
  const saveDraft = source.slice(source.indexOf('export const saveCloudSpotDraft'), source.indexOf('export const getCloudSpotDrafts'));
  assert.doesNotMatch(saveDraft, /getDoc\(/);
  assert.match(saveDraft, /await setDoc\(/);
});

test('draft photo storage is private and publication is transactionally idempotent', () => {
  const storageRules = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');
  const functionsSource = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
  assert.match(storageRules, /match \/drafts\/\{userId\}\/\{draftId\}\/\{fileName\}/);
  assert.match(storageRules, /request\.auth\.uid == userId/);
  assert.match(storageRules, /sign_in_provider != 'anonymous'/);
  assert.match(functionsSource, /promoteDraftPhotos/);
  assert.match(functionsSource, /sourcePath\.startsWith\(requiredPrefix\)/);
  assert.match(functionsSource, /await source\.copy\(destination\)/);
  assert.match(functionsSource, /firebaseStorageDownloadTokens/);
  assert.match(functionsSource, /collection\('spot_publications'\)/);
  assert.match(functionsSource, /db\.runTransaction/);
  assert.match(functionsSource, /already_published: true/);
  assert.match(functionsSource, /published_spot_id/);
});

test('account deletion cleanup includes private drafts, markers, and draft images', () => {
  const functionsSource = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
  assert.match(functionsSource, /cleanupSpotDraftsOnAccountDelete/);
  assert.match(functionsSource, /deleteOwned\('spot_drafts'\)/);
  assert.match(functionsSource, /deleteOwned\('spot_publications'\)/);
  assert.match(functionsSource, /prefix: `drafts\/\$\{account\.uid\}\//);
});
