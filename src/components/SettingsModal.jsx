import React from 'react';
import { X, Moon, Globe, Cookie, FileText, Shield, ReceiptText } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-[2000] flex items-end pointer-events-none">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      <div className="relative w-full max-h-[92dvh] overflow-y-auto bg-background text-foreground rounded-t-3xl shadow-2xl p-6 pointer-events-auto" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-2xl">
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-primary" />
              <div>
                <p className="font-semibold">{t('settings.darkMode')}</p>
                <p className="text-sm text-muted-foreground">
                  {isDark ? t('settings.enabled') : t('settings.disabled')}
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                isDark ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
                  isDark ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Language Selector */}
          <div className="p-4 bg-muted rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <Globe className="w-5 h-5 text-primary" />
              <div>
                <p className="font-semibold">{t('settings.language')}</p>
                <p className="text-sm text-muted-foreground">{t('settings.selectLanguage')}</p>
              </div>
            </div>
            <SmoothSelect value={language} onChange={setLanguage} ariaLabel={t('settings.selectLanguage')} options={LANGUAGES.map(lang => ({ value: lang.code, label: lang.nativeName }))} />
          </div>

          <AccountSecuritySection />
          <MfaSection />

          {/* Legal & privacy */}
          <div className="p-4 bg-muted rounded-2xl space-y-1">
            <p className="font-semibold mb-2 flex items-center gap-2"><Shield className="w-4 h-4 text-primary" aria-hidden="true" />Legal &amp; privacy</p>
            <button
              onClick={reopenCookieSettings}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-background/60 text-left text-sm"
            >
              <Cookie className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> Cookie preferences
            </button>
            <a href="/PrivacyPolicy" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-background/60 text-sm">
              <FileText className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> Privacy Policy
            </a>
            <a href="/TermsAndConditions" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-background/60 text-sm">
              <FileText className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> Terms &amp; Conditions
            </a>
            <a href="/CookiePolicy" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-background/60 text-sm">
              <FileText className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> Cookie Policy
            </a>
            <a href="/RefundPolicy" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-background/60 text-sm">
              <ReceiptText className="w-4 h-4 flex-shrink-0" aria-hidden="true" /> Refund Policy
            </a>
          </div>

          <p className="text-sm text-muted-foreground text-center pt-2">{t('settings.prefSaved')}</p>
        </div>
      </div>
    </div>
  );
}
