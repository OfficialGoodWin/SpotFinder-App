import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/locales/translations';

const LanguageContext = createContext();

const COOKIE_NAME = 'spotfinder_language';
const DEFAULT_LANGUAGE = 'en';

const normalizeLanguage = (candidate) => {
  const shortCode = String(candidate || '').trim().toLowerCase().split(/[-_]/)[0];
  return Object.prototype.hasOwnProperty.call(translations, shortCode) ? shortCode : DEFAULT_LANGUAGE;
};

const readTranslation = (language, key) => {
  let value = translations[language];
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
    // Try to get language from cookie, fallback to default
    const savedLang = getCookie(COOKIE_NAME);
    return normalizeLanguage(savedLang);
  });

  const setLanguage = (lang) => {
    const normalized = normalizeLanguage(lang);
    setLanguageState(normalized);
    setCookie(COOKIE_NAME, normalized);
  };

  const t = (key, fallback) => {
    const localized = readTranslation(language, key);
    if (localized !== undefined && localized !== null && localized !== '') return localized;

    // Individual locale dictionaries can lag behind a new UI string. Falling
    // back to English keeps internal translation keys out of the interface.
    const english = readTranslation(DEFAULT_LANGUAGE, key);
    if (english !== undefined && english !== null && english !== '') return english;
    return fallback || key;
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
