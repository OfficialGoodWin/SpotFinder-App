import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsBackRoute } from '../src/new/settingsRoutes.js';
import { canSubmitSupport } from '../src/new/supportValidation.js';
import { APP_VERSION } from '../src/config/appVersion.js';
import { RELEASES } from '../src/data/releases.js';

test('settings fallback hierarchy resolves direct and nested routes', () => {
  assert.equal(settingsBackRoute('/new/settings'), '/new/profile');
  assert.equal(settingsBackRoute('/new/settings/account'), '/new/settings');
  assert.equal(settingsBackRoute('/new/settings/account/mfa'), '/new/settings/account');
  assert.equal(settingsBackRoute('/new/settings/support/feedback', { settingsParent: '/new/settings' }), '/new/settings');
  assert.equal(settingsBackRoute('/new/settings/about/app', { settingsParent: '/new/profile' }), '/new/profile');
  assert.equal(settingsBackRoute('/new/settings/legal/cookies', { legalReturnTo: '/new/settings/legal/privacy' }), '/new/settings/legal/privacy');
});

test('support and feedback require only their existing required fields', () => {
  const input = { page: 'feedback', category: '', area: '', message: '  ', email: '', status: 'idle' };
  assert.equal(canSubmitSupport(input), false);
  assert.equal(canSubmitSupport({ ...input, category: 'idea', message: 'Useful feedback' }), true);
  assert.equal(canSubmitSupport({ ...input, page: 'report', category: 'bug', message: 'Broken map' }), false);
  assert.equal(canSubmitSupport({ ...input, page: 'report', category: 'bug', area: 'Map', message: 'Broken map' }), true);
  assert.equal(canSubmitSupport({ ...input, page: 'contact', message: 'Help', email: '' }), false);
  assert.equal(canSubmitSupport({ ...input, page: 'contact', message: 'Help', email: 'visitor@example.com' }), true);
  assert.equal(canSubmitSupport({ ...input, category: 'idea', message: 'Feedback', status: 'sending' }), false);
});

test('version history uses the real current version', () => {
  assert.equal(RELEASES[0].version, APP_VERSION);
  assert.match(RELEASES[0].date, /^\d{4}-\d{2}-\d{2}$/);
});
