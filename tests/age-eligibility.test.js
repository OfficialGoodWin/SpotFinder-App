import test from 'node:test';
import assert from 'node:assert/strict';
import { accountBirthDateBounds, isEligibleBirthDate } from '../src/lib/ageEligibility.js';

const now = new Date(2026, 9, 13, 23, 30);

test('uses local calendar boundaries without timezone drift', () => {
  assert.deepEqual(accountBirthDateBounds(now), { min: '1906-10-13', max: '2010-10-13' });
  assert.equal(isEligibleBirthDate('2010-10-13', now), true);
  assert.equal(isEligibleBirthDate('2010-10-14', now), false);
});

test('validates leap days and rejects normalized or implausible dates', () => {
  assert.equal(isEligibleBirthDate('2008-02-29', now), true);
  assert.equal(isEligibleBirthDate('2009-02-29', now), false);
  assert.equal(isEligibleBirthDate('1906-10-12', now), false);
  assert.equal(isEligibleBirthDate('13/10/2010', now), false);
});
