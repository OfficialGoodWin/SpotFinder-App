import { notifyAppUpdate } from './chunkRecovery.js';

export function registerSpotFinderWorker(navigatorObject = navigator, windowObject = window, documentObject = document) {
  if (!('serviceWorker' in navigatorObject)) return;
  const hadController = Boolean(navigatorObject.serviceWorker.controller);
  let notified = false;
  let lastCheck = 0;
  let checking = false;
  const notify = () => {
    if (!hadController || notified) return;
    notified = true;
    notifyAppUpdate();
  };
  navigatorObject.serviceWorker.addEventListener('controllerchange', notify);

  navigatorObject.serviceWorker.register('/sw.js').then(registration => {
    if (registration.waiting) notify();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') notify();
      });
    });
    const check = async () => {
      if (documentObject.hidden || !navigatorObject.onLine || checking || Date.now() - lastCheck < 60_000) return;
      checking = true;
      lastCheck = Date.now();
      try { await registration.update(); }
      catch (error) { console.warn('Service worker update check failed:', error); }
      finally { checking = false; }
    };
    documentObject.addEventListener('visibilitychange', check);
    windowObject.addEventListener('pageshow', check);
    windowObject.addEventListener('online', check);
    check();
  }).catch(error => console.warn('Service worker registration failed:', error));
}

