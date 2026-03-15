import React from 'react';
import { X, Moon, Globe } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { LANGUAGES } from '@/locales/translations';

export default function SettingsModal({ onClose }) {
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="fixed inset-0 z-[2000] flex items-end pointer-events-none">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      <div className="relative w-full bg-background text-foreground rounded-t-3xl shadow-2xl p-6 pointer-events-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{t('settings.title')}</h2>
          <button
            onClick={onClose}
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
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.nativeName}</option>
              ))}
            </select>
          </div>

          <p className="text-sm text-muted-foreground text-center pt-2">{t('settings.prefSaved')}</p>
        </div>
      </div>
    </div>
  );
}
