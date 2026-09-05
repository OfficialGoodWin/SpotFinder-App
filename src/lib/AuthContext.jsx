import React, { createContext, useState, useContext, useEffect } from 'react';
import { getFirebaseServices, onAuthChange, handleGoogleRedirectResult, ensureAnonymousSession } from '@/api/firebaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    // Set up Firebase auth state listener
    checkAppState();
    
    // Handle redirect result from Google OAuth (TikTok/WebView flow)
    handleGoogleRedirectResult().then(redirectUser => {
      if (redirectUser) console.log('Google redirect sign-in succeeded:', redirectUser.email);
    }).catch(e => console.warn('Redirect result:', e));

    try {
      // Listen for auth state changes
      const { auth } = getFirebaseServices();
      const unsubscribe = onAuthChange((firebaseUser) => {
        try {
          if (firebaseUser) {
            const anonymous = firebaseUser.isAnonymous === true;
            setIsAnonymous(anonymous);
            if (anonymous) {
              setUser(null);
              setIsAuthenticated(false);
            } else {
              const displayName = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User');
              setUser({
                email: firebaseUser.email,
                id: firebaseUser.uid,
                displayName: displayName,
                photoURL: firebaseUser.photoURL,
                emailVerified: firebaseUser.emailVerified
              });
              setIsAuthenticated(true);
            }
          } else {
            setUser(null);
            setIsAuthenticated(false);
            setIsAnonymous(false);
            // Only start an anonymous guest session once we know for sure
            // there's no real signed-in user — checking this here (instead
            // of at mount) avoids a race where a persisted real login is
            // still being restored and gets silently overwritten by an
            // anonymous session.
            ensureAnonymousSession().catch((e) => console.warn('Anonymous guest session:', e));
          }
        } catch (err) {
          console.error('Error in auth state callback:', err);
          setIsAuthenticated(false);
        }
        setIsLoadingAuth(false);
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    } catch (err) {
      console.error('Firebase initialization error:', err);
      setIsLoadingAuth(false);
    }
  }, []);

  const checkAppState = async () => {
    try {
      // No need to check app public settings from base44 anymore
      // Just allow guest browsing by default
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('App state check failed:', error);
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    // This is now handled by the onAuthChange listener
    setIsLoadingAuth(true);
    try {
      const { auth } = getFirebaseServices();
      const firebaseUser = auth.currentUser;
      if (firebaseUser && !firebaseUser.isAnonymous) {
        setIsAnonymous(false);
        setUser({
          email: firebaseUser.email,
          id: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified
        });
        setIsAuthenticated(true);
      } else if (firebaseUser?.isAnonymous) {
        setUser(null);
        setIsAuthenticated(false);
        setIsAnonymous(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsAnonymous(false);
      }
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // Force-reloads the Firebase user (picks up emailVerified changes made in
  // another tab) and force-refreshes the ID token, since Firestore rules
  // read `email_verified` from the cached token, not live from the server.
  const refreshUser = async () => {
    try {
      const { auth } = getFirebaseServices();
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;
      await firebaseUser.reload();
      await firebaseUser.getIdToken(true);
      if (firebaseUser.isAnonymous) {
        setUser(null);
        setIsAuthenticated(false);
        setIsAnonymous(true);
        return;
      }
      setIsAnonymous(false);
      setUser({
        email: firebaseUser.email,
        id: firebaseUser.uid,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
        photoURL: firebaseUser.photoURL,
        emailVerified: firebaseUser.emailVerified
      });
    } catch (error) {
      console.error('User refresh failed:', error);
    }
  };

  useEffect(() => {
    const onFocus = () => { refreshUser(); };
    window.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const logout = async (shouldRedirect = true) => {
    try {
      const { logout } = await import('@/api/firebaseClient');
      await logout();
      setUser(null);
      setIsAuthenticated(false);
      
      if (shouldRedirect) {
        window.location.href = window.location.href;
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if logout fails
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const navigateToLogin = () => {
    // This will be handled by the AuthModal component
    // The login will be triggered by opening the auth modal
    console.log('Navigate to login - open auth modal instead');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
      checkUserAuth,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};