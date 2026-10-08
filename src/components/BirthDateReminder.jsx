import React, { useEffect, useState } from 'react';
import { CalendarDays, ShieldCheck, X } from 'lucide-react';
import { ensureAccountProfile, setAccountDateOfBirth } from '@/api/firebaseClient';

export default function BirthDateReminder({ user }) {
  const [profile, setProfile] = useState(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!user?.id) return undefined;
    ensureAccountProfile({}).then(data => { if (active) setProfile(data); }).catch(() => {});
    return () => { active = false; };
  }, [user?.id]);

  if (!user || !profile || profile.hasDateOfBirth || dismissed) return null;
  const deadline = profile.deadline ? new Date(profile.deadline) : null;

  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      await setAccountDateOfBirth({ dateOfBirth });
      setProfile({ ...profile, hasDateOfBirth: true });
    } catch (err) {
      setError(err?.message?.replace(/^Firebase:\s*/i, '') || 'Could not save your date of birth.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[1800] mx-auto max-w-md rounded-3xl border border-amber-200/80 bg-white/95 p-5 shadow-2xl backdrop-blur-xl dark:border-amber-500/30 dark:bg-slate-950/95 sm:bottom-6">
      <button type="button" onClick={() => setDismissed(true)} className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Remind me later"><X className="h-5 w-5" /></button>
      <div className="flex items-start gap-3 pr-10">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><CalendarDays className="h-5 w-5" /></div>
        <div><h2 className="font-bold text-slate-900 dark:text-white">Complete your account</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Add your date of birth by {deadline ? deadline.toLocaleDateString() : 'the deadline'} or this account will be deleted.</p></div>
      </div>
      <form onSubmit={save} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="reminder-date-of-birth">Date of birth</label>
        <input id="reminder-date-of-birth" type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} required max={new Date().toISOString().slice(0, 10)} className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-base dark:border-white/10 dark:bg-slate-900" />
        <button disabled={saving} className="min-h-12 rounded-xl bg-emerald-600 px-5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save securely'}</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><ShieldCheck className="h-3.5 w-3.5" />Private. Never displayed on your profile or spots.</p>
    </div>
  );
}
