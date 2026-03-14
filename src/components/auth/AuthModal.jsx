import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, ArrowRight, ExternalLink } from 'lucide-react';
import { loginWithEmail, registerWithEmail, loginWithGoogle, isRestrictedBrowser } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';

export default function AuthModal({ onClose, onSuccess = () => {} }) {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restricted, setRestricted] = useState(false);
  const { checkUserAuth } = useAuth();

  useEffect(() => {
    setRestricted(isRestrictedBrowser());
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (tab === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
      await checkUserAuth();
      onSuccess();
      onClose();
    } catch (err) {
      const codes = {
        'auth/invalid-email': 'Invalid email address',
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/email-already-in-use': 'An account with this email already exists',
        'auth/weak-password': 'Password should be at least 6 characters',
        'auth/invalid-credential': 'Invalid email or password',
      };
      setError(codes[err.code] || err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (restricted) {
      // Open in system browser
      window.open(window.location.href, '_system') || window.open(window.location.href, '_blank');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await loginWithGoogle(); // may trigger redirect (returns null)
      await checkUserAuth();
      onSuccess();
      onClose();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-card w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-100 dark:bg-accent hover:bg-gray-200 dark:hover:bg-border transition-colors flex items-center justify-center"
        >
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
            {tab === 'login' ? 'Welcome Back!' : 'Create Account'}
          </h2>
          <p className="text-gray-500 dark:text-muted-foreground mt-2 text-sm">
            {tab === 'login'
              ? 'Sign in to save spots and track your discoveries'
              : 'Join SpotFinder to save and rate your favorite spots'}
          </p>
        </div>

        {/* WebView / TikTok warning */}
        {restricted && (
          <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl">
            <p className="text-sm text-amber-800 dark:text-amber-300 font-semibold mb-1">⚠️ In-app browser detected</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
              Google Sign-In doesn't work inside TikTok or Instagram. Tap below to open SpotFinder in your browser, or use email/password instead.
            </p>
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300 underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in Browser
            </a>
          </div>
        )}

        {/* Google Sign In */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className={`w-full py-3.5 px-4 border-2 font-semibold rounded-2xl transition-all flex items-center justify-center gap-3 mb-4 disabled:opacity-50 ${
            restricted
              ? 'bg-gray-100 dark:bg-accent border-gray-300 dark:border-border text-gray-400 cursor-not-allowed'
              : 'bg-white dark:bg-accent border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-border text-gray-700 dark:text-foreground'
          }`}
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {restricted ? 'Google (use browser instead)' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-4 my-4">
          <div className="flex-1 h-px bg-gray-200 dark:bg-border" />
          <span className="text-gray-400 dark:text-muted-foreground text-sm">or</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-border" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {['login', 'register'].map(t2 => (
            <button
              key={t2}
              onClick={() => { setTab(t2); setError(''); }}
              className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-colors ${
                tab === t2
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-accent text-gray-600 dark:text-muted-foreground hover:bg-gray-200'
              }`}
            >
              {t2 === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5">Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-background border border-gray-200 dark:border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-foreground placeholder:text-gray-400" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-background border border-gray-200 dark:border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-foreground placeholder:text-gray-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6}
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-background border border-gray-200 dark:border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-foreground" />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            {loading
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <>{tab === 'login' ? 'Sign In' : 'Create Account'}<ArrowRight className="w-5 h-5" /></>
            }
          </button>
        </form>

        <button onClick={onClose}
          className="w-full mt-4 py-3 text-gray-500 dark:text-muted-foreground font-medium hover:bg-gray-50 dark:hover:bg-accent transition-colors rounded-2xl text-sm">
          Continue as Guest
        </button>
      </div>
    </div>
  );
}
