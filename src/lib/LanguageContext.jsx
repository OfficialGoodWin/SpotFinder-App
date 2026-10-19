import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/locales/translations';
import { detectPreferredLanguage, localeBase, normalizeLanguage } from './localePreference';

const LanguageContext = createContext();

const COOKIE_NAME = 'spotfinder_language';
const DEFAULT_LANGUAGE = 'en';

const readTranslation = (language, key) => {
  let value = translations[localeBase(language)];
  for (const part of key.split('.')) {
    if (!value || typeof value !== 'object' || !(part in value)) return undefined;
    value = value[part];
  }
  return value;
};

// Helper functions for cookie management
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

const setCookie = (name, value, days = 365) => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
};

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const savedLang = getCookie(COOKIE_NAME);
    return normalizeLanguage(savedLang) || detectPreferredLanguage(navigator.languages || [navigator.language]);
  });

  useEffect(() => { document.documentElement.lang = language; }, [language]);

  const setLanguage = (lang) => {
    const normalized = normalizeLanguage(lang) || DEFAULT_LANGUAGE;
    setLanguageState(normalized);
    setCookie(COOKIE_NAME, normalized);
  };

  const t = (key, fallbackOrVariables) => {
    const variables = fallbackOrVariables && typeof fallbackOrVariables === 'object' ? fallbackOrVariables : null;
    const pluralKey = variables && Number.isFinite(Number(variables.count))
      ? `${key}_${new Intl.PluralRules(language).select(Number(variables.count))}` : key;
    const localized = readTranslation(language, pluralKey) ?? readTranslation(language, key);
    // Romanian ordinal numbers do not use the English suffixes (st/nd/rd/th).
    const intentionallyEmpty = localeBase(language) === 'ro' && /^navPanel\.ord(?:St|Nd|Rd|Th)$/.test(key);
    const format = value => variables && typeof value === 'string'
      ? value.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match)
      : value;
    if (localized !== undefined && localized !== null && (localized !== '' || intentionallyEmpty)) return format(localized);

    // Individual locale dictionaries can lag behind a new UI string. Falling
    // back to English keeps internal translation keys out of the interface.
    const english = readTranslation(DEFAULT_LANGUAGE, pluralKey) ?? readTranslation(DEFAULT_LANGUAGE, `${key}_other`) ?? readTranslation(DEFAULT_LANGUAGE, key);
    if (english !== undefined && english !== null && english !== '') return format(english);
    return typeof fallbackOrVariables === 'string' ? fallbackOrVariables : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
