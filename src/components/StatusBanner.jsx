import React, { useEffect, useState } from 'react';
import { AlertTriangle, XCircle, X, MailWarning } from 'lucide-react';
import { getMaintenanceStatus, resendVerificationEmail } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';

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
export default function StatusBanner() {
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const { user, refreshUser } = useAuth();
  const [verifyDismissed, setVerifyDismissed] = useState(false);
  const [resent, setResent] = useState(false);

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

  if (status?.status === 'down') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
        <div className="max-w-sm w-full rounded-2xl bg-white dark:bg-gray-900 p-6 text-center shadow-xl">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">SpotFinder is temporarily unavailable</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {status.message || 'We are performing maintenance. Please check back shortly.'}
          </p>
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
          <span className="flex-1">{status.message || 'Some features may be temporarily degraded.'}</span>
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