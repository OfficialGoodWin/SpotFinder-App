import test from 'node:test';
import assert from 'node:assert/strict';
import access from '../functions/adminAccessPolicy.js';
import publication from '../functions/adminPublishSpotPolicy.js';

const token = { admin: true, email: 'redm3467@gmail.com', email_verified: true,
  auth_time: 1000, firebase: { sign_in_provider: 'google.com', sign_in_second_factor: 'totp' } };
const spot = { status: 'pending_trust', is_public: true, lat: 50, lng: 14,
  needs_review: true, flag_count: 0, discovery_state: 'visible' };

test('admin access expires after 30 minutes and requires signed Google TOTP claims', () => {
  assert.equal(access.adminSessionSeconds(token, 1000), 1800);
  assert.equal(access.adminSessionSeconds(token, 2799), 1);
  assert.equal(access.adminSessionSeconds(token, 2800), 0);
  for (const change of [{ admin: false }, { email: 'other@example.com' },
    { email_verified: false }, { firebase: { ...token.firebase, sign_in_second_factor: 'phone' } },
    { firebase: { ...token.firebase, sign_in_provider: 'password' } }]) {
    assert.equal(access.adminSessionSeconds({ ...token, ...change }, 1000), 0);
  }
});

test('pending trust may be approved after review, unsafe and revoked spots cannot', () => {
  assert.deepEqual(publication.publicationBlockers(spot), []);
  for (const change of [{ is_public: false }, { flag_count: 1 },
    { discovery_state: 'hidden' }, { sensitive_location: true }, { lat: NaN }]) {
    assert.notEqual(publication.publicationBlockers({ ...spot, ...change }).length, 0);
  }
  assert.ok(publication.publicationBlockers(spot, true).some(reason => reason.includes('revocation')));
});
