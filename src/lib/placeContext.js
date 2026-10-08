const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '';

const SHARE_TEMPLATES = {
  en: place => `Look at the spot I found in ${place}!`,
  cs: place => `Podívej se na místo, které jsem našel v ${place}!`,
  sk: place => `Pozri sa na miesto, ktoré som našiel v ${place}!`,
  de: place => `Schau dir den Ort an, den ich in ${place} gefunden habe!`,
  pl: place => `Zobacz miejsce, które znalazłem w ${place}!`,
  fr: place => `Regarde l’endroit que j’ai trouvé à ${place} !`,
  it: place => `Guarda il posto che ho trovato a ${place}!`,
  es: place => `¡Mira el lugar que encontré en ${place}!`,
  uk: place => `Подивись на місце, яке я знайшов у ${place}!`,
  ru: place => `Посмотри на место, которое я нашёл в ${place}!`,
  hu: place => `Nézd meg a helyet, amit itt találtam: ${place}!`,
  ro: place => `Uită-te la locul pe care l-am găsit în ${place}!`,
  bg: place => `Виж мястото, което намерих в ${place}!`,
};

export async function reversePlaceContext(lat, lon, language = 'en') {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return '';
  const lang = String(language || 'en').slice(0, 2);
  try {
    if (GEOAPIFY_KEY) {
      const params = new URLSearchParams({ lat, lon, lang, limit: '1', format: 'json', apiKey: GEOAPIFY_KEY });
      const response = await fetch(`https://api.geoapify.com/v1/geocode/reverse?${params}`);
      if (response.ok) {
        const row = (await response.json()).results?.[0] || {};
        return [...new Set([row.country, row.state, row.county || row.city || row.district].filter(Boolean))].join(', ');
      }
    }
    const params = new URLSearchParams({ format: 'jsonv2', lat, lon, zoom: '10', addressdetails: '1', 'accept-language': lang });
    const response = await fetch(`/nominatim/reverse?${params}`);
    if (!response.ok) return '';
    const address = (await response.json()).address || {};
    return [...new Set([address.country, address.state, address.county || address.city || address.town].filter(Boolean))].join(', ');
  } catch { return ''; }
}

export function localizedShareMessage(language, place, fallback = 'this area') {
  return (SHARE_TEMPLATES[language] || SHARE_TEMPLATES.en)(place || fallback);
}

export async function nearestParking(lat, lon, language = 'en') {
  if (!GEOAPIFY_KEY) return null;
  const params = new URLSearchParams({
    categories: 'parking', filter: `circle:${lon},${lat},5000`, bias: `proximity:${lon},${lat}`,
    limit: '1', lang: String(language || 'en').slice(0, 2), apiKey: GEOAPIFY_KEY,
  });
  try {
    const response = await fetch(`https://api.geoapify.com/v2/places?${params}`);
    if (!response.ok) return null;
    const feature = (await response.json()).features?.[0];
    const [parkingLon, parkingLat] = feature?.geometry?.coordinates || [];
    if (!Number.isFinite(parkingLat) || !Number.isFinite(parkingLon)) return null;
    return { lat: parkingLat, lng: parkingLon, label: feature.properties?.name || feature.properties?.address_line1 || 'Parking' };
  } catch { return null; }
}
