import React from 'react';
import { LogOut, List, Trash2, User, Crown } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function ProfileMenu({ user, isAuthenticated, showMenu, onToggleMenu, onShowMySpots, onSignOut, onShowDeleteConfirm, onShowAuth, onShowSubscription, isSuperAdmin }) {
  const { t } = useLanguage();
  return (
    <div className="absolute top-4 right-4 z-[1003] flex flex-col items-end gap-1.5">
      {isAuthenticated && user ? (
        <>
          <button onClick={onToggleMenu}
            className="w-10 h-10 rounded-full shadow-lg border-2 border-white dark:border-border overflow-hidden bg-muted flex items-center justify-center active:scale-95 transition-transform"
            title={t('profile.account')}>
            {user.photoURL
              ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
              : <span className="text-sm font-bold text-blue-500">{user.displayName?.[0] || user.email?.[0] || '?'}</span>}
          </button>
          {/* Go Elite button — hidden for superadmin (already has everything) */}
          {!isSuperAdmin && (
            <button
              onClick={() => { onShowSubscription?.(); }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white shadow-lg active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #4c1d95 60%, #7c3aed 100%)' }}
              title="SpotFinder Elite / Ultra"
            >
              <Crown className="w-3.5 h-3.5" />
              Go Elite
            </button>
          )}
          {showMenu && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-card rounded-2xl shadow-2xl border border-gray-100 dark:border-border py-1.5 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-border">
                <p className="text-xs font-semibold text-foreground truncate">{user.displayName || user.email}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              {!isSuperAdmin && (
                <button onClick={() => { onShowSubscription?.(); onToggleMenu(); }}
                  className="w-full px-4 py-2.5 text-left text-sm font-semibold flex items-center gap-2.5 transition-colors"
                  style={{ background: 'linear-gradient(135deg,#6d28d9,#4c1d95)', color: '#fff', borderRadius: 0 }}>
                  <Crown className="w-4 h-4" /> Go Elite
                </button>
              )}
              <button onClick={() => { onShowMySpots(); onToggleMenu(); }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-accent flex items-center gap-2.5 transition-colors">
                <List className="w-4 h-4" /> {t('profile.mySpots')}
              </button>
              <button onClick={() => { onSignOut(); onToggleMenu(); }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-accent flex items-center gap-2.5 transition-colors">
                <LogOut className="w-4 h-4" /> {t('profile.signOut')}
              </button>
              <div className="border-t border-gray-100 dark:border-border mt-1 pt-1">
                <button onClick={() => { onShowDeleteConfirm(); onToggleMenu(); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2.5 transition-colors">
                  <Trash2 className="w-4 h-4" /> {t('profile.deleteAccount')}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <button onClick={onShowAuth}
          className="w-10 h-10 rounded-full shadow-lg border border-gray-200 dark:border-border bg-white dark:bg-card flex items-center justify-center active:scale-95 transition-transform"
          title={t('profile.signIn')}>
          <User className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
