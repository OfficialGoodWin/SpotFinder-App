// src/lib/consent.js
//
// Minimal cookie/tracking consent manager for GDPR / ePrivacive compliance.
//
// Why this exists: this app loads Google Analytics (gtag) and Google AdSense,
// both of which set non-essential cookies / use device storage for tracking
// and advertising purposes. Under the EU ePrivacy Directive (as implemented in
// Czech law, § 89 Act No. 127/2005 Coll. on Electronic Communications) and the
// GDPR, prior opt-in consent is required before such non-essential
// cookies/scripts may run for users in the EU/EEA/UK. Strictly-necessary
// cookies (e.g. login session, language preference, security) do NOT require
// consent and are always allowed.
//
// This module stores the user's choice in localStorage and exposes helpers to
// gate loading of Analytics/Ads scripts, plus a Google "Consent Mode v2"
// bootstrap so Google's own tags respect the choice (and Google's ad
// products don't treat EEA/UK traffic as consented by default).
//
// NOTE: This is a lightweight, framework-free implementation appropriate for
// a small app. It is NOT a substitute for legal review — see the Cookie
// Policy page and the compliance notes shared alongside this change.

const STORAGE_KEY = 'spotfinder_cookie_consent_v1';

const DEFAULT_STATE = {
  necessary: true, // always on, no choice needed
  analytics: false,
  ads: false,
  decided: false, // has the user made an explicit choice yet?
  timestamp: null,
};

export function getConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function setConsent({ analytics, ads }) {
  const state = {
    necessary: true,
    analytics: !!analytics,
    ads: !!ads,
    decided: true,
    timestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private mode / disabled) — consent will be
    // re-asked next load, which is the safe failure mode.
  }
  applyConsent(state);
  return state;
}

export function acceptAll() {
  return setConsent({ analytics: true, ads: true });
}

export function rejectNonEssential() {
  return setConsent({ analytics: false, ads: false });
}

// ── Google Consent Mode v2 ──────────────────────────────────────────────────
// Must run before gtag.js loads. Defaults everything to "denied" so no
// tracking cookie is set until the user opts in. Also sets a couple of
// Google-recommended defaults (wait_for_update, region-agnostic here — this
// app doesn't attempt geo-targeted consent rules like "only EEA needs to
// ask", which is a defensible simplification but worth revisiting if you
// want to show non-EEA users a lighter-weight/no banner).
export function initConsentMode() {
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });
}

function applyConsent(state) {
  if (window.gtag) {
    window.gtag('consent', 'update', {
      ad_storage: state.ads ? 'granted' : 'denied',
      ad_user_data: state.ads ? 'granted' : 'denied',
      ad_personalization: state.ads ? 'granted' : 'denied',
      analytics_storage: state.analytics ? 'granted' : 'denied',
    });
  }
  if (state.analytics) loadAnalytics();
  if (state.ads) loadAds();
  window.dispatchEvent(new CustomEvent('spotfinder:consent-changed', { detail: state }));
}

// ── Script loaders (only ever called after consent is granted) ─────────────
let analyticsLoaded = false;
export function loadAnalytics() {
  if (analyticsLoaded) return;
  analyticsLoaded = true;
  const GA_ID = 'G-GC7D8SVBMV';
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { anonymize_ip: true });
}

let adsLoaded = false;
export function loadAds() {
  if (adsLoaded) return;
  adsLoaded = true;
  const CLIENT = 'ca-pub-9210597135045895';
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

// On boot, if the user already decided in a previous session, re-apply their
// choice (this re-runs the loaders / consent-mode update on every page load).
export function bootConsent() {
  initConsentMode();
  const state = getConsent();
  if (state.decided) applyConsent(state);
  return state;
}
