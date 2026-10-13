import test from 'node:test';
import assert from 'node:assert/strict';
import { getConsent, initConsentMode, setConsent } from '../src/lib/consent.js';

test('optional scripts remain off before consent and choices revoke independently', () => {
  const values = new Map();
  const elements = new Map();
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
    dispatchEvent() {},
  };
  globalThis.location = { hostname: 'spotfinder.test' };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  globalThis.document = {
    cookie: '',
    createElement: () => ({ remove() { if (this.id) elements.delete(this.id); } }),
    head: { appendChild(element) { elements.set(element.id, element); } },
    getElementById: id => elements.get(id) || null,
    querySelectorAll: () => [],
  };

  try {
    initConsentMode();
    assert.deepEqual(getConsent(), { necessary: true, analytics: false, ads: false, decided: false, timestamp: null });
    assert.equal(elements.size, 0);

    setConsent({ analytics: true, ads: false });
    assert.ok(elements.has('spotfinder-google-analytics'));
    assert.equal(elements.has('spotfinder-google-ads'), false);

    setConsent({ analytics: false, ads: true });
    assert.equal(elements.has('spotfinder-google-analytics'), false);
    assert.ok(elements.has('spotfinder-google-ads'));
    assert.deepEqual(getConsent().analytics, false);
    assert.deepEqual(getConsent().ads, true);
  } finally {
    Object.assign(globalThis, original);
  }
});

test('malformed saved consent fails closed without overwriting storage', () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => '{broken', setItem() { throw new Error('unexpected write'); } };
  try {
    assert.deepEqual(getConsent(), { necessary: true, analytics: false, ads: false, decided: false, timestamp: null });
  } finally {
    globalThis.localStorage = original;
  }
});
