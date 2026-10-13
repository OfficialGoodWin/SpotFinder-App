import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { APP_VERSION } from '../src/config/appVersion.js';
import { CURRENT_RELEASE, RELEASES } from '../src/data/releases.js';

test('displayed release version matches package metadata', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(APP_VERSION, '0.5.6');
  assert.equal(pkg.version, APP_VERSION);
  assert.equal(CURRENT_RELEASE.version, APP_VERSION);
});

test('release records contain maintainable validated categories', () => {
  assert.equal(RELEASES.length, 1);
  for (const release of RELEASES) {
    assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(Object.keys(release.changes), ['added', 'improved', 'fixed', 'security']);
    assert.ok(Object.values(release.changes).flat().every(entry => typeof entry === 'string' && entry.length > 10));
  }
});
