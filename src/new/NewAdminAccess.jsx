import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { completeTotpEnrollment, getEnrolledMfaFactors, getFirebaseServices, startTotpEnrollment } from '@/api/firebaseClient';
import Admin from '@/pages/Admin';

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

  if (user?.email !== ADMIN_EMAIL) return <p>Admin access is assigned to {ADMIN_EMAIL}.</p>;
  const firebaseUser = getFirebaseServices().auth.currentUser;
  const enrolled = firebaseUser && getEnrolledMfaFactors(firebaseUser).some(factor => factor.factorId === 'totp');
  const seconds = remainingSeconds(claims, now);
  const beginEnrollment = async () => {
    setBusy(true); setError('');
    try { setSecret(await startTotpEnrollment(firebaseUser)); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const finishEnrollment = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { await completeTotpEnrollment(firebaseUser, secret, code.trim()); setSecret(null); setCode(''); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <section className="sf-new-settings-panel" aria-label="Admin verification">
    {seconds > 0 && isAdmin ? <><p role="timer">Admin access: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} remaining</p><Admin /></> : <>
      <p>Admin access requires Google sign-in and an authenticator app. Each verified sign-in grants 30 minutes.</p>
      {!firebaseUser?.emailVerified && <p>Verify your email address before enrolling an authenticator.</p>}
      {firebaseUser?.providerData?.every(provider => provider.providerId !== 'google.com') && <p>Connect your Google account first.</p>}
      {!enrolled && firebaseUser?.emailVerified && <>
        {!secret ? <button type="button" disabled={busy} onClick={beginEnrollment}>Set up authenticator app</button> : <form onSubmit={finishEnrollment}>
          <p>Add this key to your authenticator app for SpotFinder:</p>
          <code style={{ overflowWrap: 'anywhere' }}>{secret.secretKey}</code>
          <p><a href={secret.generateQrCodeUrl(user.email, 'SpotFinder')}>Open authenticator setup link</a></p>
          <label>Authenticator code <input value={code} onChange={event => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" required /></label>
          <button type="submit" disabled={busy || !code.trim()}>Verify and enable</button>
        </form>}
      </>}
      {enrolled && <p>Sign out and sign in with Google, then enter your authenticator code to start a new 30-minute session.</p>}
      {enrolled && <button type="button" onClick={() => logout()}>Sign out to verify again</button>}
      {!isAdmin && <p>The admin claim has not been assigned to this account yet.</p>}
      {error && <p role="alert">{error}</p>}
    </>}
  </section>;
}
