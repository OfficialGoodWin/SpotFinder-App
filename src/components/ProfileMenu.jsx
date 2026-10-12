import React from 'react';
import { FilePenLine, LogOut, MapPinned, Settings, Trash2, User, Library } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function ProfileMenu({ user, isAuthenticated, showMenu, onToggleMenu, onShowMySpots, onShowDrafts, onShowNearby, onShowSettings, guestDraftCount = 0, onSignOut, onShowDeleteConfirm, onShowAuth }) {
  const { t } = useLanguage();
  const menuRef = React.useRef(null);
  const toggleRef = React.useRef(onToggleMenu);
  React.useEffect(() => { toggleRef.current = onToggleMenu; }, [onToggleMenu]);
  React.useEffect(() => {
    if (!showMenu) return undefined;
    const menu = menuRef.current;
    requestAnimationFrame(() => menu?.querySelector('[role="menuitem"]')?.focus());
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); toggleRef.current(); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = [...(menu?.querySelectorAll('[role="menuitem"]') || [])];
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [showMenu]);
  const run = action => { onToggleMenu(); action?.(); };
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
            <div ref={menuRef} className="sf-menu-motion absolute right-0 top-full mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur-xl" role="menu" aria-label={t('profile.account')}>
              <div className="flex items-center gap-3 border-b border-border px-3 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 font-bold text-primary">{user.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" /> : user.displayName?.[0] || user.email?.[0] || '?'}</span>
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{user.displayName || user.email}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div>
              </div>
              <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Discover</p>
              <button onClick={() => run(onShowNearby)} role="menuitem" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                <MapPinned className="h-4 w-4 text-primary" /> Nearby spots
              </button>
              <button onClick={() => run(onShowMySpots)} role="menuitem" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                <Library className="h-4 w-4 text-primary" /> <span className="flex-1">My collection</span>
              </button>
              <div className="my-1 border-t border-border" />
              <button onClick={() => run(onShowSettings)} role="menuitem" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                <Settings className="h-4 w-4" /> Settings
              </button>
              <button onClick={() => run(onSignOut)} role="menuitem" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                <LogOut className="h-4 w-4" /> {t('profile.signOut')}
              </button>
              <div className="mt-1 border-t border-border pt-1">
                <button onClick={() => run(onShowDeleteConfirm)} role="menuitem" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none dark:text-red-300 dark:hover:bg-red-950/30">
                  <Trash2 className="h-4 w-4" /> {t('profile.deleteAccount')}
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
