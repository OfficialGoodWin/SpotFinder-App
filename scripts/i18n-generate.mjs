import fs from 'node:fs';
import path from 'node:path';
import { translations } from '../src/locales/translations.js';

const args = new Set(process.argv.slice(2));
const option = name => process.argv.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const locale = option('--locale');
const execute = args.has('--execute');
const write = args.has('--write');
const provider = option('--provider') || 'azure';
if (!locale || !translations[locale] || locale === 'en') throw new Error('Use --locale=<existing catalog code>.');
if (write && !execute) throw new Error('--write requires --execute.');
const key = process.env.AZURE_TRANSLATOR_KEY;
const region = process.env.AZURE_TRANSLATOR_REGION;
const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com';
const providers = {
  azure: {
    validate() {
      if (!key || !region) throw new Error('Set AZURE_TRANSLATOR_KEY and AZURE_TRANSLATOR_REGION in the local environment.');
      if (new URL(endpoint).protocol !== 'https:') throw new Error('Translator endpoint must use HTTPS.');
    },
    async translate(batch, targetLanguage) {
      const url = new URL('/translate', endpoint);
      url.searchParams.set('api-version', '3.0');
      url.searchParams.set('from', 'en');
      url.searchParams.set('to', targetLanguage);
      url.searchParams.set('textType', 'html');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Ocp-Apim-Subscription-Key': key, 'Ocp-Apim-Subscription-Region': region },
        body: JSON.stringify(batch.map(([, value]) => ({ Text: protect(value) }))),
      });
      if (!response.ok) throw new Error(`Translator request failed (${response.status}). Catalog was not changed.`);
      const result = await response.json();
      if (!Array.isArray(result) || result.length !== batch.length) throw new Error('Translator returned an unexpected batch size. Catalog was not changed.');
      return result.map(item => item?.translations?.[0]?.text || '');
    },
  },
};
if (!providers[provider]) throw new Error(`Unknown provider ${provider}. Add a provider adapter before using it.`);
const flatten = (object, prefix = '') => Object.entries(object).flatMap(([name, value]) => value && typeof value === 'object'
  ? flatten(value, `${prefix}${name}.`) : [[`${prefix}${name}`, value]]);
const source = new Map(flatten(translations.en));
const target = new Map(flatten(translations[locale]));
const legal = /^(legal|termsDraft|privacyDraft|cookieDraft|refundDraft)\./i;
const rows = [...source].filter(([name, value]) => !target.has(name) && !legal.test(name) && typeof value === 'string' && value.trim());
const characters = rows.reduce((sum, [, value]) => sum + [...value].length, 0);
console.log(`${locale}: ${rows.length} missing non-legal values; ${characters} source characters. Existing translations and legal text are excluded.`);
console.log(`Provider: ${provider}; mode: ${execute ? write ? 'translate and update catalog' : 'translate to review file' : 'dry run (no network request)'}.`);
if (!execute || !rows.length) process.exit(0);
providers[provider].validate();

const protect = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/\{[A-Za-z]\w*\}|SpotFinder|MapLibre|PMTiles|Firebase|Instagram|TikTok|Google Maps|Mapy\.com|Apple Maps/g,
  match => `<span class="notranslate">${match}</span>`);
const unprotect = value => value.replace(/<span class="notranslate">([^<]*)<\/span>/g, '$1').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const placeholders = value => [...String(value).matchAll(/\{[A-Za-z]\w*\}/g)].map(match => match[0]).sort().join('|');
const protectedNames = value => [...String(value).matchAll(/SpotFinder|MapLibre|PMTiles|Firebase|Instagram|TikTok|Google Maps|Mapy\.com|Apple Maps/g)].map(match => match[0]).sort().join('|');
const generated = {};
for (let index = 0; index < rows.length; index += 100) {
  const batch = rows.slice(index, index + 100);
  const result = await providers[provider].translate(batch, locale);
  for (let offset = 0; offset < batch.length; offset++) {
    const [name, original] = batch[offset];
    const translated = unprotect(result[offset]);
    if (!translated.trim() || placeholders(original) !== placeholders(translated) || protectedNames(original) !== protectedNames(translated) || /<\/?span\b/i.test(translated)) throw new Error(`Invalid translation for ${name}. Catalog was not changed.`);
    generated[name] = translated;
  }
}
const reviewPath = path.resolve(`reports/i18n-${locale}-review.json`);
fs.mkdirSync(path.dirname(reviewPath), { recursive: true });
fs.writeFileSync(reviewPath, JSON.stringify({ locale, provider, sourceCharacters: characters, generated, reviewRequired: true }, null, 2) + '\n');
console.log(`Saved ${Object.keys(generated).length} suggestions to ${reviewPath}; ${characters} source characters submitted. Check your Azure pricing tier for quota impact.`);
if (write) {
  const result = structuredClone(translations[locale]);
  for (const [name, value] of Object.entries(generated)) {
    const parts = name.split('.');
    const leaf = parts.pop();
    const parent = parts.reduce((object, part) => object[part] ??= {}, result);
    if (!(leaf in parent)) parent[leaf] = value;
  }
  const file = path.resolve(`src/locales/translations_${locale}.js`);
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, `export default ${JSON.stringify(result, null, 2)};\n`);
  fs.renameSync(temp, file);
  console.log(`Updated ${file}. Review the diff before committing.`);
}
