import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, MailWarning } from 'lucide-react';
import { getMaintenanceStatus, resendVerificationEmail } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Link, useLocation } from 'react-router-dom';

/**
 * Global status banner. Previously `getMaintenanceStatus`/`setMaintenanceStatus`
 * existed in firebaseClient.js but were never called from any component, and
 * firestore.rules had no rule at all for the `config` collection they read
 * from — so even if this had been wired up, every read would have failed
 * with a permission-denied error. Both are fixed now:
 *   - firestore.rules: `match /config/{docId} { allow read: if true; ... }`
 *   - this component actually calls getMaintenanceStatus() and renders it.
 *
 * status: 'ok' (nothing shown) | 'warning' (dismissible banner) |
 *         'down' (full-screen blocking notice, not dismissible)
 *
 * Also surfaces an "email not verified" banner: firestore.rules now
 * requires `request.auth.token.email_verified == true` before a new
 * account can post a spot, review, flag, or vote (see SECURITY_REVIEW.md
 * §0/§1) — signed-up users need a visible way to know why a submission is
 * being rejected and a button to resend the verification email.
 */
function safeBannerMessage(message, fallback) {
  if (!message) return fallback;

  // Status messages are plain text only. Strip markup and URL-looking text so
  // even a compromised/mistaken status message cannot create or advertise an
  // off-platform link. Navigation is provided separately by our fixed /Status
  // link below. This also cleans up old messages that contained literal <a>.
  const cleaned = String(message)
    .replace(/<[^>]*>/g, ' ')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, '')
    .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,63}(?:\/\S*)?/gi, '')
    .replace(/\b(?:see|read|view)\s+(?:more\s+)?(?:on|in|at)?\s*(?:the\s+)?status\s+page\.?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || fallback;
}

export default function StatusBanner() {
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const { user, refreshUser } = useAuth();
  const [verifyDismissed, setVerifyDismissed] = useState(false);
  const [resent, setResent] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    getMaintenanceStatus()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch((err) => {
        // Fail open: if the status doc can't be read (offline, rules
        // misconfigured, etc.) the app should still be usable.
        console.error('Could not load site status:', err);
        if (!cancelled) setStatus({ status: 'ok' });
      });
    return () => { cancelled = true; };
  }, []);

  if (status?.status === 'down' && location.pathname.toLowerCase() !== '/status') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
        <div className="max-w-lg w-full rounded-2xl bg-white dark:bg-gray-900 p-6 text-center shadow-xl my-auto">
          {/* Local artwork: even during a full shutdown this does not rely on an
              external image service. */}
          <img
            src="/spotfinder-outage.png"
            alt="SpotFinder workers repairing servers"
            className="w-full max-w-md mx-auto h-auto max-h-[42vh] object-contain mb-4 rounded-lg"
          />
          <h2 className="text-xl font-semibold mb-2">SpotFinder is temporarily unavailable</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {safeBannerMessage(status.message, 'We are performing maintenance. Please check back shortly.')}
          </p>
          <Link to="/Status" className="inline-block mt-4 text-sm font-semibold underline">
            View Status Page
          </Link>
        </div>
      </div>
    );
  }

  const showWarning = status?.status === 'warning' && status.showBanner && !dismissed;
  const showVerify = user && !user.emailVerified && !verifyDismissed;

  if (!showWarning && !showVerify) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] flex flex-col">
      {showWarning && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center gap-2 text-sm shadow">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">
            {safeBannerMessage(status.message, 'Some features may be temporarily degraded.')}
            {' '}
            <Link to="/Status" className="underline font-semibold whitespace-nowrap">
              Status Page
            </Link>
          </span>
          <button onClick={() => setDismissed(true)} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {showVerify && (
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center gap-2 text-sm shadow">
          <MailWarning className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">
            {resent
              ? 'Verification email sent — check your inbox.'
              : 'Please verify your email to add spots, reviews, or reports.'}
          </span>
          {!resent && (
            <button
              onClick={() => resendVerificationEmail().then(() => setResent(true)).catch(() => {})}
              className="underline font-semibold whitespace-nowrap"
            >
              Resend email
            </button>
          )}
          <button
            onClick={() => refreshUser()}
            className="underline font-semibold whitespace-nowrap"
          >
            I've verified
          </button>
          <button onClick={() => setVerifyDismissed(true)} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}