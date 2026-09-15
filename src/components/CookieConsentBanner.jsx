import React, { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import { getConsent, acceptAll, rejectNonEssential, setConsent } from '@/lib/consent';

// Cookie consent banner — shown until the user makes an explicit choice.
// Required for GDPR/ePrivacy compliance because this app uses Google
// Analytics and Google AdSense (non-essential cookies). Strictly-necessary
// items (login session, language preference) never need this and are not
// listed as optional here.
//
// Also exported as `CookiePreferencesLink` so Settings/Footer can let users
// re-open this banner at any time to change their mind, as required by law.

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(false);
  const [adsChecked, setAdsChecked] = useState(false);

  useEffect(() => {
    const state = getConsent();
    if (!state.decided) setVisible(true);

    const reopen = () => setVisible(true);
    window.addEventListener('spotfinder:open-cookie-settings', reopen);
    return () => window.removeEventListener('spotfinder:open-cookie-settings', reopen);
  }, []);

  if (!visible) return null;

  const handleAcceptAll = () => { acceptAll(); setVisible(false); };
  const handleRejectAll = () => { rejectNonEssential(); setVisible(false); };
  const handleSavePreferences = () => {
    setConsent({ analytics: analyticsChecked, ads: adsChecked });
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-0 bottom-0 z-[3000] p-3 sm:p-4"
    >
      <div className="max-w-2xl mx-auto bg-white dark:bg-card border border-gray-200 dark:border-border rounded-2xl shadow-2xl p-5">
        <div className="flex items-start gap-3 mb-3">
          <Cookie className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 id="cookie-consent-title" className="text-sm font-bold text-gray-900 dark:text-foreground">
              Cookies &amp; privacy
            </h2>
            <p className="text-sm text-gray-600 dark:text-muted-foreground mt-1">
              We use strictly-necessary cookies to run this site. With your permission, we'd
              also like to use analytics cookies (to understand how the app is used) and
              advertising cookies (to show ads that keep the free tier funded). You can change
              this anytime in Settings.{' '}
              <a href="/CookiePolicy" className="underline font-medium" target="_blank" rel="noopener noreferrer">
                Cookie Policy
              </a>
              {' · '}
              <a href="/PrivacyPolicy" className="underline font-medium" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>

        {expanded && (
          <div className="space-y-2 mb-4 pl-8">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-foreground">
              <input type="checkbox" checked disabled className="w-4 h-4 rounded" />
              Strictly necessary (always on)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-foreground">
              <input
                type="checkbox"
                checked={analyticsChecked}
                onChange={e => setAnalyticsChecked(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Analytics (Google Analytics)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-foreground">
              <input
                type="checkbox"
                checked={adsChecked}
                onChange={e => setAdsChecked(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Advertising (Google AdSense)
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAcceptAll}
            className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            Accept all
          </button>
          <button
            onClick={handleRejectAll}
            className="px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-border text-sm font-semibold text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-accent"
          >
            Reject non-essential
          </button>
          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 dark:text-muted-foreground underline"
            >
              Customize
            </button>
          ) : (
            <button
              onClick={handleSavePreferences}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 dark:text-muted-foreground underline"
            >
              Save preferences
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Call this from a "Cookie settings" button anywhere in the app (e.g.
// SettingsModal, footer) to let users reopen the banner and change consent,
// which GDPR requires be as easy as giving it.
export function reopenCookieSettings() {
  window.dispatchEvent(new CustomEvent('spotfinder:open-cookie-settings'));
}
