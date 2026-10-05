import { useState } from 'react';
import { CheckCircle2, KeyRound, LogOut, ShieldAlert } from 'lucide-react';
import {
  changeAccountPassword,
  getFirebaseServices,
  requestAccountEmailChange,
  resendVerificationEmail,
} from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';

export default function AccountSecuritySection() {
  const { logout } = useAuth();
  const firebaseUser = getFirebaseServices().auth.currentUser;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!firebaseUser || firebaseUser.isAnonymous) return null;
  const supportsPassword = firebaseUser.providerData.some(provider => provider.providerId === 'password');

  const run = async (kind, action, success) => {
    if (busy) return;
    setBusy(kind); setError(''); setMessage('');
    try {
      await action();
      setMessage(success);
      setCurrentPassword('');
      if (kind === 'password') setNewPassword('');
      if (kind === 'email') setNewEmail('');
    } catch (caught) {
      const code = caught?.code || '';
      setError(code === 'auth/invalid-credential' || code === 'auth/wrong-password'
        ? 'Your current password is incorrect.'
        : caught?.message || 'Could not update your account.');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="p-4 bg-muted rounded-2xl" aria-labelledby="account-security-title">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4" />
        <h3 id="account-security-title" className="font-semibold text-sm">Account &amp; security</h3>
      </div>
      <div className="mt-3 rounded-xl bg-background px-3 py-2.5 flex items-center gap-2 text-sm">
        {firebaseUser.emailVerified ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <ShieldAlert className="w-4 h-4 text-amber-500" />}
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{firebaseUser.email}</p><p className="text-xs text-muted-foreground">{firebaseUser.emailVerified ? 'Email verified' : 'Email verification required'}</p></div>
        {!firebaseUser.emailVerified && <button disabled={Boolean(busy)} onClick={() => run('verify', resendVerificationEmail, 'Verification email sent.')} className="text-xs font-semibold text-blue-600 min-h-10 px-2">Resend</button>}
      </div>

      {supportsPassword ? (
        <div className="mt-3 space-y-2">
          <label className="block"><span className="text-xs text-muted-foreground">Current password</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl border border-border bg-background" /></label>
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <label><span className="text-xs text-muted-foreground">New password</span><input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl border border-border bg-background" /></label>
            <button disabled={!currentPassword || newPassword.length < 8 || Boolean(busy)} onClick={() => run('password', () => changeAccountPassword(currentPassword, newPassword), 'Password changed.')} className="sm:self-end min-h-11 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40">{busy === 'password' ? 'Updating…' : 'Change password'}</button>
          </div>
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <label><span className="text-xs text-muted-foreground">New email</span><input type="email" autoComplete="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} className="mt-1 w-full h-11 px-3 rounded-xl border border-border bg-background" /></label>
            <button disabled={!currentPassword || !newEmail || Boolean(busy)} onClick={() => run('email', () => requestAccountEmailChange(currentPassword, newEmail), 'Check your new email address to confirm the change.')} className="sm:self-end min-h-11 px-4 rounded-xl border border-border text-sm font-semibold disabled:opacity-40">{busy === 'email' ? 'Sending…' : 'Change email'}</button>
          </div>
          <p className="text-xs text-muted-foreground">Password and email changes require your current password. Email changes complete only after you follow the verification link.</p>
        </div>
      ) : <p className="mt-3 text-xs text-muted-foreground">Password and email are managed by your sign-in provider.</p>}

      {message && <p className="mt-3 text-xs text-green-600" role="status">{message}</p>}
      {error && <p className="mt-3 text-xs text-red-600" role="alert">{error}</p>}
      <button onClick={() => logout()} className="mt-4 min-h-11 w-full rounded-xl border border-red-200 dark:border-red-900 text-red-600 font-semibold text-sm flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-red-500"><LogOut className="w-4 h-4" />Sign out</button>
    </section>
  );
}
