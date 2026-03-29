import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, ArrowRight, ExternalLink } from 'lucide-react';
import { loginWithEmail, registerWithEmail, loginWithGoogle, isRestrictedBrowser } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';

// Client-side brute-force protection: track failed attempts per session
const loginAttempts = { count: 0, lockedUntil: 0 };
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function AuthModal({ onClose, onSuccess = () => {} }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restricted, setRestricted] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const { checkUserAuth } = useAuth();

  useEffect(() => { setRestricted(isRestrictedBrowser()); }, []);

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

    // Check lockout
    if (Date.now() < loginAttempts.lockedUntil) {
      const remaining = Math.ceil((loginAttempts.lockedUntil - Date.now()) / 1000);
      setLockoutRemaining(remaining);
      setError(`Too many failed attempts. Please wait ${remaining}s before trying again.`);
      return;
    }

    setLoading(true); setError('');
    try {
      tab === 'login' ? await loginWithEmail(email, password) : await registerWithEmail(email, password);
      // Reset attempts on success
      loginAttempts.count = 0;
      loginAttempts.lockedUntil = 0;
      await checkUserAuth(); onSuccess(); onClose();
    } catch (err) {
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
        setError(codes[err.code] || err.message || t('auth.somethingWrong'));
      } else {
        const codes = {
          'auth/invalid-email': t('auth.invalidEmail'),
          'auth/email-already-in-use': t('auth.emailInUse'),
          'auth/weak-password': t('auth.weakPassword'),
        };
        setError(codes[err.code] || err.message || t('auth.somethingWrong'));
      }
    } finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    if (restricted) { window.open(window.location.href, '_blank'); return; }
    setLoading(true); setError('');
    try {
      await loginWithGoogle(); await checkUserAuth(); onSuccess(); onClose();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user')
        setError(err.message || t('auth.failedGoogle'));
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-card w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-100 dark:bg-accent flex items-center justify-center">
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-foreground">
            {tab === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
          </h2>
          <p className="text-gray-500 dark:text-muted-foreground mt-2 text-sm">
            {tab === 'login' ? t('auth.signInSubtitle') : t('auth.registerSubtitle')}
          </p>
        </div>

        {restricted && (
          <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl">
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
              className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-colors ${tab===v ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-accent text-gray-600 dark:text-muted-foreground hover:bg-gray-200'}`}>
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
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-background border border-gray-200 dark:border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-foreground placeholder:text-gray-400" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5">{t('auth.email')}</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} required
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-background border border-gray-200 dark:border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-foreground placeholder:text-gray-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5">{t('auth.password')}</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6}
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-background border border-gray-200 dark:border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-foreground" />
            </div>
          </div>
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl"><p className="text-sm text-red-600 dark:text-red-400">{error}</p></div>}
          {lockoutRemaining > 0 && (
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl">
              <p className="text-sm text-orange-700 dark:text-orange-300 font-semibold">🔒 Locked — try again in {lockoutRemaining}s</p>
            </div>
          )}
          <button type="submit" disabled={loading || lockoutRemaining > 0}
            className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <>{tab === 'login' ? t('auth.signIn') : t('auth.createAccount')}<ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>
        <button onClick={onClose}
          className="w-full mt-4 py-3 text-gray-500 dark:text-muted-foreground font-medium hover:bg-gray-50 dark:hover:bg-accent transition-colors rounded-2xl text-sm">
          {t('auth.continueAsGuest')}
        </button>
      </div>
    </div>
  );
}
