import React, { useState, useEffect } from 'react';
import { AlertTriangle, XCircle, X } from 'lucide-react';
import { getMaintenanceStatus } from '@/api/firebaseClient';

// Renders:
//   - nothing, if status is 'ok' or showBanner is false
//   - a dismissible banner, if status is 'ok'/'warning' and showBanner is true
//   - a full-screen lockout (children not rendered) if status is 'down'
//
// Security note: this component only controls what's *displayed*. The actual
// kill switch is enforced by firestore.rules (writes rejected when
// config/maintenance.status == 'down'), so even if someone bypasses this
// component entirely, the backend still refuses new spots/flags/votes/etc.
export default function MaintenanceGate({ children }) {
  const [maintenance, setMaintenance] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMaintenanceStatus()
      .then(data => { if (!cancelled) setMaintenance(data); })
      .catch(err => {
        console.warn('Could not fetch maintenance status:', err);
        if (!cancelled) setMaintenance({ status: 'ok', message: '', showBanner: false });
      });
    return () => { cancelled = true; };
  }, []);

  // Don't block rendering while the check is in flight — fail open on the
  // banner, but the full-screen lock only appears once we've confirmed 'down'.
  if (!maintenance) return children;

  if (maintenance.status === 'down') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/95 p-6">
        <div className="max-w-md w-full bg-white dark:bg-background rounded-2xl p-6 text-center space-y-3">
          <XCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-foreground">
            SpotFinder is temporarily unavailable
          </h1>
          <p className="text-sm text-gray-600 dark:text-foreground whitespace-pre-line">
            {maintenance.message || 'We\'ll be back shortly. Thanks for your patience.'}
          </p>
        </div>
      </div>
    );
  }

  const showBanner = maintenance.showBanner && !dismissed && maintenance.message;

  return (
    <>
      {showBanner && (
        <div className={`w-full px-4 py-2.5 flex items-start gap-2 text-sm ${
          maintenance.status === 'warning'
            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-b border-amber-200 dark:border-amber-700'
            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-b border-blue-200 dark:border-blue-700'
        }`}>
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="flex-1 whitespace-pre-line">{maintenance.message}</p>
          <button onClick={() => setDismissed(true)} className="shrink-0">
            <X className="w-4 h-4 opacity-60 hover:opacity-100" />
          </button>
        </div>
      )}
      {children}
    </>
  );
}
