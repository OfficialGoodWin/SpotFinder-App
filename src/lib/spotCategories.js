// One primary category per community spot. The stored primary value is
// `tags[0]` (legacy spots) or `category` (new writes); both resolve through
// this module so legacy records keep their original meaning without a bulk
// Firestore migration.
export const SPOT_CATEGORIES = [
  {
    key: 'viewpoint',
    popular: true,
    icon: 'viewpoint',
    label: { cs: 'Vyhlídka', en: 'Viewpoint' },
    shortLabel: { cs: 'Vyhlídka', en: 'Viewpoint' },
    description: { cs: 'Panoramata, věže a výhledy do krajiny.', en: 'Panoramas, towers and scenic overlooks.' },
  },
  {
    key: 'photo_spot',
    popular: true,
    icon: 'camera',
    label: { cs: 'Fotomísto', en: 'Photo Spot' },
    shortLabel: { cs: 'Fotomísto', en: 'Photo Spot' },
    description: { cs: 'Fotogenická místa, murály a vizuálně zapamatovatelné scény.', en: 'Photo opportunities, murals and visually memorable locations.' },
  },
  {
    key: 'heritage',
    popular: true,
    icon: 'heritage',
    label: { cs: 'Památky a kultura', en: 'Heritage & Culture' },
    shortLabel: { cs: 'Památky', en: 'Heritage' },
    description: { cs: 'Hrady, zámky, muzea, zříceniny a historické památky.', en: 'Castles, châteaux, museums, ruins and historical monuments.' },
  },
  {
    key: 'water',
    popular: true,
    icon: 'water',
    label: { cs: 'Voda', en: 'Water' },
    shortLabel: { cs: 'Voda', en: 'Water' },
    description: { cs: 'Jezera, vodopády, řeky a další zajímavá vodní místa.', en: 'Lakes, waterfalls, rivers and other interesting water locations.' },
  },
  {
    key: 'nature',
    popular: false,
    icon: 'nature',
    label: { cs: 'Hory a příroda', en: 'Mountains & Nature' },
    shortLabel: { cs: 'Příroda', en: 'Nature' },
    description: { cs: 'Vrcholy, skalní útvary, přírodní památky a výlety do přírody.', en: 'Peaks, rock formations, natural monuments and outdoor destinations.' },
  },
  {
    key: 'urban_landmark',
    popular: false,
    icon: 'urban',
    label: { cs: 'Městská zajímavost', en: 'Urban Landmark' },
    shortLabel: { cs: 'Město', en: 'Urban' },
    description: { cs: 'Náměstí, sochy, kašny a výrazné městské atrakce.', en: 'Central squares, statues, fountains and distinctive urban attractions.' },
  },
  {
    key: 'curiosity',
    popular: false,
    icon: 'curiosity',
    label: { cs: 'Kuriozita', en: 'Curious & Quirky' },
    shortLabel: { cs: 'Kuriozita', en: 'Curiosity' },
    description: { cs: 'Podivné objekty, vtipné nápisy, neobvyklé dekorace a zábavné objevy.', en: 'Strange objects, funny signs, unusual decorations and amusing discoveries.' },
  },
];

export const SPOT_CATEGORY_KEYS = SPOT_CATEGORIES.map(item => item.key);
export const POPULAR_SPOT_CATEGORY_KEYS = SPOT_CATEGORIES.filter(item => item.popular).map(item => item.key);

const normalize = value => String(value || '')
  .trim()
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '');

// Values that older spots stored as their primary tag/type. Unrecognised
// values deliberately resolve to null so the map can use a neutral marker.
const ALIASES = {
  viewpoint: ['viewpoint', 'vyhlidka'],
  photo_spot: ['photospot', 'fotomisto'],
  heritage: ['heritage', 'historic', 'historicsite', 'historicruin', 'ruin', 'ruins', 'castle', 'hrad', 'zricenina', 'pamatky', 'kultura'],
  water: ['water', 'waterfall', 'swimspot', 'swimmingspot', 'swim', 'lake', 'river', 'vodopad', 'jezero', 'reka'],
  nature: ['nature', 'mountain', 'mountainspot', 'hike', 'hiking', 'hikingspot', 'trail', 'priroda', 'tura'],
  urban_landmark: ['urbanlandmark', 'urbanexplore', 'landmark', 'square', 'namesti'],
  curiosity: ['curiosity', 'curious', 'quirky', 'kuriozita'],
};

const ALIAS_LOOKUP = new Map();
for (const key of SPOT_CATEGORY_KEYS) {
  ALIAS_LOOKUP.set(normalize(key), key);
  for (const alias of ALIASES[key] || []) ALIAS_LOOKUP.set(normalize(alias), key);
}

export function categoryKeyForValue(value) {
  return ALIAS_LOOKUP.get(normalize(value)) || null;
}

export function categoryByKey(key) {
  const canonical = categoryKeyForValue(key);
  return canonical ? SPOT_CATEGORIES.find(item => item.key === canonical) || null : null;
}

export function categoryLabel(key, language = 'en', { short = false } = {}) {
  const item = categoryByKey(key);
  if (!item) return '';
  const locale = String(language || '').toLowerCase().startsWith('cs') ? 'cs' : 'en';
  return (short ? item.shortLabel : item.label)[locale];
}

export function categoryDescription(key, language = 'en') {
  const item = categoryByKey(key);
  if (!item) return '';
  return item.description[String(language || '').toLowerCase().startsWith('cs') ? 'cs' : 'en'];
}

// The contributor's primary category is `category` or the first stored tag.
// Once one of those exists it is authoritative: an unrecognised value (for
// example the legacy `Other`, `SecretCafe`, `Sunset` or `Sunrise`) resolves to
// null so markers stay neutral instead of letting OSM metadata guess a type.
// spot_type and resolved_category are only fallbacks for older records that
// have no primary tag at all. POI taxonomy is intentionally never consulted.
export function spotPrimaryCategory(spot = {}) {
  const declared = [
    spot?.category,
    Array.isArray(spot?.tags) ? spot.tags[0] : null,
  ];
  for (const value of declared) {
    if (value === null || value === undefined || String(value).trim() === '') continue;
    return categoryKeyForValue(value);
  }
  for (const value of [spot?.spot_type, spot?.resolved_category]) {
    const key = categoryKeyForValue(value);
    if (key) return key;
  }
  return null;
}

export function spotCategoryLabel(spot = {}, language = 'en', options = {}) {
  const key = spotPrimaryCategory(spot);
  return key ? categoryLabel(key, language, options) : '';
}

export const SPOT_CATEGORY_MAP_ICONS = {
  viewpoint: 'viewpoint',
  photo_spot: 'camera',
  heritage: 'heritage',
  water: 'droplets',
  nature: 'trees',
  urban_landmark: 'landmark',
  curiosity: 'sparkles',
};
