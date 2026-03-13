import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/locales/translations';

const LanguageContext = createContext();

const COOKIE_NAME = 'spotfinder_language';
const DEFAULT_LANGUAGE = 'en';

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
    return savedLang || DEFAULT_LANGUAGE;
  });

  const setLanguage = (lang) => {
    setLanguageState(lang);
    setCookie(COOKIE_NAME, lang);
  };

  const t = (key) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }
    
    return value || key;
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
