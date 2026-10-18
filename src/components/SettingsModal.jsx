import React from 'react';
import { X, Moon, Globe, Cookie, FileText, Shield, ReceiptText, Settings2, Compass, Type, Trash2, History } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { LANGUAGES, LANGUAGE_VARIANTS } from '@/locales/translations';
import MfaSection from '@/components/MfaSection';
import AccountSecuritySection from '@/components/AccountSecuritySection';
import { reopenCookieSettings } from '@/components/CookieConsentBanner';
import SmoothSelect from '@/components/ui/SmoothSelect';
import { getTextScale, saveTextScale, TEXT_SCALE_DEFAULT, TEXT_SCALE_MAX, TEXT_SCALE_MIN } from '@/lib/textScale';
import { APP_VERSION } from '@/config/appVersion';

export default function SettingsModal({ onClose, mapExploreEnabled = true, onMapExploreEnabledChange, onRequestDeleteAccount }) {
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const selectedLanguage = [...LANGUAGES, ...LANGUAGE_VARIANTS].find(item => item.code === language);
  const panelRef = React.useRef(null);
  const closeRef = React.useRef(onClose);
  const [textScale, setTextScale] = React.useState(() => getTextScale());

  const changeTextScale = value => setTextScale(saveTextScale(value));

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
      <section ref={panelRef} className="sf-settings-panel sf-sheet relative flex max-h-[94vh] max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl sm:max-h-[88vh] sm:max-h-[88dvh] sm:rounded-3xl">
        <header className="sf-settings-header flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="sf-settings-heading-icon grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Settings2 className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0"><h2 id="settings-title" className="text-xl font-bold tracking-tight">{t('settings.title')}</h2><p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p></div>
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
            <h3 id="appearance-title" className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('settings.appearance')}</h3>
            <div className="sf-settings-row flex items-center justify-between gap-4">
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

          <section className="sf-section" aria-labelledby="map-display-title">
            <h3 id="map-display-title" className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('settings.mapDisplay')}</h3>
            <div className="sf-settings-row flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Compass className="h-5 w-5" aria-hidden="true" /></span>
                <div>
                  <p className="font-semibold">{t('settings.discoveryCard')}</p>
                  <p className="text-sm text-muted-foreground">{t('settings.discoveryCardDescription')}</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={mapExploreEnabled}
                aria-label={t('settings.discoveryCard')}
                onClick={() => onMapExploreEnabledChange?.(!mapExploreEnabled)}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${mapExploreEnabled ? 'bg-primary' : 'bg-muted-foreground/35'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${mapExploreEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Type className="h-5 w-5" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><p className="font-semibold">{t('settings.textSize')}</p><p className="text-sm text-muted-foreground">{t('settings.textSizeDescription')}</p></div>
                    <output htmlFor="text-size" className="rounded-lg bg-muted px-2 py-1 text-sm font-bold tabular-nums">{textScale}%</output>
                  </div>
                  <input id="text-size" type="range" min={TEXT_SCALE_MIN} max={TEXT_SCALE_MAX} step="5" value={textScale} onChange={event => changeTextScale(event.target.value)} className="mt-3 w-full accent-green-600" aria-label={t('settings.textSizePercentage')} />
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>{TEXT_SCALE_MIN}%</span><button type="button" onClick={() => changeTextScale(TEXT_SCALE_DEFAULT)} className="min-h-9 rounded-lg px-2 font-semibold text-primary hover:bg-primary/10">{t('settings.resetTextSize')}</button><span>{TEXT_SCALE_MAX}%</span></div>
                </div>
              </div>
            </div>
          </section>

          <section className="sf-section" aria-labelledby="language-title">
            <h3 id="language-title" className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('settings.language')}</h3>
            <div className="flex items-center gap-3 mb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Globe className="w-5 h-5" /></span>
              <div>
                <p className="font-semibold">{t('settings.language')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.selectLanguage')}</p>
              </div>
            </div>
            <SmoothSelect value={language} onChange={setLanguage} ariaLabel={t('settings.selectLanguage')} options={[...LANGUAGES, ...LANGUAGE_VARIANTS].map(lang => ({ value: lang.code, label: `${lang.flag} ${lang.nativeName}${lang.partial ? ' · Partial' : ''}` }))} />
            {selectedLanguage?.partial && <p className="mt-2 text-xs text-muted-foreground" role="status">{t('settings.partialTranslation')}</p>}
          </section>

          <div className="md:col-span-2"><AccountSecuritySection /></div>
          <div className="md:col-span-2"><MfaSection /></div>

          <section className="sf-section md:col-span-2" aria-labelledby="privacy-title">
            <h3 id="privacy-title" className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground"><Shield className="w-4 h-4 text-primary" aria-hidden="true" />{t('settings.privacyLegal')}</h3>
            <div className="grid gap-1 sm:grid-cols-2">
            <button
              onClick={reopenCookieSettings}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Cookie className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> {t('settings.cookiePreferences')}
            </button>
            <a href="/PrivacyPolicy" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <FileText className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> {t('legal.privacyTitle')}
            </a>
            <a href="/TermsAndConditions" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <FileText className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> {t('legal.termsTitle')}
            </a>
            <a href="/CookiePolicy" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <FileText className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> {t('legal.cookiesTitle')}
            </a>
            <a href="/RefundPolicy" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <ReceiptText className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> {t('legal.refundTitle')}
            </a>
            </div>
          </section>

          <section className="sf-section md:col-span-2" aria-labelledby="app-information-title">
            <h3 id="app-information-title" className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">{t('settings.appInformation')}</h3>
            <a href="/updates" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
              <History className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex-1"><span className="block font-semibold text-foreground">{t('settings.whatsNew')}</span><span className="block text-xs text-muted-foreground">{t('settings.releaseNotes')}</span></span>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">v{APP_VERSION}</span>
            </a>
          </section>

          {onRequestDeleteAccount && <section className="sf-section md:col-span-2" aria-labelledby="account-management-title">
            <h3 id="account-management-title" className="mb-2 text-sm font-bold uppercase tracking-wide text-red-700 dark:text-red-300">{t('settings.accountManagement')}</h3>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold">{t('settings.deleteAccount')}</p><p className="text-sm text-muted-foreground">{t('settings.deleteAccountDescription')}</p></div>
              <button type="button" onClick={onRequestDeleteAccount} className="sf-button-secondary shrink-0 border-red-200 text-red-700 hover:bg-red-50 focus-visible:ring-red-500 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"><Trash2 className="mr-2 inline h-4 w-4" aria-hidden="true" />{t('settings.deleteAccount')}</button>
            </div>
          </section>}

          <p className="text-sm text-muted-foreground text-center md:col-span-2 pt-1" role="status">{t('settings.prefSaved')}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
