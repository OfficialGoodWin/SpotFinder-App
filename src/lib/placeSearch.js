import { searchMapySuggestions } from '@/api/mapyPOIService';

const languageCode = language => String(language || 'en').toLowerCase().split('-')[0];

const validPosition = position => Number.isFinite(Number(position?.lat)) && Number.isFinite(Number(position?.lon ?? position?.lng));

function normalizeNominatim(item, language) {
  const lang = languageCode(language);
  const name = item.namedetails?.[`name:${lang}`]
    || item.name
    || item.display_name?.split(',')[0]
    || item.namedetails?.name
    || '';
  return {
    id: `osm:${item.osm_type || ''}:${item.osm_id || item.place_id}`,
    provider: 'OpenStreetMap',
    name,
    location: item.display_name?.split(',').slice(1).join(',').trim() || '',
    position: { lat: Number(item.lat), lon: Number(item.lon) },
    kind: item.type || item.category || 'place',
  };
}

function normalizeMapy(item) {
  const position = item.position || item.regionalStructure?.find(entry => validPosition(entry)) || {};
  return {
    id: `mapy:${item.id || `${position.lat}:${position.lon ?? position.lng}`}`,
    provider: 'Mapy.com',
    name: item.name || item.label || '',
    location: item.location || item.regionalStructure?.map(entry => entry.name).filter(Boolean).join(', ') || '',
    position: { lat: Number(position.lat), lon: Number(position.lon ?? position.lng) },
    kind: item.type || 'poi',
  };
}

const dedupe = items => {
  const seen = new Set();
  return items.filter(item => {
    if (!item.name || !validPosition(item.position)) return false;
    const key = `${item.name.toLocaleLowerCase()}|${item.position.lat.toFixed(4)}|${item.position.lon.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export async function searchPlaces(query, { center, language = 'en', signal, limit = 10 } = {}) {
  const lang = languageCode(language);
  const params = new URLSearchParams({
    format: 'jsonv2', q: query, limit: '8', addressdetails: '1', namedetails: '1',
    'accept-language': lang,
  });
  if (center) { params.set('lat', center.lat); params.set('lon', center.lng); }

  const sources = await Promise.allSettled([
    fetch(`/nominatim/search?${params}`, { signal }).then(response => {
      if (!response.ok) throw new Error(`Nominatim search failed (${response.status})`);
      return response.json();
    }),
    searchMapySuggestions(query, center, lang, 8, signal),
  ]);
  if (signal?.aborted) return [];
  const osm = sources[0].status === 'fulfilled' ? sources[0].value.map(item => normalizeNominatim(item, lang)) : [];
  const mapy = sources[1].status === 'fulfilled' ? sources[1].value.map(normalizeMapy) : [];
  return dedupe([...mapy, ...osm]).slice(0, limit);
}

