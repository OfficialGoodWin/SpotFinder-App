const GENERIC_TITLES = new Set(['spot', 'place', 'location', 'point', 'poi']);
const GENERATED_TITLE = /^unnamed(?:\s+.+)?$/i;

const TAG_LABELS = {
  Viewpoint: 'viewpoint', SecretCafe: 'café', Sunset: 'sunset spot', Sunrise: 'sunrise spot',
  PhotoSpot: 'photo spot', Waterfall: 'waterfall', Hike: 'hiking spot', SwimSpot: 'swimming spot',
  Ruin: 'historic ruin', UrbanExplore: 'urban discovery', Mountain: 'mountain spot',
};

const TYPE_LABELS = {
  parking: 'parking area', food: 'food stop', toilet: 'public toilet', viewpoint: 'viewpoint',
  castle: 'castle', historic: 'historic site', general: 'place',
};

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

export function isMeaningfulSpotTitle(value) {
  const title = cleanText(value);
  return title.length >= 2
    && !GENERIC_TITLES.has(title.toLocaleLowerCase())
    && !GENERATED_TITLE.test(title);
}

function associatedPoi(spot) {
  return spot?.poi_match || spot?.linked_poi || spot?.osm_feature || null;
}

function localizedPoiName(poi, language = 'en') {
  if (!poi || typeof poi !== 'object') return '';
  if (poi.match_confidence === 'review') return '';
  const tags = poi.tags && typeof poi.tags === 'object' ? poi.tags : {};
  const names = poi.names && typeof poi.names === 'object' ? poi.names : {};
  return [names[language], tags[`name:${language}`], poi.name, poi.title, names.en, tags['name:en'], tags.name]
    .map(cleanText).find(isMeaningfulSpotTitle) || '';
}

function verifiedWikidataLabel(poi, language = 'en') {
  if (!poi || typeof poi !== 'object') return '';
  const distance = Number(poi.distance_m ?? poi.match_distance_m);
  const geographicallyVerified = poi.wikidata_location_verified === true
    || poi.match_confidence === 'exact'
    || poi.match_confidence === 'high'
    || (Boolean(poi.wikidata || poi.tags?.wikidata) && Number.isFinite(distance) && distance <= 150);
  if (!geographicallyVerified) return '';
  const labels = poi.wikidata_labels && typeof poi.wikidata_labels === 'object' ? poi.wikidata_labels : {};
  return [labels[language], poi.wikidata_label, labels.en].map(cleanText).find(isMeaningfulSpotTitle) || '';
}

export function getVerifiedSpotCategory(spot = {}) {
  const poi = associatedPoi(spot) || {};
  const reliablePoi = poi.match_confidence !== 'review';
  const tags = { ...(spot.osm_tags || {}), ...(reliablePoi ? poi.tags || {} : {}) };
  const categories = (reliablePoi ? [poi.category, ...(Array.isArray(poi.categories) ? poi.categories : [])] : [])
    .map(value => cleanText(value).toLowerCase());
  const historic = cleanText(tags.historic).toLowerCase();
  const tourism = cleanText(tags.tourism).toLowerCase();
  const natural = cleanText(tags.natural).toLowerCase();

  // Objective POI tags win over subjective discovery tags. A castle with a
  // scenic photograph must not become a viewpoint merely because of that tag.
  if (historic === 'castle' || tags.castle_type || categories.some(value => /(^|\.)castle($|\.)|heritage\.castle/.test(value))) return 'castle';
  if (['ruins', 'archaeological_site'].includes(historic) || categories.some(value => /ruins|archaeological/.test(value))) return 'historic ruin';
  if (historic || categories.some(value => value.startsWith('heritage'))) return 'historic site';
  if (tourism === 'viewpoint' || categories.some(value => /viewpoint/.test(value))) return 'viewpoint';
  if (natural === 'waterfall' || categories.some(value => /waterfall/.test(value))) return 'waterfall';

  const discoveryTag = Array.isArray(spot.tags) ? spot.tags.find(item => TAG_LABELS[item]) : null;
  return discoveryTag ? TAG_LABELS[discoveryTag] : TYPE_LABELS[spot.spot_type] || null;
}

export function resolveSpotTitle(spot = {}, language = 'en') {
  const explicit = [spot.title, spot.resolved_title, spot.displayName, spot.display_name, spot.spot_name, spot.name]
    .map(cleanText).find(isMeaningfulSpotTitle);
  if (explicit) return { title: explicit, source: 'user_or_legacy_name', confidence: 'high' };

  const poi = associatedPoi(spot);
  const poiName = localizedPoiName(poi, language);
  if (poiName) return { title: poiName, source: 'associated_poi', confidence: 'high' };

  const wikidata = verifiedWikidataLabel(poi, language);
  if (wikidata) return { title: wikidata, source: 'wikidata_geographic_match', confidence: 'high' };

  const category = getVerifiedSpotCategory(spot);
  return {
    title: `Unnamed ${category || 'place'}`,
    source: category ? 'verified_category_fallback' : 'neutral_fallback',
    confidence: category ? 'medium' : 'low',
  };
}

export function getSpotDisplayName(spot = {}, language = 'en') {
  return resolveSpotTitle(spot, language).title;
}

const looksLikeCoordinates = (value) => /^\s*-?\d{1,2}(?:\.\d+)?\s*[,;/]\s*-?\d{1,3}(?:\.\d+)?\s*$/.test(String(value || ''));

export function getSpotLocationLabel(spot = {}, coordinatePrecision = 4) {
  const poi = associatedPoi(spot) || {};
  const label = [
    spot.locality, spot.city, spot.town, spot.village, spot.municipality, spot.region, spot.location, spot.address,
    poi.locality, poi.city, poi.town, poi.village, poi.municipality, poi.region, poi.address,
  ].map(cleanText).find(value => value && !looksLikeCoordinates(value));
  if (label) return label;

  const lat = Number(spot.lat);
  const lng = Number(spot.lng ?? spot.lon);
  return Number.isFinite(lat) && Number.isFinite(lng)
    ? `${lat.toFixed(coordinatePrecision)}, ${lng.toFixed(coordinatePrecision)}`
    : 'Location unavailable';
}

export function getSpotImageInfo(spot = {}) {
  const candidates = [...(Array.isArray(spot.image_urls) ? spot.image_urls : []), spot.image_url].filter(Boolean);
  const url = candidates.find(value => {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  });
  if (!url) return null;
  const metadata = Array.isArray(spot.photo_metadata)
    ? spot.photo_metadata.find(item => item?.url === url) || null
    : null;
  return {
    url,
    source: metadata?.source || 'legacy_unknown',
    creator: metadata?.creator || null,
    permissionBasis: metadata?.permission_basis || null,
    attribution: metadata?.attribution || null,
    sourceUrl: metadata?.source_url || null,
    locationMatchConfidence: metadata?.location_match_confidence || 'unreviewed',
    needsReview: !metadata || metadata.location_match_confidence === 'unverified',
  };
}

