import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { translations, LANGUAGES, LANGUAGE_VARIANTS } from '../src/locales/translations.js';
import { detectPreferredLanguage, localeBase, normalizeLanguage } from '../src/lib/localePreference.js';

const flatten = (value, prefix = '') => Object.entries(value).flatMap(([key, entry]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  return entry && typeof entry === 'object' ? flatten(entry, path) : [[path, entry]];
});

const sourceFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? sourceFiles(path) : /\.[jt]sx?$/.test(entry.name) ? [path] : [];
});

// Romanian ordinals are written as a bare number in the legacy navigation UI.
const intentionalEmptyValues = new Set(['ordSt', 'ordNd', 'ordRd', 'ordTh'].map((key) => `ro.navPanel.${key}`));

test('locale files have valid values; existing translations retain their original coverage', () => {
  const english = new Map(flatten(translations.en));
  assert.deepEqual(LANGUAGES.map(({ code }) => code).sort(), Object.keys(translations).sort());
  const established = new Set(['en', 'en-GB', 'cs', 'pl', 'de', 'sk', 'it', 'fr', 'ru', 'uk', 'hu', 'ro', 'es', 'bg']);
  const originalSettings = new Set(['title', 'darkMode', 'enabled', 'disabled', 'language', 'selectLanguage', 'prefSaved', 'about', 'help', 'feedback']);
  const newerNamespaces = new Set([
    'nearbyUi', 'accountSecurity', 'searchUi', 'mfaUi', 'authErrors', 'mapUi',
    'poiPanelUi', 'homeUi', 'localeUi', 'addSpotUi', 'spotTags', 'spotDetailUi',
    'offlineMaps', 'statusBanner', 'notFound', 'authMore', 'routeUi',
    'reportUi', 'reportAnythingUi', 'discoveryUi', 'editSpotUi', 'poiDetailUi', 'collection', 'legal',
    'updates', 'statusPage', 'refundDraft', 'faqPage', 'faqGraphic', 'cookieDraft',
    'termsDraft', 'privacyDraft',
  ]);
  const originalKeys = [...english.keys()].filter(key => {
    const [namespace, item] = key.split('.');
    return !newerNamespaces.has(namespace) && (namespace !== 'settings' || originalSettings.has(item));
  });
  for (const [language, values] of Object.entries(translations)) {
    const localized = new Map(flatten(values));
    if (established.has(language)) {
      assert.deepEqual(originalKeys.filter(key => !localized.has(key)), [], `${language} original keys`);
    }
    for (const [key, value] of localized) {
      assert.equal(typeof value, 'string', `${language}.${key} must be text`);
      assert.ok(value.trim() || intentionalEmptyValues.has(`${language}.${key}`), `${language}.${key} is empty`);
      assert.ok(english.has(key), `${language}.${key} missing from English`);
      const parameters = (text) => [...text.matchAll(/\{[a-zA-Z]\w*\}/g)].map(([name]) => name).sort();
      assert.deepEqual(parameters(value), parameters(english.get(key)), `${language}.${key} parameters`);
    }
  }
});

test('browser preferences choose a supported language without using location', () => {
  assert.equal(detectPreferredLanguage(['xx-XX', 'fr-BE', 'en-US']), 'fr-BE');
  assert.equal(detectPreferredLanguage(['sr-Latn-RS']), 'sr');
  assert.equal(detectPreferredLanguage(['en-GB']), 'en-GB');
  assert.equal(detectPreferredLanguage(['ro-MD']), 'ro-MD');
  assert.equal(detectPreferredLanguage(['pt-BR']), 'pt');
  assert.equal(detectPreferredLanguage(['zz-ZZ']), 'en');
  assert.equal(normalizeLanguage('nl-BE'), 'nl-BE');
  assert.equal(localeBase('nl-BE'), 'nl');
  assert.ok(LANGUAGE_VARIANTS.every(({ base }) => translations[base]));
});

test('each listed locale has translated navigation labels and discloses partial coverage', () => {
  for (const option of LANGUAGES) {
    const locale = translations[option.code];
    assert.ok(locale?.collection?.title, `${option.code} collection title`);
    assert.ok(locale?.legal?.termsTitle, `${option.code} terms title`);
    assert.ok(option.flag, `${option.code} flag`);
    if (!['en', 'en-GB'].includes(option.code)) assert.equal(option.partial, true);
  }
});

test('SMS enrollment shows a Polish international-format example', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/MfaSection.jsx'), 'utf8');
  assert.match(source, /placeholder="\+48 123 456 789"/);
  assert.doesNotMatch(source, /\+1 555 555 5555/);
});

test('Czech and Polish refund drafts contain every source paragraph', () => {
  const source = Object.keys(translations.en.refundDraft).sort();
  for (const code of ['cs', 'pl']) {
    assert.deepEqual(Object.keys(translations[code].refundDraft).sort(), source);
    assert.ok(translations[code].legal.draftNotice);
  }
});

test('Czech and Polish FAQ content has every question, answer, step, About and feedback label', () => {
  const required = Object.keys(translations.en.faqPage).filter(key => key !== 'translationNotice').sort();
  for (const code of ['cs', 'pl']) {
    assert.deepEqual(Object.keys(translations[code].faqPage).filter(key => key !== 'translationNotice').sort(), required);
  }
});

test('Czech and Polish FAQ illustrations have translated labels', () => {
  const required = Object.keys(translations.en.faqGraphic).sort();
  for (const code of ['cs', 'pl']) assert.deepEqual(Object.keys(translations[code].faqGraphic).sort(), required);
});

test('Czech and Polish cookie policy drafts have every source paragraph', () => {
  const required = Object.keys(translations.en.cookieDraft).sort();
  for (const code of ['cs', 'pl']) assert.deepEqual(Object.keys(translations[code].cookieDraft).sort(), required);
});

test('Czech and Polish Terms and Privacy drafts have every source section', () => {
  for (const group of ['termsDraft', 'privacyDraft']) {
    const required = Object.keys(translations.en[group]).sort();
    for (const code of ['cs', 'pl']) assert.deepEqual(Object.keys(translations[code][group]).sort(), required, `${code}.${group}`);
  }
});

test('static translation calls refer to a key in the English dictionary', () => {
  const english = new Map(flatten(translations.en));
  const missing = [];
  for (const file of sourceFiles(join(process.cwd(), 'src'))) {
    const contents = readFileSync(file, 'utf8');
    for (const match of contents.matchAll(/\bt\(\s*(['"`])([a-zA-Z][\w]*(?:\.[\w]+)+)\1/g)) {
      if (!english.has(match[2]) && !english.has(`${match[2]}_one`) && !english.has(`${match[2]}_other`)) missing.push(`${file}: ${match[2]}`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});
