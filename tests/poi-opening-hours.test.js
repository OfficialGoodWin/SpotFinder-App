import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePoiOpeningHours } from '../src/new/poiOpeningHours.js';

const prague = { lat: 50.087, lon: 14.421, language: 'cs' };

test('missing and unsupported hours stay unknown, never closed', () => {
  assert.equal(evaluatePoiOpeningHours(null, prague).kind, 'missing');
  assert.equal(evaluatePoiOpeningHours('not a schedule', prague).kind, 'unknown');
  assert.equal(evaluatePoiOpeningHours('Mo-Fr 09:00-17:00; SH off', prague).kind, 'unknown');
});

test('multiple daily intervals and next transition use the place time zone', () => {
  const result = evaluatePoiOpeningHours('Mo-Fr 09:00-12:00,13:00-17:00', {
    ...prague, now: new Date('2026-10-26T09:30:00Z'),
  });
  assert.equal(result.kind, 'open');
  assert.equal(result.timeZone, 'Europe/Prague');
  assert.equal(result.nextChange?.toISOString(), '2026-10-26T11:00:00.000Z');
  assert.deepEqual(result.rows[0].periods.map(period => period.label), ['09:00–12:00', '13:00–17:00']);
});

test('Czech public holiday exception is reflected in the displayed week', () => {
  const result = evaluatePoiOpeningHours('Mo-Fr 09:00-17:00; PH off', {
    ...prague, now: new Date('2026-10-27T10:00:00Z'),
  });
  assert.equal(result.kind, 'open');
  assert.equal(result.rows[2].holiday, true);
  assert.equal(result.rows[2].periods.length, 0);
});

test('overnight and DST intervals retain actual transition instants', () => {
  const overnight = evaluatePoiOpeningHours('Sa 22:00-02:00', {
    ...prague, now: new Date('2026-10-24T22:30:00Z'),
  });
  assert.equal(overnight.kind, 'open');
  // At the autumn clock change, 02:00 occurs twice; the first 02:00 closes this interval.
  assert.equal(overnight.nextChange?.toISOString(), '2026-10-25T00:00:00.000Z');

  const spring = evaluatePoiOpeningHours('Su 01:00-04:00', {
    ...prague, now: new Date('2026-03-29T00:30:00Z'),
  });
  assert.equal(spring.kind, 'open');
  assert.equal(spring.nextChange?.toISOString(), '2026-03-29T02:00:00.000Z');
});

test('confirmed continuous hours are distinct from a normal open interval', () => {
  assert.equal(evaluatePoiOpeningHours('24/7', { ...prague, now: new Date('2026-10-27T10:00:00Z') }).kind, 'always');
});
