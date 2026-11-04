import { getSpotDisplayName, getVerifiedSpotCategory } from '../lib/spotPresentation.js';

export const SNAPSHOT_FORMAT = 3;
export const LEGACY_SNAPSHOT_FORMAT = 2;
export const SUPPORTED_SNAPSHOT_FORMATS = Object.freeze([LEGACY_SNAPSHOT_FORMAT, SNAPSHOT_FORMAT]);
export const REGION_DEGREES = 2;
export const MAX_VIEW_REGIONS = 16;

const REGION_DIRECTORIES = Object.freeze({ 2: 'v2', 3: 'v3' });
const LAT_CELLS = 90;
const LNG_CELLS = 180;
const SUMMARY_KEYS = ['id', 'lat', 'lng', 'title', 'resolved_title', 'resolved_category', 'category', 'locality', 'tags', 'spot_type', 'rating', 'rating_count', 'access_difficulty', 'has_social', 'created_date', 'is_public', 'status', 'image_url'];
// Format 3 omits invariant fields and default empty values. It never accepts
// unknown keys, so a compact region cannot smuggle private Firestore fields.
const COMPACT_KEYS = ['id', 'lat', 'lng', 'title', 'resolved_category', 'category', 'locality', 'tags', 'spot_type', 'rating', 'rating_count', 'access_difficulty', 'has_social', 'created_date', 'image_url'];
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const THUMBNAIL = /^\/public-thumbnails\/[a-zA-Z0-9_-]+\.(?:jpg|webp)$/;

export function isSupportedSnapshotFormat(format) {
  return SUPPORTED_SNAPSHOT_FORMATS.includes(format);
}

export function snapshotRegionDirectory(format) {
  const directory = REGION_DIRECTORIES[format];
  if (!directory) throw new Error('Unsupported snapshot format');
  return directory;
}

export function regionForPoint(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const y = Math.min(LAT_CELLS - 1, Math.floor((lat + 90) / REGION_DEGREES));
  const x = Math.min(LNG_CELLS - 1, Math.floor((lng + 180) / REGION_DEGREES));
  return `r${y}-${x}`;
}

export function regionsForBounds({ south, west, north, east }) {
  if (![south, west, north, east].every(Number.isFinite) || south > north || north < -90 || south > 90) return null;
  const firstY = Math.min(LAT_CELLS - 1, Math.max(0, Math.floor((Math.max(-90, south) + 90) / REGION_DEGREES)));
  const lastY = Math.min(LAT_CELLS - 1, Math.floor((Math.min(90, north) + 90) / REGION_DEGREES));
  const width = east - west;
  if (width < 0 || width >= 360) return null;
  const keys = new Set();
  for (let y = firstY; y <= lastY; y += 1) {
    for (let x = Math.floor((west + 180) / REGION_DEGREES); x <= Math.floor((east + 180) / REGION_DEGREES); x += 1) {
      keys.add(`r${y}-${((x % LNG_CELLS) + LNG_CELLS) % LNG_CELLS}`);
    }
  }
  return [...keys].sort();
}

export function isPublicSnapshotSpot(spot) {
  return Boolean(spot && spot.is_public === true && spot.status === 'published'
    && spot.needs_review !== true && spot.discovery_state !== 'hidden'
    && (spot.flag_count == null || spot.flag_count === 0)
    && spot.sensitive_location !== true && typeof spot.id === 'string' && spot.id.length > 0
    && typeof spot.lat === 'number' && typeof spot.lng === 'number'
    && regionForPoint(spot.lat, spot.lng));
}

export function toPublicSnapshotSpot(spot) {
  if (!isPublicSnapshotSpot(spot)) return null;
  const thumbnail = typeof spot.public_thumbnail_url === 'string' && THUMBNAIL.test(spot.public_thumbnail_url)
    ? spot.public_thumbnail_url : null;
  const presentationSource = { title: spot.title, category: spot.category, spot_type: spot.spot_type,
    resolved_category: spot.resolved_category, tags: spot.tags };
  const summary = {
    id: spot.id, lat: Number(spot.lat.toFixed(6)), lng: Number(spot.lng.toFixed(6)),
    title: String(spot.title || '').slice(0, 100),
    resolved_title: getSpotDisplayName(presentationSource).slice(0, 100),
    resolved_category: String(getVerifiedSpotCategory(presentationSource) || '').slice(0, 40),
    category: typeof spot.category === 'string' ? spot.category.slice(0, 40) : '',
    locality: typeof spot.locality === 'string' ? spot.locality.slice(0, 100) : '',
    tags: Array.isArray(spot.tags) ? spot.tags.filter(value => typeof value === 'string').slice(0, 10).map(value => value.slice(0, 40)) : [],
    spot_type: typeof spot.spot_type === 'string' ? spot.spot_type.slice(0, 40) : '',
    rating: Number.isFinite(spot.rating) ? spot.rating : 0,
    rating_count: Number.isInteger(spot.rating_count) && spot.rating_count >= 0 ? spot.rating_count : 0,
    access_difficulty: typeof spot.access_difficulty === 'string' ? spot.access_difficulty.slice(0, 20) : '',
    has_social: spot.has_social === true,
    created_date: typeof spot.created_date === 'string' ? spot.created_date.slice(0, 32) : '',
    is_public: true, status: 'published', image_url: thumbnail,
  };
  return EMAIL.test(JSON.stringify(summary)) ? null : summary;
}

