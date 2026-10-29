import test from 'node:test';
import assert from 'node:assert/strict';
import { signOutOnce } from '../src/lib/signOutGate.js';

test('rejected Firebase sign-out stays rejected and permits a later retry', async () => {
  const auth = { currentUser: { uid: 'dummy-owner' } };
  let attempts = 0;
  await assert.rejects(signOutOnce(auth, async () => {
    attempts += 1;
    throw new Error('dummy sign-out failure');
  }), /dummy sign-out failure/);
  assert.equal(auth.currentUser.uid, 'dummy-owner');
  await signOutOnce(auth, async () => { attempts += 1; auth.currentUser = null; });
  assert.equal(attempts, 2);
  assert.equal(auth.currentUser, null);
});

test('simultaneous callers share one Firebase sign-out operation', async () => {
  const auth = { currentUser: { uid: 'dummy-owner' } };
  let calls = 0;
  let resolve;
  const signer = () => { calls += 1; return new Promise(done => { resolve = done; }); };
  const first = signOutOnce(auth, signer);
  const second = signOutOnce(auth, signer);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolve();
  await Promise.all([first, second]);
});
