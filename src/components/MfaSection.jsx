import { useEffect, useState } from 'react';
import { ShieldCheck, Smartphone } from 'lucide-react';
import {
  getFirebaseServices, getMfaRecaptchaVerifier, clearMfaRecaptchaVerifier,
  startMfaEnrollment, completeMfaEnrollment, getEnrolledMfaFactors, unenrollMfaFactor,
} from '@/api/firebaseClient';

// Requires the project be upgraded to Identity Platform with SMS MFA turned
// on in the Firebase console, and the signed-in user's email verified —
// Firebase itself blocks enrollment otherwise.
export default function MfaSection() {
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
    if (!phone.trim()) return;
    setBusy(true); setError('');
    try {
      const verifier = getMfaRecaptchaVerifier('mfa-enroll-recaptcha');
      const id = await startMfaEnrollment(user, phone.trim(), verifier);
      setVerificationId(id);
    } catch (err) {
      setError(err.message === 'auth/unverified-email'
        ? 'Verify your email address before adding two-factor authentication.'
        : err.message || 'Could not send code.');
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
      setError(err.message || 'Verification failed.');
    } finally { setBusy(false); }
  };

  const handleRemove = async (uid) => {
    setBusy(true);
    try {
      await unenrollMfaFactor(user, uid);
      setFactors(getEnrolledMfaFactors(user));
    } catch (err) {
      setError(err.message || 'Could not remove.');
    } finally { setBusy(false); }
  };

  return (
    <div className="p-4 bg-muted rounded-2xl">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-4 h-4" />
        <span className="font-semibold text-sm">Two-factor authentication</span>
      </div>

      {factors.length > 0 && (
        <div className="space-y-2 mb-3">
          {factors.map(f => (
            <div key={f.uid} className="flex items-center justify-between text-sm bg-background rounded-xl px-3 py-2">
              <span className="flex items-center gap-2"><Smartphone className="w-4 h-4" />{f.displayName || f.phoneNumber}</span>
              <button disabled={busy} onClick={() => handleRemove(f.uid)} className="text-xs text-red-500 underline disabled:opacity-40">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div id="mfa-enroll-recaptcha" />

      {!verificationId ? (
        <div className="flex gap-2">
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+1 555 555 5555"
            className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm"
          />
          <button disabled={busy} onClick={handleSendCode} className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm disabled:opacity-40">
            Send code
          </button>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="flex gap-2">
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="6-digit code"
            inputMode="numeric"
            className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm"
          />
          <button disabled={busy} className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm disabled:opacity-40">
            Confirm
          </button>
        </form>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      <p className="text-xs text-muted-foreground mt-2">
        Adds a text-message code requirement on top of your password when signing in.
      </p>
    </div>
  );
}
