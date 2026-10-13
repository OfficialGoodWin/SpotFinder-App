import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootConsent,
  getConsent,
  getEffectiveConsent,
  setConsent,
} from '../src/lib/consent.js';

function installBrowserFixture(savedValue) {
  const values = new Map();
  if (savedValue !== undefined) values.set('spotfinder_cookie_consent_v1', savedValue);
  const elements = [
    { removed: false, remove() { this.removed = true; } },
    { removed: false, remove() { this.removed = true; } },
  ];
  const events = [];
  const original = {
    localStorage: globalThis.localStorage,
    window: globalThis.window,
    document: globalThis.document,
    location: globalThis.location,
    CustomEvent: globalThis.CustomEvent,
  };
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  globalThis.window = {
    dataLayer: [{ event: 'legacy' }],
    gtag() {},
    adsbygoogle: [],
    dispatchEvent(event) { events.push(event); },
  };
  globalThis.location = { hostname: 'spotfinder.test' };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  globalThis.document = {
    cookie: '_ga=old; _ga_TEST=old; __gads=old',
    querySelectorAll: () => elements,
  };
  return {
    values,
    elements,
    events,
    restore() { Object.assign(globalThis, original); },
  };
}

test('optional tracking stays off for a new visitor and creates no scripts', () => {
  const fixture = installBrowserFixture();
  try {
    bootConsent();
    assert.deepEqual(getEffectiveConsent(), {
      necessary: true,
      analytics: false,
      ads: false,
      optionalServicesAvailable: false,
    });
    assert.equal(globalThis.window.dataLayer.length, 0);
    assert.equal('adsbygoogle' in globalThis.window, false);
    assert.ok(fixture.elements.every(element => element.removed));
    assert.equal(fixture.events.at(-1).detail.analytics, false);
    assert.equal(fixture.events.at(-1).detail.ads, false);
  } finally {
    fixture.restore();
  }
});

test('a previously accepted record is preserved but cannot reactivate tracking', () => {
  const saved = JSON.stringify({ analytics: true, ads: true, decided: true, timestamp: '2026-01-01T00:00:00.000Z' });
  const fixture = installBrowserFixture(saved);
  try {
    const state = bootConsent();
    assert.equal(fixture.values.get('spotfinder_cookie_consent_v1'), saved);
    assert.equal(state.analytics, false);
    assert.equal(state.ads, false);
    assert.deepEqual(state.historicalPreferences, { analytics: true, ads: true });
    assert.equal(fixture.events.at(-1).detail.analytics, false);
    assert.equal(fixture.events.at(-1).detail.ads, false);
  } finally {
    fixture.restore();
  }
});

test('the public setter cannot grant analytics or advertising during suspension', () => {
  const fixture = installBrowserFixture();
  try {
    setConsent({ analytics: true, ads: true });
    const stored = JSON.parse(fixture.values.get('spotfinder_cookie_consent_v1'));
    assert.equal(stored.analytics, false);
    assert.equal(stored.ads, false);
    assert.equal(fixture.events.at(-1).detail.analytics, false);
    assert.equal(fixture.events.at(-1).detail.ads, false);
  } finally {
    fixture.restore();
  }
});

test('malformed saved consent fails closed without overwriting storage', () => {
  const fixture = installBrowserFixture('{broken');
  try {
    assert.deepEqual(getConsent(), {
      necessary: true,
      analytics: false,
      ads: false,
      decided: false,
      timestamp: null,
      historicalPreferences: { analytics: false, ads: false },
    });
    assert.equal(fixture.values.get('spotfinder_cookie_consent_v1'), '{broken');
  } finally {
    fixture.restore();
  }
});
