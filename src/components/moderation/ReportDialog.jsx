import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flag, X } from 'lucide-react';
import { submitGeneralReport } from '@/api/firebaseClient';
import { submitReportPilot } from '@/api/reportPilotClient';
import TurnstileChallenge from '@/new/TurnstileChallenge';
import { useLanguage } from '@/lib/LanguageContext';
import './report-dialog.css';
import { REPORT_REASONS, canSubmitReport } from './reportReasons';

const REPORT_PILOT = import.meta.env.VITE_REPORT_API_PILOT_ENABLED === 'true';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

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
  const { t } = useLanguage();
  return (
    <p className="mt-3 text-center text-[11px] leading-4 text-slate-400">
      {t('reportUi.recaptchaStart')}{' '}
      <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">{t('reportUi.privacyPolicy')}</a>{' '}
      {t('common.and')}{' '}
      <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">{t('reportUi.termsService')}</a>{' '}
      {t('reportUi.apply')}
    </p>
  );
}

export default function ReportDialog({ open, onClose, user, targetType, targetId, targetLabel, targetSnapshot = {} }) {
  const { t } = useLanguage();
  const reasons = useMemo(() => REPORT_REASONS[targetType] || REPORT_REASONS.poi, [targetType]);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [challengeRequired, setChallengeRequired] = useState(false);
  const [challengeToken, setChallengeToken] = useState('');
  const [challengeReset, setChallengeReset] = useState(0);
  const requestId = useRef('');
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focus = window.requestAnimationFrame(() => dialogRef.current?.querySelector('button[aria-label]')?.focus());
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose?.(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea,a[href]')];
      if (!items.length) return;
      const index = items.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1).focus(); }
      else if (!event.shiftKey && index === items.length - 1) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { window.cancelAnimationFrame(focus); document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; previousFocus?.focus?.(); };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setReason('');
      setNote('');
      setSent(false);
      setError('');
      setChallengeRequired(false);
      setChallengeToken('');
      requestId.current = '';
    }
  }, [open, targetId]);

  if (!open) return null;

  const verified = Boolean(user && !user.isAnonymous && user.emailVerified === true);
  const submit = async () => {
    if (!canSubmitReport({ verified, reason, busy, challengeRequired: REPORT_PILOT && challengeRequired, challengeToken })) return;
    setBusy(true);
    setError('');
    try {
      const payload = {
        category: reason,
        subject: `Report: ${targetLabel || targetType}`,
        message: note.trim(),
        targetType,
        targetId,
        deviceId: deviceId(),
        targetSnapshot,
      };
      if (REPORT_PILOT) {
        if (!requestId.current) requestId.current = crypto.randomUUID();
        await submitReportPilot(payload, requestId.current, challengeToken);
      } else {
        await submitGeneralReport(payload);
      }
      setSent(true);
    } catch (caught) {
      if (REPORT_PILOT && caught?.code === 'CHALLENGE_REQUIRED') setChallengeRequired(true);
      else if (REPORT_PILOT && caught?.code === 'INVALID_CHALLENGE') {
        setChallengeToken(''); setChallengeReset(value => value + 1);
        setError(t('common.reportChallengeFailed'));
      } else if (REPORT_PILOT && ['REPORT_HARD_LIMIT', 'REPORT_COOLDOWN'].includes(caught?.code)) {
        setError(t('common.reportRateLimited', { seconds: caught.retryAfter || 60 }));
      } else if (REPORT_PILOT && caught?.code === 'CHALLENGE_UNAVAILABLE') {
        setError(t('common.reportChallengeUnavailable'));
      } else setError(t('reportUi.sendFailed'));
    } finally {
      if (REPORT_PILOT && challengeToken) {
        setChallengeToken('');
        setChallengeReset(value => value + 1);
      }
      setBusy(false);
    }
  };

  return (
    <div className="sf-report-dialog fixed inset-0 z-[5000] flex items-end justify-center bg-black/50 sm:items-center" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div ref={dialogRef} className="sf-report-panel max-h-[88vh] w-full overflow-auto rounded-t-2xl bg-white p-5 dark:bg-slate-900 sm:max-w-md sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="sf-report-title" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose?.(); } }}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            <h2 id="sf-report-title" className="text-lg font-semibold">{t('reportUi.title', { type: t(`reportUi.type.${targetType}` , t('reportUi.type.poi')) })}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={t('reportUi.close')}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div>
            <p className="font-medium" role="status">{t('reportUi.sent')}</p>
            <p className="mt-1 text-sm text-slate-500">{t('reportUi.reviewHint')}</p>
            <button type="button" onClick={onClose} className="sf-report-done mt-5 w-full rounded-lg py-2.5 text-white">{t('reportUi.done')}</button>
          </div>
        ) : !verified ? (
          <div>
            <p className="font-medium">{t('reportUi.verifiedRequired')}</p>
            <p className="mt-1 text-sm text-slate-500">{t('reportUi.verifiedHint')}</p>
            <button type="button" onClick={onClose} className="mt-5 w-full rounded-lg border py-2.5">{t('common.close')}</button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-500">{t('reportUi.questionStart')}{' '}<strong>{targetLabel || t('reportUi.thisItem')}</strong>?</p>
            <fieldset className="sf-report-reasons space-y-2"><legend className="sr-only">{t('reportUi.questionStart')}</legend>
              {reasons.map(value => (
                <label key={value} className={`sf-report-reason flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${reason === value ? 'is-selected' : ''}`}>
                  <input type="radio" name="report-reason" checked={reason === value} onChange={() => setReason(value)} />
                  <span className="text-sm">{t(`reportUi.reason.${targetType === 'poi_photo' ? 'photo' : targetType === 'social_post' ? 'social' : 'place'}.${value}`)}</span>
                </label>
              ))}
            </fieldset>
            <textarea aria-label={t('reportUi.notePlaceholder')} value={note} onChange={event => setNote(event.target.value.slice(0, 1000))} placeholder={t('reportUi.notePlaceholder')} className="sf-report-note mt-4 min-h-24 w-full rounded-xl border bg-transparent p-3" />
            <div className="text-right text-xs text-slate-400">{note.length}/1000</div>
            {REPORT_PILOT && challengeRequired && <TurnstileChallenge active siteKey={TURNSTILE_SITE_KEY} action="submit_report" resetKey={challengeReset} onToken={value => setChallengeToken(value || '')} />}
            {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
            <button type="button" onClick={submit} disabled={!canSubmitReport({ verified, reason, busy, challengeRequired: REPORT_PILOT && challengeRequired, challengeToken })} className="sf-report-submit mt-3 w-full rounded-lg py-2.5 text-white disabled:opacity-40">
              {t(busy ? 'reportUi.sending' : 'reportUi.send')}
            </button>
            {!REPORT_PILOT && <RecaptchaDisclosure />}
          </>
        )}
      </div>
    </div>
  );
}
