import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken, onTokenChanged } from 'firebase/app-check';
import { validAppCheckConfig, readAppCheckToken, observeAppCheckStatus } from '../lib/appCheckCore';

// This is a public App Check key, separate from the Enterprise key used by
// public form submissions. The provider must match the Firebase registration.
export function initializeSpotFinderAppCheck(app) {
  if (typeof window === 'undefined') return null;

  const siteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim();
  const providerName = import.meta.env.VITE_FIREBASE_APP_CHECK_PROVIDER?.trim();
  if (!validAppCheckConfig(siteKey, providerName)) {
    if (import.meta.env.VITE_SPOTFINDER_STAGE === 'staging') {
      console.warn('[app-check] not configured');
    }
    if (import.meta.env.PROD) {
      console.error('Firebase App Check is not configured: set its public site key and matching provider before enabling enforcement.');
    }
    return null;
  }

  // HMR can re-evaluate this module while Firebase keeps the default app.
  const previous = globalThis.__spotfinderAppCheck;
  if (previous?.app === app) return previous.instance;

  const instance = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  globalThis.__spotfinderAppCheck = { app, instance };
  if (import.meta.env.VITE_SPOTFINDER_STAGE === 'staging') {
    observeAppCheckStatus(instance, onTokenChanged, status => {
      if (status === 'ready') console.info('[app-check] attestation ready');
      else console.warn(`[app-check] attestation ${status}`);
    });
  }
  return instance;
}

// getToken reuses the SDK cache and refreshes on expiry. Only custom Vercel
// requests call this; Firebase SDK requests attach their own tokens.
export async function getSpotFinderAppCheckToken(appCheck) {
  return readAppCheckToken(appCheck, getToken);
}
