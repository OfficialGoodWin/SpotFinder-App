import React, { useEffect, useMemo, useState } from 'react';
import { Flag, X } from 'lucide-react';
import { submitGeneralReport } from '@/api/firebaseClient';

const REASONS = {
  spot: [['wrong_info', 'Wrong or outdated information'], ['wrong_location', 'Wrong location'], ['closed_or_missing', 'Closed or missing'], ['duplicate', 'Duplicate'], ['inappropriate', 'Inappropriate or offensive'], ['spam_scam', 'Spam or scam'], ['other_safety', 'Other / safety concern']],
  poi: [['wrong_info', 'Wrong or outdated information'], ['wrong_location', 'Wrong location'], ['closed_or_missing', 'Closed or missing'], ['duplicate', 'Duplicate'], ['inappropriate', 'Inappropriate or offensive'], ['spam_scam', 'Spam or scam'], ['other_safety', 'Other / safety concern']],
  poi_photo: [['wrong_place', 'Not a photo of this place'], ['inappropriate', 'Inappropriate or offensive'], ['copyright', 'Copyright / stolen image'], ['private_info', 'Contains private information'], ['misleading', 'Misleading or heavily edited'], ['spam', 'Spam / advertisement'], ['other', 'Other problem']],
};

function deviceId() {
  try {
    let id = localStorage.getItem('sf_device_id');
    if (!id) {
      id = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      localStorage.setItem('sf_device_id', id);
    }
    return id;
  } catch {
    return '';
  }
}

function RecaptchaDisclosure() {
  return (
    <p className="mt-3 text-center text-[11px] leading-4 text-slate-400">
      This site is protected by reCAPTCHA and the Google{' '}
      <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">Privacy Policy</a>{' '}
      and{' '}
      <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">Terms of Service</a>{' '}
      apply.
    </p>
  );
}

export default function ReportDialog({ open, onClose, user, targetType, targetId, targetLabel, targetSnapshot = {} }) {
  const reasons = useMemo(() => REASONS[targetType] || REASONS.poi, [targetType]);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setNote('');
      setSent(false);
      setError('');
    }
  }, [open, targetId]);

  if (!open) return null;

  const verified = Boolean(user && !user.isAnonymous && user.emailVerified === true);
  const submit = async () => {
    if (!verified || !reason || busy) return;
    setBusy(true);
    setError('');
    try {
      await submitGeneralReport({
        category: reason,
        subject: `Report: ${targetLabel || targetType}`,
        message: note.trim(),
        targetType,
        targetId,
        deviceId: deviceId(),
        targetSnapshot,
      });
      setSent(true);
    } catch (submitError) {
      setError(submitError?.message || 'Could not send report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-end justify-center bg-black/50 sm:items-center" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className="max-h-[88vh] w-full overflow-auto rounded-t-2xl bg-white p-5 dark:bg-slate-900 sm:max-w-md sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Report {targetType === 'poi_photo' ? 'photo' : targetType === 'spot' ? 'spot' : 'place'}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close report">
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div>
            <p className="font-medium">Report sent. Thank you.</p>
            <p className="mt-1 text-sm text-slate-500">An admin can review it. Reports do not automatically remove content.</p>
            <button type="button" onClick={onClose} className="mt-5 w-full rounded-lg bg-slate-900 py-2.5 text-white">Done</button>
          </div>
        ) : !verified ? (
          <div>
            <p className="font-medium">Verified account required</p>
            <p className="mt-1 text-sm text-slate-500">Sign in with an account whose email has been verified before reporting content.</p>
            <button type="button" onClick={onClose} className="mt-5 w-full rounded-lg border py-2.5">Close</button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-500">What&apos;s wrong with <strong>{targetLabel || 'this item'}</strong>?</p>
            <div className="space-y-2">
              {reasons.map(([value, label]) => (
                <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${reason === value ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                  <input type="radio" name="report-reason" checked={reason === value} onChange={() => setReason(value)} />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
            <textarea value={note} onChange={event => setNote(event.target.value.slice(0, 1000))} placeholder="Optional details for the moderator…" className="mt-4 min-h-24 w-full rounded-xl border bg-transparent p-3" />
            <div className="text-right text-xs text-slate-400">{note.length}/1000</div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button type="button" onClick={submit} disabled={!reason || busy} className="mt-3 w-full rounded-lg bg-red-600 py-2.5 text-white disabled:opacity-40">
              {busy ? 'Sending…' : 'Send report'}
            </button>
            <RecaptchaDisclosure />
          </>
        )}
      </div>
    </div>
  );
}
