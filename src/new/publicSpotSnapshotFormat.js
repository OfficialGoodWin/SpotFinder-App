export const SNAPSHOT_FORMAT = 1;
export const REGION_DEGREES = 2;
export const MAX_VIEW_REGIONS = 16;

const LAT_CELLS = 90;
const LNG_CELLS = 180;
const SUMMARY_KEYS = ['id', 'lat', 'lng', 'title', 'resolved_title', 'resolved_category', 'category', 'locality', 'tags', 'spot_type', 'rating', 'rating_count', 'access_difficulty', 'has_social', 'created_date', 'is_public', 'status', 'image_url'];
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

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
      if (keys.size > MAX_VIEW_REGIONS) return null;
    }
  }
  return [...keys].sort();
}

export function isPublicSnapshotSpot(spot) {
  return Boolean(spot && spot.is_public === true && spot.status === 'published'
    && spot.needs_review !== true && spot.discovery_state !== 'hidden'
    && spot.sensitive_location !== true && typeof spot.id === 'string' && spot.id.length > 0
    && typeof spot.lat === 'number' && typeof spot.lng === 'number'
    && regionForPoint(spot.lat, spot.lng));
}

export function toPublicSnapshotSpot(spot) {
  if (!isPublicSnapshotSpot(spot)) return null;
  const thumbnail = typeof spot.public_thumbnail_url === 'string' && /^\/public-thumbnails\/[a-zA-Z0-9_-]+\.(?:jpg|webp)$/.test(spot.public_thumbnail_url)
    ? spot.public_thumbnail_url : null;
  const summary = {
    id: spot.id, lat: Number(spot.lat), lng: Number(spot.lng),
    title: String(spot.title || '').slice(0, 100),
    resolved_title: getSpotDisplayName(spot).slice(0, 100),
    resolved_category: String(getVerifiedSpotCategory(spot) || '').slice(0, 40),
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

export function validSnapshotSpot(spot) {
  return Boolean(spot && Object.keys(spot).every(key => SUMMARY_KEYS.includes(key))
    && typeof spot.lat === 'number' && typeof spot.lng === 'number'
    && isPublicSnapshotSpot(spot) && typeof spot.title === 'string'
    && Array.isArray(spot.tags) && spot.tags.every(value => typeof value === 'string')
    && (spot.image_url === null || typeof spot.image_url === 'string' && /^\/public-thumbnails\/[a-zA-Z0-9_-]+\.(?:jpg|webp)$/.test(spot.image_url))
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
    return url.origin === origin && /^\/public-thumbnails\/[a-zA-Z0-9_-]+\.(?:jpg|webp)$/.test(url.pathname) ? url.href : '';
  } catch { return ''; }
}
import { getSpotDisplayName, getVerifiedSpotCategory } from '../lib/spotPresentation.js';

