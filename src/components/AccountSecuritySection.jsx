import { useState } from 'react';
import { CheckCircle2, KeyRound, LogOut, ShieldAlert, UserRound } from 'lucide-react';
import {
  changeAccountPassword,
  getFirebaseServices,
  requestAccountEmailChange,
  resendVerificationEmail,
  updateAccountDisplayName,
} from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';

export default function AccountSecuritySection() {
  const { logout, refreshUser } = useAuth();
  const { t } = useLanguage();
  const firebaseUser = getFirebaseServices().auth.currentUser;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [displayName, setDisplayName] = useState(firebaseUser?.displayName || '');
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
      if (kind === 'profile') await refreshUser();
    } catch (caught) {
      const code = caught?.code || '';
      setError(code === 'auth/invalid-credential' || code === 'auth/wrong-password'
        ? t('accountSecurity.incorrectPassword')
        : t('accountSecurity.updateFailed'));
    } finally {
      setBusy('');
    }
  };

  const handleSignOut = async () => {
    if (busy) return;
    setBusy('signOut'); setError(''); setMessage('');
    try { await logout(); }
    catch { setError(t('signOutFailed')); }
    finally { setBusy(''); }
  };

  return (
    <section className="sf-section" aria-labelledby="account-security-title">
      <div className="flex items-center gap-2 text-muted-foreground">
        <KeyRound className="w-4 h-4 text-primary" />
        <h3 id="account-security-title" className="text-sm font-bold uppercase tracking-wide">{t('accountSecurity.title')}</h3>
      </div>
      <div className="sf-settings-action-row mt-4 rounded-xl border border-border bg-background px-3 py-2.5 flex items-center gap-2 text-sm">
        {firebaseUser.emailVerified ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <ShieldAlert className="w-4 h-4 text-amber-500" />}
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{firebaseUser.email}</p><p className="text-xs text-muted-foreground">{t(firebaseUser.emailVerified ? 'accountSecurity.verified' : 'accountSecurity.verificationRequired')}</p></div>
        {!firebaseUser.emailVerified && <button disabled={Boolean(busy)} onClick={() => run('verify', resendVerificationEmail, 'verificationSent')} className="min-h-10 px-2 text-xs font-semibold text-primary">{t('accountSecurity.resend')}</button>}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="min-w-0">
          <span className="text-xs font-medium text-muted-foreground">{t('accountSecurity.displayName')}</span>
          <span className="relative mt-1 block">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input type="text" autoComplete="name" minLength={2} maxLength={80} value={displayName} onChange={event => setDisplayName(event.target.value)} className="sf-control w-full pl-9" />
          </span>
        </label>
        <button disabled={displayName.trim().length < 2 || displayName.trim() === firebaseUser.displayName || Boolean(busy)} onClick={() => run('profile', () => updateAccountDisplayName(displayName), 'nameUpdated')} className="sf-button-secondary sm:self-end">{t(busy === 'profile' ? 'accountSecurity.saving' : 'accountSecurity.saveName')}</button>
      </div>

      {supportsPassword ? (
        <div className="mt-3 space-y-2">
          <label className="block"><span className="text-xs font-medium text-muted-foreground">{t('accountSecurity.currentPassword')}</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="sf-control mt-1 w-full" /></label>
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <label><span className="text-xs font-medium text-muted-foreground">{t('accountSecurity.newPassword')}</span><input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} className="sf-control mt-1 w-full" /></label>
            <button disabled={!currentPassword || newPassword.length < 8 || Boolean(busy)} onClick={() => run('password', () => changeAccountPassword(currentPassword, newPassword), 'passwordChanged')} className="sf-button-primary sm:self-end">{t(busy === 'password' ? 'accountSecurity.updating' : 'accountSecurity.changePassword')}</button>
          </div>
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <label><span className="text-xs font-medium text-muted-foreground">{t('accountSecurity.newEmail')}</span><input type="email" autoComplete="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} className="sf-control mt-1 w-full" /></label>
            <button disabled={!currentPassword || !newEmail || Boolean(busy)} onClick={() => run('email', () => requestAccountEmailChange(currentPassword, newEmail), 'emailChangeSent')} className="sf-button-secondary sm:self-end">{t(busy === 'email' ? 'accountSecurity.sending' : 'accountSecurity.changeEmail')}</button>
          </div>
          <p className="text-xs text-muted-foreground">{t('accountSecurity.passwordHint')}</p>
        </div>
      ) : <p className="mt-3 text-xs text-muted-foreground">{t('accountSecurity.managedBy', { provider: firebaseUser.providerData[0]?.providerId === 'google.com' ? 'Google' : t('accountSecurity.signInProvider') })}</p>}

      {message && <p className="sf-status-success mt-3" role="status">{t(`accountSecurity.${message}`)}</p>}
      {error && <p className="sf-status-error mt-3" role="alert">{error}</p>}
      <button onClick={handleSignOut} disabled={Boolean(busy)} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30 disabled:opacity-50"><LogOut className="w-4 h-4" />{t('accountSecurity.signOut')}</button>
    </section>
  );
}
