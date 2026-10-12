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
    <section className="sf-section" aria-labelledby="account-security-title">
      <div className="flex items-center gap-2 text-muted-foreground">
        <KeyRound className="w-4 h-4 text-primary" />
        <h3 id="account-security-title" className="text-sm font-bold uppercase tracking-wide">Account &amp; security</h3>
      </div>
      <div className="mt-4 rounded-xl border border-border bg-background px-3 py-2.5 flex items-center gap-2 text-sm">
        {firebaseUser.emailVerified ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <ShieldAlert className="w-4 h-4 text-amber-500" />}
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{firebaseUser.email}</p><p className="text-xs text-muted-foreground">{firebaseUser.emailVerified ? 'Email verified' : 'Email verification required'}</p></div>
        {!firebaseUser.emailVerified && <button disabled={Boolean(busy)} onClick={() => run('verify', resendVerificationEmail, 'Verification email sent.')} className="min-h-10 px-2 text-xs font-semibold text-primary">Resend</button>}
      </div>

      {supportsPassword ? (
        <div className="mt-3 space-y-2">
          <label className="block"><span className="text-xs font-medium text-muted-foreground">Current password</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="sf-control mt-1 w-full" /></label>
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <label><span className="text-xs font-medium text-muted-foreground">New password</span><input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} className="sf-control mt-1 w-full" /></label>
            <button disabled={!currentPassword || newPassword.length < 8 || Boolean(busy)} onClick={() => run('password', () => changeAccountPassword(currentPassword, newPassword), 'Password changed.')} className="sf-button-primary sm:self-end">{busy === 'password' ? 'Updating…' : 'Change password'}</button>
          </div>
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <label><span className="text-xs font-medium text-muted-foreground">New email</span><input type="email" autoComplete="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} className="sf-control mt-1 w-full" /></label>
            <button disabled={!currentPassword || !newEmail || Boolean(busy)} onClick={() => run('email', () => requestAccountEmailChange(currentPassword, newEmail), 'Check your new email address to confirm the change.')} className="sf-button-secondary sm:self-end">{busy === 'email' ? 'Sending…' : 'Change email'}</button>
          </div>
          <p className="text-xs text-muted-foreground">Password and email changes require your current password. Email changes complete only after you follow the verification link.</p>
        </div>
      ) : <p className="mt-3 text-xs text-muted-foreground">Password and email are managed by your sign-in provider.</p>}

      {message && <p className="sf-status-success mt-3" role="status">{message}</p>}
      {error && <p className="sf-status-error mt-3" role="alert">{error}</p>}
      <button onClick={() => logout()} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"><LogOut className="w-4 h-4" />Sign out</button>
    </section>
  );
}
