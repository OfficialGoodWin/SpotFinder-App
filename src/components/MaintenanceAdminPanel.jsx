import React, { useState, useEffect } from 'react';
import { getMaintenanceStatus, setMaintenanceStatus } from '@/api/firebaseClient';

// Drop this into src/components/map/SuperAdminEditor.jsx (it's already
// gated to the superadmin account in your UI, and firestore.rules enforces
// the real restriction regardless — this panel just won't work for anyone
// else, since setMaintenanceStatus() will be rejected by the rules).
export default function MaintenanceAdminPanel() {
  const [status, setStatus] = useState('ok');
  const [message, setMessage] = useState('');
  const [showBanner, setShowBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getMaintenanceStatus().then(data => {
      setStatus(data.status || 'ok');
      setMessage(data.message || '');
      setShowBanner(!!data.showBanner);
      setLoaded(true);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setMaintenanceStatus({ status, message, showBanner });
    } catch (err) {
      alert('Failed to update — are you signed in as the superadmin account?');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-border space-y-3 max-w-md">
      <h3 className="font-semibold text-sm">Site status</h3>

      <div className="flex gap-2">
        {['ok', 'warning', 'down'].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 ${
              status === s
                ? s === 'down' ? 'bg-red-500 text-white border-red-500'
                  : s === 'warning' ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-green-500 text-white border-green-500'
                : 'border-gray-200 dark:border-border'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Message shown to users (banner text, or lockout message when 'down')"
        rows={3}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-border bg-white dark:bg-background text-sm resize-none"
      />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showBanner} onChange={e => setShowBanner(e.target.checked)} />
        Show banner (ignored when status is "down" — lockout always shows)
      </label>

      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
