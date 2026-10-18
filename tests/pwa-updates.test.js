import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSpotFinderWorker } from '../src/lib/pwaUpdates.js';

test('an already controlled PWA announces a newly installed worker without reloading', async () => {
  const previousWindow = globalThis.window;
  const events = new EventTarget();
  globalThis.window = events;
  let notices = 0;
  events.addEventListener('spotfinder:update-available', () => { notices += 1; });
  const worker = new EventTarget();
  worker.state = 'installing';
  const registration = new EventTarget();
  registration.installing = worker;
  registration.waiting = null;
  registration.update = async () => {};
  const serviceWorker = new EventTarget();
  serviceWorker.controller = {};
  serviceWorker.register = async () => registration;
  const navigatorObject = { serviceWorker, onLine: true };
  const documentObject = new EventTarget();
  documentObject.hidden = false;
  try {
    registerSpotFinderWorker(navigatorObject, events, documentObject);
    await new Promise(resolve => setTimeout(resolve, 0));
    registration.dispatchEvent(new Event('updatefound'));
    worker.state = 'installed';
    worker.dispatchEvent(new Event('statechange'));
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    assert.equal(notices, 1);
  } finally {
    globalThis.window = previousWindow;
  }
});

test('first service worker installation does not claim a newer app is ready', async () => {
  const previousWindow = globalThis.window;
  const events = new EventTarget();
  globalThis.window = events;
  let notices = 0;
  events.addEventListener('spotfinder:update-available', () => { notices += 1; });
  const serviceWorker = new EventTarget();
  serviceWorker.controller = null;
  serviceWorker.register = async () => ({ waiting: {}, addEventListener() {}, update: async () => {} });
  try {
    registerSpotFinderWorker({ serviceWorker, onLine: true }, events, { hidden: false, addEventListener() {} });
    await new Promise(resolve => setTimeout(resolve, 0));
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    assert.equal(notices, 0);
  } finally {
    globalThis.window = previousWindow;
  }
});
