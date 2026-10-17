import React, { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import {
  acknowledgeCurrentPrivacyNotice,
  getConsent,
  rejectNonEssential,
} from '@/lib/consent';

// Optional analytics and advertising are currently suspended, so this panel
// intentionally offers no functional-looking optional consent controls.
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    if (!getConsent().decided) setVisible(true);

    const reopen = () => {
      setReopened(true);
      setVisible(true);
    };
    window.addEventListener('spotfinder:open-cookie-settings', reopen);
    return () => window.removeEventListener('spotfinder:open-cookie-settings', reopen);
  }, []);

  if (!visible) return null;

  const close = () => {
    acknowledgeCurrentPrivacyNotice();
    setVisible(false);
  };

  const withdrawOldChoices = () => {
    rejectNonEssential();
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-live="polite"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-0 bottom-0 z-[3000] p-3 sm:p-4"
      style={{ paddingBottom: 'max(.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="sf-sheet mx-auto max-w-2xl rounded-2xl p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <h2 id="cookie-consent-title" className="text-sm font-bold text-gray-900 dark:text-foreground">
              Cookies &amp; privacy
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-muted-foreground">
              SpotFinder uses storage for sign-in, preferences, and guest drafts. Google Analytics and Google
              advertising are temporarily disabled, regardless of any choice saved previously.
              Essential Firebase authentication and reCAPTCHA may still contact Google.{' '}
              <a href="/CookiePolicy" className="font-medium underline" target="_blank" rel="noopener noreferrer">
                Cookie Policy
              </a>
              {' · '}
              <a href="/PrivacyPolicy" className="font-medium underline" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
          Functional storage is active. Analytics and advertising controls are unavailable
          because those services cannot be enabled in this release.
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button onClick={close} className="sf-button-primary text-sm">
            {reopened ? 'Close preferences' : 'Continue'}
          </button>
          <button onClick={withdrawOldChoices} className="sf-button-secondary border-2 text-sm">
            Keep optional services off
          </button>
        </div>
      </div>
    </div>
  );
}

export function reopenCookieSettings() {
  window.dispatchEvent(new CustomEvent('spotfinder:open-cookie-settings'));
}
