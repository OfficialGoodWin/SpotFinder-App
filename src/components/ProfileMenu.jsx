import React from 'react';
import { FilePenLine, LogOut, List, Trash2, User } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function ProfileMenu({ user, isAuthenticated, showMenu, onToggleMenu, onShowMySpots, onShowDrafts, guestDraftCount = 0, onSignOut, onShowDeleteConfirm, onShowAuth }) {
  const { t } = useLanguage();
  return (
    <div className="absolute right-4 z-[1003]" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
      {isAuthenticated && user ? (
        <>
          <button onClick={onToggleMenu}
            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-card shadow-md transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-ring dark:border-border"
            title={t('profile.account')} aria-label={t('profile.account')} aria-haspopup="menu" aria-expanded={showMenu}>
            {user.photoURL
              ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
              : <span className="text-sm font-bold text-primary">{user.displayName?.[0] || user.email?.[0] || '?'}</span>}
          </button>
          {showMenu && (
            <div className="sf-menu-motion absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-card/95 py-1.5 shadow-xl backdrop-blur-xl" role="menu" aria-label={t('profile.account')}>
              <div className="px-4 py-2 border-b border-gray-100 dark:border-border">
                <p className="text-xs font-semibold text-foreground truncate">{user.displayName || user.email}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              <button onClick={() => { onShowMySpots(); onToggleMenu(); }}
                role="menuitem" className="flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                <List className="w-4 h-4" /> {t('profile.mySpots')}
              </button>
              <button onClick={() => { onSignOut(); onToggleMenu(); }}
                role="menuitem" className="flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                <LogOut className="w-4 h-4" /> {t('profile.signOut')}
              </button>
              <div className="border-t border-gray-100 dark:border-border mt-1 pt-1">
                <button onClick={() => { onShowDeleteConfirm(); onToggleMenu(); }}
                  role="menuitem" className="flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none dark:text-red-300 dark:hover:bg-red-950/30">
                  <Trash2 className="w-4 h-4" /> {t('profile.deleteAccount')}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <button onClick={onShowAuth} className="w-10 h-10 rounded-full shadow-lg border border-gray-200 dark:border-border bg-white dark:bg-card flex items-center justify-center active:scale-95 transition-transform" title={t('profile.signIn')} aria-label={t('profile.signIn')}><User className="w-5 h-5 text-gray-500 dark:text-muted-foreground" /></button>
          <button onClick={onShowDrafts} className="relative w-10 h-10 rounded-full shadow-lg border border-gray-200 dark:border-border bg-white dark:bg-card flex items-center justify-center active:scale-95 transition-transform" title="Drafts" aria-label={`Drafts${guestDraftCount ? `, ${guestDraftCount} saved` : ''}`}><FilePenLine className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />{guestDraftCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-green-600 px-1 text-[10px] font-bold text-white">{guestDraftCount}</span>}</button>
        </div>
      )}
    </div>
  );
}
