import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from 'firebase/app-check';

// This is a public App Check key, separate from the Enterprise key used by
// public form submissions. The provider must match the Firebase registration.
export function initializeSpotFinderAppCheck(app) {
  if (typeof window === 'undefined') return null;

  const siteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim();
  const providerName = import.meta.env.VITE_FIREBASE_APP_CHECK_PROVIDER?.trim();
  if (!siteKey || !['enterprise', 'recaptcha-v3'].includes(providerName)) {
    if (import.meta.env.PROD) {
      console.error('Firebase App Check is not configured: set its public site key and matching provider before enabling enforcement.');
    }
    return null;
  }

  // HMR can re-evaluate this module while Firebase keeps the default app.
  const previous = globalThis.__spotfinderAppCheck;
  if (previous?.app === app) return previous.instance;

  // Only local development may request a debug token. The token is generated
  // by Firebase and must be registered privately in the Firebase Console.
  if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG === 'true') {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  const provider = providerName === 'enterprise'
    ? new ReCaptchaEnterpriseProvider(siteKey)
    : new ReCaptchaV3Provider(siteKey);
  const instance = initializeAppCheck(app, {
    provider,
    isTokenAutoRefreshEnabled: true,
  });
  globalThis.__spotfinderAppCheck = { app, instance };
  return instance;
}
