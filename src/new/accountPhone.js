export const PHONE_COUNTRIES = [
  ['CZ', '+420'], ['SK', '+421'], ['PL', '+48'], ['DE', '+49'], ['AT', '+43'],
  ['GB', '+44'], ['IE', '+353'], ['FR', '+33'], ['IT', '+39'], ['ES', '+34'],
  ['NL', '+31'], ['BE', '+32'], ['CH', '+41'], ['HU', '+36'], ['RO', '+40'],
  ['UA', '+380'], ['US', '+1'], ['CA', '+1'], ['AU', '+61'],
];

const LANGUAGE_REGION = { cs: 'CZ', sk: 'SK', pl: 'PL', de: 'DE', fr: 'FR', it: 'IT', es: 'ES', hu: 'HU', ro: 'RO', uk: 'UA' };
const TRUNK_PREFIX_REGIONS = new Set(['GB', 'IE', 'FR', 'DE', 'AT', 'NL', 'BE', 'CH', 'HU', 'RO', 'UA', 'AU']);

export function defaultPhoneRegion(appLanguage, browserLanguages = []) {
  const appParts = String(appLanguage || '').split('-');
  const explicitRegion = appParts.find(part => /^[A-Z]{2}$/.test(part));
  if (explicitRegion && PHONE_COUNTRIES.some(([region]) => region === explicitRegion)) return explicitRegion;
  if (LANGUAGE_REGION[appParts[0]]) return LANGUAGE_REGION[appParts[0]];
  for (const locale of browserLanguages) {
    const region = String(locale || '').split('-').find(part => /^[A-Z]{2}$/.test(part));
    if (region && PHONE_COUNTRIES.some(([code]) => code === region)) return region;
  }
  return '';
}

export function normalizeAccountPhone(region, prefix, rawNumber) {
  const raw = String(rawNumber || '').trim();
  const direct = raw.startsWith('+') || raw.startsWith('00');
  let value = raw.replace(/[\s().-]/g, '');
  if (direct) {
    if (value.startsWith('00')) value = `+${value.slice(2)}`;
  } else {
    const dial = region === 'OTHER' ? String(prefix || '').replace(/[\s().-]/g, '') : PHONE_COUNTRIES.find(([code]) => code === region)?.[1];
    if (!/^\+[1-9]\d{0,3}$/.test(dial || '')) return null;
    if (!/^\d+$/.test(value)) return null;
    if (TRUNK_PREFIX_REGIONS.has(region) && value.startsWith('0')) value = value.slice(1);
    value = `${dial}${value}`;
  }
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
}
