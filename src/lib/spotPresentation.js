const GENERIC_TITLES = new Set(['spot', 'place', 'location', 'point', 'poi']);

const TAG_LABELS = {
  Viewpoint: 'viewpoint',
  SecretCafe: 'café',
  Sunset: 'sunset spot',
  Sunrise: 'sunrise spot',
  PhotoSpot: 'photo spot',
  Waterfall: 'waterfall',
  Hike: 'hiking spot',
  SwimSpot: 'swimming spot',
  Ruin: 'historic ruin',
  UrbanExplore: 'urban discovery',
  Mountain: 'mountain spot',
};

const TYPE_LABELS = {
  parking: 'parking area',
  food: 'food stop',
  toilet: 'public toilet',
  viewpoint: 'viewpoint',
  general: 'place',
};

export function isMeaningfulSpotTitle(value) {
  const title = String(value || '').replace(/\s+/g, ' ').trim();
  return title.length >= 2 && !GENERIC_TITLES.has(title.toLocaleLowerCase());
}

export function getSpotDisplayName(spot = {}) {
  const title = String(spot.title || spot.name || '').replace(/\s+/g, ' ').trim();
  if (isMeaningfulSpotTitle(title)) return title;

  const poiName = String(spot.poi_match?.name || '').replace(/\s+/g, ' ').trim();
  if (isMeaningfulSpotTitle(poiName)) return poiName;

  const tag = Array.isArray(spot.tags) ? spot.tags.find(item => TAG_LABELS[item]) : null;
  const category = tag ? TAG_LABELS[tag] : TYPE_LABELS[spot.spot_type];
  return `Unnamed ${category || 'place'}`;
}

export function getSpotLocationLabel(spot = {}, coordinatePrecision = 3) {
  const label = spot.locality || spot.location || spot.address || spot.city || spot.region ||
    spot.poi_match?.locality || spot.poi_match?.address;
  if (String(label || '').trim()) return String(label).trim();

  const lat = Number(spot.lat);
  const lng = Number(spot.lng ?? spot.lon);
  return Number.isFinite(lat) && Number.isFinite(lng)
    ? `${lat.toFixed(coordinatePrecision)}, ${lng.toFixed(coordinatePrecision)}`
    : 'Location unavailable';
}

