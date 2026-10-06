const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '';
const MAX_POI_DISTANCE_METERS = 40;
const POI_CATEGORIES = [
  'accommodation', 'catering', 'commercial', 'education', 'entertainment',
  'healthcare', 'heritage', 'leisure', 'natural', 'religion', 'service',
];

const text = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function distanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = value => value * Math.PI / 180;
  const radius = 6371000;
  const latDelta = toRad(lat2 - lat1);
  const lonDelta = toRad(lon2 - lon1);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(lonDelta / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

function commonsImage(tags) {
  const value = text(tags.wikimedia_commons, 300);
  if (!value.startsWith('File:')) return null;
  const file = value.slice(5);
  return {
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1200`,
    credit: 'Photo via Wikimedia Commons',
  };
}

const TAG_KEYS = [
  'website', 'contact:website', 'phone', 'contact:phone', 'email', 'contact:email',
  'opening_hours', 'description', 'wikipedia', 'wikidata', 'wikimedia_commons',
  'brand', 'operator', 'tourism', 'amenity', 'historic', 'leisure', 'natural',
];

function normalizedTags(properties) {
  const raw = properties?.datasource?.raw || {};
  const result = {};
  for (const key of TAG_KEYS) {
    const value = text(properties?.[key] ?? raw[key]);
    if (value) result[key] = value;
  }
  return result;
}

/**
 * Finds a named POI extremely close to a submitted spot. The result is a
 * deliberately bounded snapshot so spot documents do not inherit an
 * unbounded third-party payload.
 */
export async function findNearbyPoi(lat, lon, language = 'en') {
  if (!GEOAPIFY_KEY || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const params = new URLSearchParams({
    categories: POI_CATEGORIES.join(','),
    filter: `circle:${lon},${lat},${MAX_POI_DISTANCE_METERS}`,
    bias: `proximity:${lon},${lat}`,
    limit: '5',
    lang: String(language || 'en').slice(0, 2),
    apiKey: GEOAPIFY_KEY,
  });
  const response = await fetch(`https://api.geoapify.com/v2/places?${params}`);
  if (!response.ok) throw new Error(`Nearby POI lookup failed (${response.status})`);
  const places = (await response.json()).features || [];

  const candidates = places
    .map(feature => {
      const properties = feature.properties || {};
      const poiLat = Number(properties.lat ?? feature.geometry?.coordinates?.[1]);
      const poiLon = Number(properties.lon ?? feature.geometry?.coordinates?.[0]);
      return { feature, properties, poiLat, poiLon, distance: distanceMeters(lat, lon, poiLat, poiLon) };
    })
    .filter(item => text(item.properties.name, 150) && Number.isFinite(item.distance) && item.distance <= MAX_POI_DISTANCE_METERS)
    .sort((a, b) => a.distance - b.distance);

  if (!candidates.length) return null;
  const nearest = candidates[0];
  let properties = nearest.properties;

  if (properties.place_id) {
    try {
      const detailsParams = new URLSearchParams({
        id: properties.place_id,
        features: 'details',
        lang: String(language || 'en').slice(0, 2),
        apiKey: GEOAPIFY_KEY,
      });
      const detailsResponse = await fetch(`https://api.geoapify.com/v2/place-details?${detailsParams}`);
      if (detailsResponse.ok) {
        const details = (await detailsResponse.json()).features?.find(feature => feature.properties?.feature_type === 'details');
        if (details?.properties) properties = { ...nearest.properties, ...details.properties };
      }
    } catch {
      // The nearby match is still useful when optional details are unavailable.
    }
  }

  const tags = normalizedTags(properties);
  const image = commonsImage(tags);
  return {
    place_id: text(properties.place_id, 250),
    name: text(properties.name, 150),
    address: text(properties.formatted || properties.address_line1, 300),
    distance_m: Math.round(nearest.distance),
    lat: nearest.poiLat,
    lon: nearest.poiLon,
    categories: Array.isArray(properties.categories) ? properties.categories.filter(value => typeof value === 'string').slice(0, 20) : [],
    tags,
    image_url: image?.url || null,
    image_credit: image?.credit || null,
  };
}

