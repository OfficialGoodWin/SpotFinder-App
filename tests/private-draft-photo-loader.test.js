import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPrivateDraftPhotoLoader, draftPhotoLoadMessage } from '../src/lib/privateDraftPhotoLoader.js';

const owner = { uid: 'owner', isAnonymous: false, getIdToken: async () => 'fresh' };
const first = { path: 'drafts/owner/draft-one/one.jpg' };
const second = { path: 'drafts/owner/draft-one/two.jpg' };

test('concurrent thumbnail and editor loads share one request per photo', async () => {
  const requests = [];
  const load = createPrivateDraftPhotoLoader(path => new Promise(resolve => requests.push({ path, resolve })));
  const oneThumbnail = load(owner, first);
  const oneEditor = load(owner, first);
  const twoEditor = load(owner, second);
  assert.equal(requests.length, 2);
  requests.forEach(({ path, resolve }) => resolve(new Blob([path])));
  assert.equal(await oneThumbnail, await oneEditor);
  assert.notEqual(await oneEditor, await twoEditor);
  const later = load(owner, first);
  assert.equal(requests.length, 3);
  requests[2].resolve(new Blob(['later']));
  assert.equal((await later).size, 5);
});

test('owner check rejects other accounts and anonymous sessions before download', async () => {
  let requests = 0;
  const load = createPrivateDraftPhotoLoader(() => { requests += 1; return Promise.resolve(new Blob()); });
  await assert.rejects(load({ ...owner, uid: 'other' }, first), /signed-in account/);
  await assert.rejects(load({ ...owner, isAnonymous: true }, first), /signed-in account/);
  assert.equal(requests, 0);
});

test('403 and 404 stop after one request and have distinct visible messages', async () => {
  for (const [code, text] of [['storage/unauthorized', /permission/], ['storage/object-not-found', /missing/]]) {
    let requests = 0;
    const load = createPrivateDraftPhotoLoader(() => { requests += 1; return Promise.reject({ code }); });
    await assert.rejects(load(owner, first), error => {
      assert.match(draftPhotoLoadMessage(error), text);
      return true;
    });
    assert.equal(requests, 1);
  }
});

test('unauthenticated download refreshes token once, then stops', async () => {
  let requests = 0;
  let refreshes = 0;
  const load = createPrivateDraftPhotoLoader(() => {
    requests += 1;
    return Promise.reject({ code: 'storage/unauthenticated' });
  });
  await assert.rejects(load({ ...owner, getIdToken: async () => { refreshes += 1; } }, first));
  assert.equal(requests, 2);
  assert.equal(refreshes, 1);
});

test('bucket CORS adds production reads while retaining existing origins and upload methods', () => {
  const rules = JSON.parse(readFileSync(new URL('../storage.cors.json', import.meta.url), 'utf8'));
  const reads = rules.find(rule => rule.method.join(',') === 'GET,HEAD');
  assert.deepEqual(reads.origin, [
    'https://www.spotfinder.live', 'https://spotfinder.live', 'https://spot-finder-app.vercel.app',
  ]);
  assert(rules.some(rule => rule.origin.includes('http://localhost:5173') && rule.method.includes('PUT')));
});
