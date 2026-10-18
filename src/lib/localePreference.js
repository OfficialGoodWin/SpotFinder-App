import { LANGUAGES, LANGUAGE_VARIANTS } from '../locales/translations.js';

const choices = [...LANGUAGES, ...LANGUAGE_VARIANTS];
const supported = new Set(choices.map(({ code }) => code));

export function localeBase(locale) {
  return choices.find(({ code }) => code === locale)?.base || locale;
}

export function normalizeLanguage(candidate) {
  const value = String(candidate || '').trim().replaceAll('_', '-');
  if (!value) return null;
  const [rawLanguage, rawRegion, rawCountry] = value.split('-');
  const language = rawLanguage.toLowerCase();
  const region = rawRegion?.length === 4
    ? rawRegion[0].toUpperCase() + rawRegion.slice(1).toLowerCase()
    : rawRegion?.toUpperCase();
  const country = rawCountry?.toUpperCase();
  const normalized = [language, region, country].filter(Boolean).join('-');
  if (supported.has(normalized)) return normalized;
  if (language === 'en' && (region === 'GB' || region === 'IE' || region === 'AU' || region === 'NZ')) return 'en-GB';
  if (language === 'no' || language === 'nn') return 'nb';
  if (supported.has(language)) return language;
  return null;
}

export function detectPreferredLanguage(preferences) {
  for (const candidate of preferences || []) {
    const language = normalizeLanguage(candidate);
    if (language) return language;
  }
  return 'en';
}
