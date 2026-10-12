import React from 'react';
import { X, Moon, Globe, Cookie, FileText, Shield, ReceiptText, Settings2 } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { LANGUAGES } from '@/locales/translations';
import MfaSection from '@/components/MfaSection';
import AccountSecuritySection from '@/components/AccountSecuritySection';
import { reopenCookieSettings } from '@/components/CookieConsentBanner';
import SmoothSelect from '@/components/ui/SmoothSelect';

export default function SettingsModal({ onClose }) {
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const panelRef = React.useRef(null);
  const closeRef = React.useRef(onClose);

  React.useEffect(() => { closeRef.current = onClose; }, [onClose]);
  React.useEffect(() => {
    const previousFocus = document.activeElement;
    const handleKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]')];
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    requestAnimationFrame(() => panelRef.current?.querySelector('button')?.focus());
    return () => { document.removeEventListener('keydown', handleKeyDown); previousFocus?.focus?.(); };
  }, []);

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="settings-title" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section ref={panelRef} className="sf-sheet relative flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl sm:max-h-[88dvh] sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Settings2 className="h-5 w-5" aria-hidden="true" /></span>
            <div><h2 id="settings-title" className="text-xl font-bold tracking-tight">{t('settings.title')}</h2><p className="text-sm text-muted-foreground">Preferences, privacy, and account security</p></div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="sf-icon-button"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="overflow-y-auto overscroll-contain px-4 py-5 sm:px-7" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <div className="grid gap-4 md:grid-cols-2">
          <section className="sf-section" aria-labelledby="appearance-title">
            <h3 id="appearance-title" className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">Appearance</h3>
            <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Moon className="w-5 h-5" /></span>
              <div>
                <p className="font-semibold">{t('settings.darkMode')}</p>
                <p className="text-sm text-muted-foreground">
                  {isDark ? t('settings.enabled') : t('settings.disabled')}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              aria-label={t('settings.darkMode')}
              onClick={toggleTheme}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isDark ? 'bg-primary' : 'bg-muted-foreground/35'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  isDark ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          </section>

          <section className="sf-section" aria-labelledby="language-title">
            <h3 id="language-title" className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">Language</h3>
            <div className="flex items-center gap-3 mb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Globe className="w-5 h-5" /></span>
              <div>
                <p className="font-semibold">{t('settings.language')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.selectLanguage')}</p>
              </div>
            </div>
            <SmoothSelect value={language} onChange={setLanguage} ariaLabel={t('settings.selectLanguage')} options={LANGUAGES.map(lang => ({ value: lang.code, label: lang.nativeName }))} />
          </section>

          <div className="md:col-span-2"><AccountSecuritySection /></div>
          <div className="md:col-span-2"><MfaSection /></div>

          <section className="sf-section md:col-span-2" aria-labelledby="privacy-title">
            <h3 id="privacy-title" className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground"><Shield className="w-4 h-4 text-primary" aria-hidden="true" />Privacy &amp; legal</h3>
            <div className="grid gap-1 sm:grid-cols-2">
            <button
              onClick={reopenCookieSettings}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Cookie className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> Cookie preferences
            </button>
            <a href="/PrivacyPolicy" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <FileText className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> Privacy Policy
            </a>
            <a href="/TermsAndConditions" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <FileText className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> Terms &amp; Conditions
            </a>
            <a href="/CookiePolicy" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <FileText className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> Cookie Policy
            </a>
            <a href="/RefundPolicy" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <ReceiptText className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> Refund Policy
            </a>
            </div>
          </section>

          <p className="text-sm text-muted-foreground text-center md:col-span-2 pt-1" role="status">{t('settings.prefSaved')}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
