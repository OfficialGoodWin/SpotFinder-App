import { useEffect, useState } from 'react';
import { ShieldCheck, Smartphone } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import {
  getFirebaseServices, getMfaRecaptchaVerifier, clearMfaRecaptchaVerifier,
  startMfaEnrollment, completeMfaEnrollment, getEnrolledMfaFactors, unenrollMfaFactor,
} from '@/api/firebaseClient';

// Requires the project be upgraded to Identity Platform with SMS MFA turned
// on in the Firebase console, and the signed-in user's email verified —
// Firebase itself blocks enrollment otherwise.
export default function MfaSection() {
  const { t } = useLanguage();
  const { auth } = getFirebaseServices();
  const user = auth.currentUser;

  const [factors, setFactors] = useState([]);
  const [phone, setPhone] = useState('');
  const [verificationId, setVerificationId] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) setFactors(getEnrolledMfaFactors(user));
  }, [user]);

  // Not signed in, or a guest/anonymous session — nothing to secure yet.
  if (!user || user.isAnonymous) return null;

  const handleSendCode = async () => {
    const normalizedPhone = phone.replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError('phoneInvalid');
      return;
    }
    setBusy(true); setError('');
    try {
      const verifier = getMfaRecaptchaVerifier('mfa-enroll-recaptcha');
      const id = await startMfaEnrollment(user, normalizedPhone, verifier);
      setPhone(normalizedPhone);
      setVerificationId(id);
    } catch (err) {
      setError(err.code === 'auth/unverified-email' || err.message === 'auth/unverified-email'
        ? 'verifyEmail'
        : err.code === 'auth/too-many-requests'
          ? 'tooMany'
          : err.code === 'auth/operation-not-allowed'
            ? 'unavailable'
        : 'sendFailed');
    } finally { setBusy(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!verificationId || !code.trim()) return;
    setBusy(true); setError('');
    try {
      await completeMfaEnrollment(user, verificationId, code.trim(), phone.trim());
      clearMfaRecaptchaVerifier();
      setFactors(getEnrolledMfaFactors(user));
      setPhone(''); setVerificationId(null); setCode('');
    } catch (err) {
      setError('verificationFailed');
    } finally { setBusy(false); }
  };

  const handleRemove = async (uid) => {
    setBusy(true);
    try {
      await unenrollMfaFactor(user, uid);
      setFactors(getEnrolledMfaFactors(user));
    } catch (err) {
      setError('removeFailed');
    } finally { setBusy(false); }
  };

  return (
    <section className="sf-section" aria-labelledby="mfa-settings-title">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <h3 id="mfa-settings-title" className="text-sm font-bold uppercase tracking-wide">{t('mfaUi.title')}</h3>
      </div>

      {factors.length > 0 && (
        <div className="space-y-2 mb-3">
          {factors.map(f => (
            <div key={f.uid} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><Smartphone className="w-4 h-4" />{f.displayName || f.phoneNumber}</span>
              <button disabled={busy} onClick={() => handleRemove(f.uid)} className="text-xs text-red-500 underline disabled:opacity-40">
                {t('mfaUi.remove')}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mb-3 text-xs font-medium text-muted-foreground" role="status">
        {t(factors.length > 0 ? 'mfaUi.active' : 'mfaUi.inactive')}
      </p>

      <div id="mfa-enroll-recaptcha" />

      {!verificationId ? (
        <div className="sf-settings-action-row flex gap-2">
          <input aria-label={t('mfaUi.phoneLabel')} type="tel" autoComplete="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+48 123 456 789"
            className="sf-control min-w-0 flex-1 text-sm"
          />
          <button disabled={busy || !phone.trim()} onClick={handleSendCode} className="sf-button-primary shrink-0 text-sm">
            {t('mfaUi.sendCode')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="sf-settings-action-row flex gap-2">
          <input aria-label={t('mfaUi.codeLabel')} autoComplete="one-time-code"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder={t('mfaUi.codePlaceholder')}
            inputMode="numeric"
            className="sf-control min-w-0 flex-1 text-sm"
          />
          <button disabled={busy || !code.trim()} className="sf-button-primary shrink-0 text-sm">
            {t('mfaUi.confirm')}
          </button>
        </form>
      )}

      {error && <p className="sf-status-error mt-3" role="alert">{t(`mfaUi.${error}`)}</p>}
      <p className="text-xs text-muted-foreground mt-2">
        {t('mfaUi.recoveryHint')}
      </p>
    </section>
  );
}
