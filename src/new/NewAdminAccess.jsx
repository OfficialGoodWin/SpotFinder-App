import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { completeTotpEnrollment, getEnrolledMfaFactors, getFirebaseServices, startTotpEnrollment } from '@/api/firebaseClient';
import Admin from '@/pages/Admin';
import { useLanguage } from '@/lib/LanguageContext';

const ADMIN_EMAIL = 'redm3467@gmail.com';
const WINDOW_SECONDS = 1800;

function remainingSeconds(claims, now = Date.now()) {
  if (claims?.admin !== true || claims?.email !== ADMIN_EMAIL || claims?.email_verified !== true
    || claims?.firebase?.sign_in_provider !== 'google.com' || claims?.firebase?.sign_in_second_factor !== 'totp') return 0;
  const authTime = Number(claims.auth_time);
  if (!Number.isFinite(authTime)) return 0;
  return Math.max(0, Math.ceil((authTime * 1000 + WINDOW_SECONDS * 1000 - now) / 1000));
}

export default function NewAdminAccess() {
  const { t } = useLanguage();
  const { user, isAdmin, logout } = useAuth();
  const [claims, setClaims] = useState(null);
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    getFirebaseServices().auth.currentUser?.getIdTokenResult(true)
      .then(result => { if (active) setClaims(result.claims); })
      .catch(err => { if (active) setError(err.message); });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; clearInterval(timer); };
  }, [user?.id]);

  if (user?.email !== ADMIN_EMAIL) return <p>{t('newAdmin.assigned', { email: ADMIN_EMAIL })}</p>;
  const firebaseUser = getFirebaseServices().auth.currentUser;
  const enrolled = firebaseUser && getEnrolledMfaFactors(firebaseUser).some(factor => factor.factorId === 'totp');
  const seconds = remainingSeconds(claims, now);
  const beginEnrollment = async () => {
    setBusy(true); setError('');
    try {
      await firebaseUser.reload();
      if (!firebaseUser.emailVerified) throw new Error(t('newAdmin.verifyEmail'));
      setSecret(await startTotpEnrollment(firebaseUser));
    }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const finishEnrollment = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { await completeTotpEnrollment(firebaseUser, secret, code.trim()); setSecret(null); setCode(''); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <section className="sf-new-settings-panel" aria-label={t('newAdmin.label')}>
    {seconds > 0 && isAdmin ? <><p role="timer">{t('newAdmin.remaining', { time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` })}</p><Admin /></> : <>
      <p>{t('newAdmin.requirements')}</p>
      {!firebaseUser && <p>{t('newAdmin.signIn')}</p>}
      {firebaseUser?.providerData?.every(provider => provider.providerId !== 'google.com') && <p>{t('newAdmin.connectGoogle')}</p>}
      {!enrolled && firebaseUser && <>
        {!secret ? <button type="button" disabled={busy} onClick={beginEnrollment}>{t('newAdmin.setup')}</button> : <form onSubmit={finishEnrollment}>
          <p>{t('newAdmin.addKey')}</p>
          <code style={{ overflowWrap: 'anywhere' }}>{secret.secretKey}</code>
          <p><a href={secret.generateQrCodeUrl(user.email, 'SpotFinder')}>{t('newAdmin.setupLink')}</a></p>
          <label>{t('newAdmin.code')} <input value={code} onChange={event => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" required /></label>
          <button type="submit" disabled={busy || !code.trim()}>{t('newAdmin.enable')}</button>
        </form>}
      </>}
      {enrolled && <p>{t('newAdmin.newSession')}</p>}
      {enrolled && <button type="button" onClick={() => logout()}>{t('newAdmin.signOut')}</button>}
      {!isAdmin && <p>{t('newAdmin.noClaim')}</p>}
      {error && <p role="alert">{error}</p>}
    </>}
  </section>;
}
