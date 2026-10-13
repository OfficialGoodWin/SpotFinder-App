// Optional analytics and advertising are suspended. This module deliberately
// contains no tag loader: stored choices are retained for a future reviewed
// migration, but they never become effective consent in this release.

const STORAGE_KEY = 'spotfinder_cookie_consent_v1';

const DEFAULT_STATE = {
  necessary: true,
  analytics: false,
  ads: false,
  decided: false,
  timestamp: null,
  historicalPreferences: { analytics: false, ads: false },
};

export const OPTIONAL_TRACKING_AVAILABLE = false;

export function getConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_STATE };
    return {
      necessary: true,
      analytics: false,
      ads: false,
      decided: parsed.decided === true,
      timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : null,
      // Preserve the old record without treating it as permission. Any future
      // integration must collect a fresh opt-in under a new consent version.
      historicalPreferences: {
        analytics: parsed.analytics === true,
        ads: parsed.ads === true,
      },
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function getEffectiveConsent() {
  return {
    necessary: true,
    analytics: false,
    ads: false,
    optionalServicesAvailable: OPTIONAL_TRACKING_AVAILABLE,
  };
}

// Records a necessary-only decision. Optional choices cannot be granted while
// the integrations are suspended.
export function setConsent() {
  const state = {
    necessary: true,
    analytics: false,
    ads: false,
    decided: true,
    timestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Safe failure: optional services remain unavailable.
  }
  dispatchEffectiveConsent(state);
  return state;
}

export function rejectNonEssential() {
  return setConsent();
}

export function acknowledgeCurrentPrivacyNotice() {
  const current = getConsent();
  if (current.decided) {
    dispatchEffectiveConsent(current);
    return current;
  }
  return rejectNonEssential();
}

function expireFirstPartyCookie(name) {
  document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname}; SameSite=Lax`;
}

export function removeLegacyOptionalTracking() {
  // Defense in depth for a same-tab upgrade or stale HTML. The CSP also blocks
  // these providers, and this release has no code capable of loading them.
  window['ga-disable-G-GC7D8SVBMV'] = true;
  document.querySelectorAll(
    'script[src*="googletagmanager.com"], script[src*="googlesyndication.com"], script[src*="doubleclick.net"], ins.adsbygoogle',
  ).forEach(element => element.remove());

  document.cookie.split(';').map(value => value.split('=')[0].trim())
    .filter(name => name === '_ga' || name.startsWith('_ga_') || ['__gads', '__gpi', '__eoi'].includes(name))
    .forEach(expireFirstPartyCookie);

  if (Array.isArray(window.dataLayer)) window.dataLayer.length = 0;
  if ('gtag' in window) window.gtag = () => {};
  if ('adsbygoogle' in window) delete window.adsbygoogle;
}

function dispatchEffectiveConsent(savedState) {
  window.dispatchEvent(new CustomEvent('spotfinder:consent-changed', {
    detail: {
      ...savedState,
      analytics: false,
      ads: false,
      optionalServicesAvailable: false,
    },
  }));
}

export function bootConsent() {
  removeLegacyOptionalTracking();
  const state = getConsent();
  dispatchEffectiveConsent(state);
  return state;
}
