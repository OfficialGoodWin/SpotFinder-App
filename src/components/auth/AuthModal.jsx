import React, { useState, useEffect, useRef } from 'react';
import { X, Mail, Lock, User, ArrowRight, ExternalLink, Smartphone, CalendarDays, Eye, EyeOff } from 'lucide-react';
import { loginWithEmail, registerWithEmail, loginWithGoogle, isRestrictedBrowser, getMfaResolverFromError, getMfaRecaptchaVerifier, clearMfaRecaptchaVerifier, startMfaSignIn, completeMfaSignIn } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import { accountBirthDateBounds } from '@/lib/ageEligibility';

// Client-side brute-force protection: track failed attempts per session
const loginAttempts = { count: 0, lockedUntil: 0 };
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function AuthModal({ onClose, onSuccess = () => {} }) {
  const { t, language } = useLanguage();
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restricted, setRestricted] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { checkUserAuth } = useAuth();
  const birthDateBounds = accountBirthDateBounds();
  const modalRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const dateExample = new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(Date.UTC(2000, 9, 12)));

  // ── MFA challenge state (only used when the account has a second factor) ──
  const [mfaResolver, setMfaResolver] = useState(null);
  const [mfaVerificationId, setMfaVerificationId] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSending, setMfaSending] = useState(false);

  useEffect(() => { setRestricted(isRestrictedBrowser()); }, []);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const modal = modalRef.current;
    requestAnimationFrame(() => modal?.querySelector('input, button')?.focus());
    const handleKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab' || !modal) return;
      const focusable = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]')];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); previousFocus?.focus?.(); };
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockoutRemaining) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((loginAttempts.lockedUntil - Date.now()) / 1000));
      setLockoutRemaining(remaining);
      if (!remaining) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [lockoutRemaining]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (tab === 'register' && !agreedToTerms) {
      setError(t('auth.mustAgreeToTerms'));
      return;
    }

    // Check lockout
    if (Date.now() < loginAttempts.lockedUntil) {
      const remaining = Math.ceil((loginAttempts.lockedUntil - Date.now()) / 1000);
      setLockoutRemaining(remaining);
      setError(`Too many failed attempts. Please wait ${remaining}s before trying again.`);
      return;
    }

    setLoading(true); setError('');
    try {
      tab === 'login' ? await loginWithEmail(email, password) : await registerWithEmail(email, password, dateOfBirth, name);
      // Reset attempts on success
      loginAttempts.count = 0;
      loginAttempts.lockedUntil = 0;
      await checkUserAuth(); onSuccess(); onClose();
    } catch (err) {
      // Account has a second factor enrolled — this isn't a failed login,
      // switch to the SMS-code challenge screen instead of showing an error.
      if (err.code === 'auth/multi-factor-auth-required') {
        setMfaResolver(getMfaResolverFromError(err));
        setLoading(false);
        return;
      }
      // Track failed login attempts (only for login tab, not registration)
      if (tab === 'login') {
        loginAttempts.count += 1;
        if (loginAttempts.count >= MAX_ATTEMPTS) {
          loginAttempts.lockedUntil = Date.now() + LOCKOUT_MS;
          const remaining = Math.ceil(LOCKOUT_MS / 1000);
          setLockoutRemaining(remaining);
          setError(`Too many failed attempts. Account temporarily locked for ${Math.round(LOCKOUT_MS / 60000)} minutes.`);
          setLoading(false);
          return;
        }
        const attemptsLeft = MAX_ATTEMPTS - loginAttempts.count;
        const codes = {
          'auth/invalid-email': t('auth.invalidEmail'),
          'auth/user-not-found': t('auth.userNotFound'),
          'auth/wrong-password': `${t('auth.wrongPassword')} (${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} left)`,
          'auth/email-already-in-use': t('auth.emailInUse'),
          'auth/weak-password': t('auth.weakPassword'),
          'auth/invalid-credential': `${t('auth.invalidCredential')} (${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} left)`,
          'auth/too-many-requests': 'Too many requests. Your account has been temporarily locked by the server. Try again later.',
        };
        setError(codes[err.code] || t('auth.somethingWrong'));
      } else {
        const codes = {
          'auth/invalid-email': t('auth.invalidEmail'),
          'auth/email-already-in-use': t('auth.emailInUse'),
          'auth/weak-password': t('auth.weakPassword'),
        };
        setError(codes[err.code] || t('auth.somethingWrong'));
      }
    } finally { setLoading(false); }
  };

  const handleSendMfaCode = async () => {
    if (!mfaResolver) return;
    setMfaSending(true); setError('');
    try {
      const verifier = getMfaRecaptchaVerifier('mfa-recaptcha-container');
      const id = await startMfaSignIn(mfaResolver, 0, verifier);
      setMfaVerificationId(id);
    } catch (err) {
      setError(t('auth.somethingWrong'));
    } finally { setMfaSending(false); }
  };

  const handleVerifyMfaCode = async (e) => {
    e.preventDefault();
    if (!mfaVerificationId || !mfaCode.trim()) return;
    setLoading(true); setError('');
    try {
      await completeMfaSignIn(mfaResolver, mfaVerificationId, mfaCode.trim());
      clearMfaRecaptchaVerifier();
      setMfaResolver(null); setMfaVerificationId(null); setMfaCode('');
      await checkUserAuth(); onSuccess(); onClose();
    } catch (err) {
      setError(t('auth.somethingWrong'));
    } finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    if (restricted) { window.open(window.location.href, '_blank'); return; }
    setLoading(true); setError('');
    try {
      await loginWithGoogle(); await checkUserAuth(); onSuccess(); onClose();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user')
        setError(t('auth.failedGoogle'));
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={modalRef} className="sf-sheet relative max-h-[96dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl p-5 sm:max-w-md sm:rounded-3xl sm:p-7" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <button onClick={onClose} aria-label={t('common.close')} className="sf-icon-button absolute right-3 top-3">
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 id="auth-modal-title" className="text-2xl font-bold tracking-tight text-gray-900 dark:text-foreground">
            {tab === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
          </h2>
          <p className="text-gray-500 dark:text-muted-foreground mt-2 text-sm">
            {tab === 'login' ? t('auth.signInSubtitle') : t('auth.registerSubtitle')}
          </p>
        </div>

        {mfaResolver ? (
          <div className="space-y-4">
            <div className="sf-status-warning flex items-start gap-3 p-4">
              <Smartphone className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Two-factor verification</p>
                <p className="mt-0.5 text-xs">
                  {mfaResolver.hints[0]?.phoneNumber ? `Code sent to ${mfaResolver.hints[0].phoneNumber}` : 'This account requires a verification code.'}
                </p>
              </div>
            </div>
            <div id="mfa-recaptcha-container" />
            {!mfaVerificationId ? (
              <button onClick={handleSendMfaCode} disabled={mfaSending}
                className="sf-button-primary w-full">
                {mfaSending ? 'Sending…' : 'Send verification code'}
              </button>
            ) : (
              <form onSubmit={handleVerifyMfaCode} className="space-y-4">
                <input
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value)}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  autoFocus
                  className="w-full px-4 py-3.5 bg-gray-50 dark:bg-background border border-gray-200 dark:border-border rounded-2xl text-center text-lg tracking-widest"
                />
                <button type="submit" disabled={loading}
                  className="sf-button-primary w-full">
                  {loading ? 'Verifying…' : 'Verify & sign in'}
                </button>
              </form>
            )}
            {error && <div className="sf-status-error" role="alert">{error}</div>}
            <button onClick={() => { clearMfaRecaptchaVerifier(); setMfaResolver(null); setMfaVerificationId(null); setMfaCode(''); }}
              className="w-full text-sm text-gray-500 dark:text-muted-foreground underline">
              Cancel
            </button>
          </div>
        ) : (
        <>
        {restricted && (
          <div className="sf-status-warning mb-4 p-4">
            <p className="text-sm text-amber-800 dark:text-amber-300 font-semibold mb-1">⚠️ {t('auth.inAppBrowserTitle')}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">{t('auth.inAppBrowserBody')}</p>
            <a href={window.location.href} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300 underline">
              <ExternalLink className="w-3.5 h-3.5" /> {t('auth.openInBrowser')}
            </a>
          </div>
        )}

        <button onClick={handleGoogleLogin} disabled={loading}
          className={`w-full py-3.5 px-4 border-2 font-semibold rounded-2xl transition-all flex items-center justify-center gap-3 mb-4 disabled:opacity-50 ${
            restricted ? 'bg-gray-100 dark:bg-accent border-gray-300 text-gray-400 cursor-not-allowed'
              : 'bg-white dark:bg-accent border-gray-200 dark:border-border hover:bg-gray-50 text-gray-700 dark:text-foreground'}`}>
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {restricted ? t('auth.googleDisabled') : t('auth.continueWithGoogle')}
        </button>

        <div className="flex items-center gap-4 my-4">
          <div className="flex-1 h-px bg-gray-200 dark:bg-border" />
          <span className="text-gray-400 dark:text-muted-foreground text-sm">{t('common.or')}</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-border" />
        </div>

        <div className="flex gap-2 mb-4">
          {['login','register'].map(v => (
            <button key={v} onClick={() => { setTab(v); setError(''); }}
              aria-pressed={tab === v}
              className={`min-h-11 flex-1 rounded-xl font-semibold text-sm transition-colors ${tab===v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              {v === 'login' ? t('auth.signIn') : t('auth.signUp')}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5">{t('auth.name')}</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('auth.namePlaceholder')}
                  autoComplete="name" className="sf-control w-full pl-12 pr-4" />
              </div>
            </div>
          )}
          {tab === 'register' && (
            <div>
              <label htmlFor="auth-date-of-birth" className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5">Date of birth</label>
              <div className="relative">
                <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <input id="auth-date-of-birth" type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} required min={birthDateBounds.min} max={birthDateBounds.max}
                  className="sf-control w-full pl-12 pr-4" />
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-muted-foreground">Use your local date format (for example, {dateExample}). You must be at least 16; this stays private.</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5">{t('auth.email')}</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} required
                autoComplete="email" inputMode="email" className="sf-control w-full pl-12 pr-4" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5">{t('auth.password')}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                className="sf-control w-full pl-12 pr-12" />
              <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
          {error && <div className="sf-status-error" role="alert">{error}</div>}
          {lockoutRemaining > 0 && (
            <div className="sf-status-warning" role="status">
              <p className="text-sm font-semibold">🔒 Locked — try again in {lockoutRemaining}s</p>
            </div>
          )}
          {tab === 'register' && (
            <div className="flex items-start gap-2.5">
              <input
                id="auth-agree-terms"
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 accent-green-700 focus:ring-2 focus:ring-ring"
              />
              <label htmlFor="auth-agree-terms" className="text-xs text-gray-600 dark:text-muted-foreground leading-snug">
                {t('auth.agreeToTermsPrefix')}{' '}
                <a href="/TermsAndConditions" target="_blank" rel="noopener noreferrer" className="underline font-medium text-gray-800 dark:text-foreground">
                  {t('auth.termsLinkLabel')}
                </a>{' '}
                {t('common.and')}{' '}
                <a href="/PrivacyPolicy" target="_blank" rel="noopener noreferrer" className="underline font-medium text-gray-800 dark:text-foreground">
                  {t('auth.privacyLinkLabel')}
                </a>.
              </label>
            </div>
          )}
          <button type="submit" disabled={loading || lockoutRemaining > 0 || (tab === 'register' && !agreedToTerms)}
            className="sf-button-primary flex w-full items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <>{tab === 'login' ? t('auth.signIn') : t('auth.createAccount')}<ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>
        <button onClick={onClose}
          className="w-full mt-4 py-3 text-gray-500 dark:text-muted-foreground font-medium hover:bg-gray-50 dark:hover:bg-accent transition-colors rounded-2xl text-sm">
          {t('auth.continueAsGuest')}
        </button>
        </>
        )}
      </div>
    </div>
  );
}