// Runtime summary -> compact format-3 record. Invariant fields (`is_public`,
// `status`) and values the reader can rebuild are not serialized.
export function encodeSnapshotSpot(spot) {
  if (!validSnapshotSpot(spot)) throw new TypeError('Invalid public snapshot spot');
  const compact = { id: spot.id, lat: spot.lat, lng: spot.lng, title: spot.title };
  if (spot.resolved_category) compact.resolved_category = spot.resolved_category;
  if (spot.category) compact.category = spot.category;
  if (spot.locality) compact.locality = spot.locality;
  if (spot.tags.length) compact.tags = [...spot.tags];
  if (spot.spot_type) compact.spot_type = spot.spot_type;
  if (spot.rating !== 0) compact.rating = spot.rating;
  if (spot.rating_count !== 0) compact.rating_count = spot.rating_count;
  if (spot.access_difficulty) compact.access_difficulty = spot.access_difficulty;
  if (spot.has_social) compact.has_social = true;
  if (spot.created_date) compact.created_date = spot.created_date;
  if (spot.image_url !== null) compact.image_url = spot.image_url;
  return compact;
}

export function validCompactSnapshotSpot(spot) {
  return Boolean(spot && typeof spot === 'object' && !Array.isArray(spot)
    && Object.keys(spot).every(key => COMPACT_KEYS.includes(key))
    && typeof spot.id === 'string' && spot.id.length > 0 && spot.id.length <= 1500
    && typeof spot.lat === 'number' && typeof spot.lng === 'number'
    && regionForPoint(spot.lat, spot.lng)
    && typeof spot.title === 'string' && spot.title.length <= 100
    && (spot.resolved_category == null || typeof spot.resolved_category === 'string' && spot.resolved_category.length <= 40)
    && (spot.category == null || typeof spot.category === 'string' && spot.category.length <= 40)
    && (spot.locality == null || typeof spot.locality === 'string' && spot.locality.length <= 100)
    && (spot.spot_type == null || typeof spot.spot_type === 'string' && spot.spot_type.length <= 40)
    && (spot.access_difficulty == null || typeof spot.access_difficulty === 'string' && spot.access_difficulty.length <= 20)
    && (spot.created_date == null || typeof spot.created_date === 'string' && spot.created_date.length <= 32)
    && (spot.tags == null || Array.isArray(spot.tags) && spot.tags.length <= 10
      && spot.tags.every(value => typeof value === 'string' && value.length <= 40))
    && (spot.rating == null || Number.isFinite(spot.rating))
    && (spot.rating_count == null || Number.isInteger(spot.rating_count) && spot.rating_count >= 0)
    && (spot.has_social == null || typeof spot.has_social === 'boolean')
    && (spot.image_url == null || typeof spot.image_url === 'string' && THUMBNAIL.test(spot.image_url))
    && !EMAIL.test(JSON.stringify(spot)));
}

// Compact format-3 record -> the same runtime summary the format-2 reader
// returned. `resolved_title` is recomputed from retained public fields; it is
// not stored twice.
export function decodeSnapshotSpot(spot) {
  if (!validCompactSnapshotSpot(spot)) throw new Error('Invalid compact snapshot spot');
  const decoded = {
    id: spot.id, lat: spot.lat, lng: spot.lng, title: spot.title,
    resolved_category: spot.resolved_category ?? '',
    category: spot.category ?? '',
    locality: spot.locality ?? '',
    tags: spot.tags ? [...spot.tags] : [],
    spot_type: spot.spot_type ?? '',
    rating: spot.rating ?? 0,
    rating_count: spot.rating_count ?? 0,
    access_difficulty: spot.access_difficulty ?? '',
    has_social: spot.has_social === true,
    created_date: spot.created_date ?? '',
    is_public: true, status: 'published',
    image_url: spot.image_url ?? null,
  };
  decoded.resolved_title = getSpotDisplayName(decoded).slice(0, 100);
  return decoded;
}

export function validSnapshotSpot(spot) {
  return Boolean(spot && Object.keys(spot).every(key => SUMMARY_KEYS.includes(key))
    && typeof spot.lat === 'number' && typeof spot.lng === 'number'
    && isPublicSnapshotSpot(spot) && typeof spot.title === 'string'
    && spot.id.length <= 1500 && spot.title.length <= 100
    && typeof spot.resolved_title === 'string' && spot.resolved_title.length <= 100
    && typeof spot.resolved_category === 'string' && spot.resolved_category.length <= 40
    && typeof spot.category === 'string' && spot.category.length <= 40
    && typeof spot.locality === 'string' && spot.locality.length <= 100
    && typeof spot.spot_type === 'string' && spot.spot_type.length <= 40
    && typeof spot.access_difficulty === 'string' && spot.access_difficulty.length <= 20
    && typeof spot.created_date === 'string' && spot.created_date.length <= 32
    && Array.isArray(spot.tags) && spot.tags.length <= 10
    && spot.tags.every(value => typeof value === 'string' && value.length <= 40)
    && Number.isFinite(spot.rating) && Number.isInteger(spot.rating_count) && spot.rating_count >= 0
    && (spot.image_url === null || typeof spot.image_url === 'string' && THUMBNAIL.test(spot.image_url))
    && !EMAIL.test(JSON.stringify(spot)));
}

export function spotInsideBounds(spot, bounds) {
  const lng = Number(spot.lng);
  const longitudeInside = lng >= bounds.west && lng <= bounds.east
    || lng + 360 >= bounds.west && lng + 360 <= bounds.east
    || lng - 360 >= bounds.west && lng - 360 <= bounds.east;
  return spot.lat >= bounds.south && spot.lat <= bounds.north && longitudeInside;
}

export function publicSnapshotThumbnailUrl(spot, origin) {
  if (!spot?._public_snapshot || typeof spot.image_url !== 'string') return '';
  try {
    const url = new URL(spot.image_url, origin);
    return url.origin === origin && THUMBNAIL.test(url.pathname) ? url.href : '';
  } catch { return ''; }
}
