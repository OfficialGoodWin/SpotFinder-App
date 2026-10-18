import en from './translations_en.js';
import cs from './translations_cs.js';
import pl from './translations_pl.js';
import de from './translations_de.js';
import sk from './translations_sk.js';
import it from './translations_it.js';
import fr from './translations_fr.js';
import ru from './translations_ru.js';
import uk from './translations_uk.js';
import hu from './translations_hu.js';
import ro from './translations_ro.js';
import es from './translations_es.js';
import bg from './translations_bg.js';
import enGB from './translations_en-GB.js';
import pt from './translations_pt.js';
import hr from './translations_hr.js';
import bs from './translations_bs.js';
import sq from './translations_sq.js';
import el from './translations_el.js';
import tr from './translations_tr.js';
import sr from './translations_sr.js';
import mk from './translations_mk.js';
import be from './translations_be.js';
import lt from './translations_lt.js';
import lv from './translations_lv.js';
import et from './translations_et.js';
import fi from './translations_fi.js';
import sv from './translations_sv.js';
import nb from './translations_nb.js';
import da from './translations_da.js';
import is from './translations_is.js';
import nl from './translations_nl.js';
import lb from './translations_lb.js';
import ga from './translations_ga.js';

export const translations = {
  en, 'en-GB': enGB, fr, pt, es, it, de, pl, cs, sk, hu, hr, bs, sq,
  el, tr, bg, sr, mk, ro, uk, ru, be, lt, lv, et, fi, sv, nb, da,
  is, nl, lb, ga,
};

// Flags illustrate locale choices. They do not establish a user's country.
const LANGUAGE_OPTIONS = [
  { code: 'en', nativeName: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', nativeName: 'English (UK)', flag: '🇬🇧' },
  { code: 'fr', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'pt', nativeName: 'Português', flag: '🇵🇹', partial: true },
  { code: 'es', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'it', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'de', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'pl', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'cs', nativeName: 'Čeština', flag: '🇨🇿' },
  { code: 'sk', nativeName: 'Slovenčina', flag: '🇸🇰' },
  { code: 'hu', nativeName: 'Magyar', flag: '🇭🇺' },
  { code: 'hr', nativeName: 'Hrvatski', flag: '🇭🇷', partial: true },
  { code: 'bs', nativeName: 'Bosanski', flag: '🇧🇦', partial: true },
  { code: 'sq', nativeName: 'Shqip', flag: '🇦🇱', partial: true },
  { code: 'el', nativeName: 'Ελληνικά', flag: '🇬🇷', partial: true },
  { code: 'tr', nativeName: 'Türkçe', flag: '🇹🇷', partial: true },
  { code: 'bg', nativeName: 'Български', flag: '🇧🇬' },
  { code: 'sr', nativeName: 'Српски', flag: '🇷🇸', partial: true },
  { code: 'mk', nativeName: 'Македонски', flag: '🇲🇰', partial: true },
  { code: 'ro', nativeName: 'Română', flag: '🇷🇴' },
  { code: 'uk', nativeName: 'Українська', flag: '🇺🇦' },
  { code: 'ru', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'be', nativeName: 'Беларуская', flag: '🇧🇾', partial: true },
  { code: 'lt', nativeName: 'Lietuvių', flag: '🇱🇹', partial: true },
  { code: 'lv', nativeName: 'Latviešu', flag: '🇱🇻', partial: true },
  { code: 'et', nativeName: 'Eesti', flag: '🇪🇪', partial: true },
  { code: 'fi', nativeName: 'Suomi', flag: '🇫🇮', partial: true },
  { code: 'sv', nativeName: 'Svenska', flag: '🇸🇪', partial: true },
  { code: 'nb', nativeName: 'Norsk bokmål', flag: '🇳🇴', partial: true },
  { code: 'da', nativeName: 'Dansk', flag: '🇩🇰', partial: true },
  { code: 'is', nativeName: 'Íslenska', flag: '🇮🇸', partial: true },
  { code: 'nl', nativeName: 'Nederlands', flag: '🇳🇱', partial: true },
  { code: 'lb', nativeName: 'Lëtzebuergesch', flag: '🇱🇺', partial: true },
  { code: 'ga', nativeName: 'Gaeilge', flag: '🇮🇪', partial: true },
];

// The legacy catalog covers older UI strings, but newer screens and legal
// documents are not yet fully translated in any non-English locale.
export const LANGUAGES = LANGUAGE_OPTIONS.map(option => ({
  ...option,
  partial: option.code !== 'en' && option.code !== 'en-GB',
}));

// Belgium, Moldova, Kosovo, and Cyprus use the languages listed below;
// there is no separate Belgian, Moldovan, Kosovan, or Cypriot language.
const VARIANT_OPTIONS = [
  { code: 'fr-BE', base: 'fr', nativeName: 'Français (Belgique)', flag: '🇧🇪' },
  { code: 'nl-BE', base: 'nl', nativeName: 'Nederlands (België)', flag: '🇧🇪', partial: true },
  { code: 'de-BE', base: 'de', nativeName: 'Deutsch (Belgien)', flag: '🇧🇪' },
  { code: 'ro-MD', base: 'ro', nativeName: 'Română (Moldova)', flag: '🇲🇩' },
  { code: 'sq-XK', base: 'sq', nativeName: 'Shqip (Kosovë)', flag: '🇽🇰', partial: true },
  { code: 'el-CY', base: 'el', nativeName: 'Ελληνικά (Κύπρος)', flag: '🇨🇾', partial: true },
  { code: 'tr-CY', base: 'tr', nativeName: 'Türkçe (Kıbrıs)', flag: '🇨🇾', partial: true },
];

export const LANGUAGE_VARIANTS = VARIANT_OPTIONS.map(option => ({ ...option, partial: true }));
