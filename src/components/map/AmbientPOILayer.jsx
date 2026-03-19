import React, { useEffect, useState, useRef } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '';

// ---------------------------------------------------------------------------
// Category definitions — each maps to a Geoapify category string.
// Multiple Geoapify categories can be comma-joined in one request.
// ---------------------------------------------------------------------------
const AMBIENT_CATEGORIES = [
  // zoom 13+ — big landmarks visible from afar
  { key: 'train',       minZoom: 13, icon: '🚆', color: '#34495E', geo: 'public_transport.train' },
  { key: 'fuel',        minZoom: 13, icon: '⛽', color: '#E74C3C', geo: 'service.vehicle.fuel' },
  { key: 'charging',    minZoom: 13, icon: '🔌', color: '#27AE60', geo: 'service.vehicle.charging_station' },
  { key: 'hotel',       minZoom: 13, icon: '🏨', color: '#2980B9', geo: 'accommodation.hotel' },
  { key: 'museum',      minZoom: 13, icon: '🏛️', color: '#34495E', geo: 'entertainment.museum' },
  { key: 'castle',      minZoom: 13, icon: '🏰', color: '#95A5A6', geo: 'heritage.castle' },
  { key: 'hospital',    minZoom: 13, icon: '🏥', color: '#C0392B', geo: 'healthcare.hospital' },
  // zoom 15+ — neighbourhood-level
  { key: 'restaurant',  minZoom: 15, icon: '🍽️', color: '#E74C3C', geo: 'catering.restaurant' },
  { key: 'cafe',        minZoom: 15, icon: '☕', color: '#8B4513', geo: 'catering.cafe' },
  { key: 'bar',         minZoom: 15, icon: '🍺', color: '#D68910', geo: 'catering.bar' },
  { key: 'pharmacy',    minZoom: 15, icon: '💊', color: '#E67E22', geo: 'healthcare.pharmacy' },
  { key: 'bank',        minZoom: 15, icon: '🏦', color: '#F39C12', geo: 'service.financial.bank' },
  { key: 'supermarket', minZoom: 15, icon: '🏪', color: '#27AE60', geo: 'commercial.supermarket' },
  // zoom 16+ — street-level detail
  { key: 'atm',         minZoom: 16, icon: '💳', color: '#16A085', geo: 'service.financial.atm' },
  { key: 'bakery',      minZoom: 16, icon: '🥖', color: '#D4A574', geo: 'commercial.food_and_drink.bakery' },
  { key: 'parking',     minZoom: 16, icon: '🅿️', color: '#3498DB', geo: 'parking' },
  { key: 'toilets',     minZoom: 16, icon: '🚻', color: '#3498DB', geo: 'service.toilets' },
];

// Build a lookup from Geoapify category prefix → our hint object
// (Geoapify returns hierarchical categories like ["catering","catering.restaurant"])
function buildGeoLookup() {
  const map = new Map();
  for (const cat of AMBIENT_CATEGORIES) {
    map.set(cat.geo, cat);
  }
  return map;
}
const GEO_LOOKUP = buildGeoLookup();

function detectCategory(feature) {
  const cats = feature.properties?.categories || [];
  // Try most-specific first (longest string), then fall back to parent category
  const sorted = [...cats].sort((a, b) => b.length - a.length);
  for (const c of sorted) {
    if (GEO_LOOKUP.has(c)) return GEO_LOOKUP.get(c);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Icon factory
// ---------------------------------------------------------------------------
const iconCache = new Map();
function makeIcon(emoji, color, zoom) {
  const size = zoom >= 16 ? 32 : zoom >= 14 ? 28 : 24;
  const key  = `${emoji}-${color}-${size}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;font-size:${Math.round(size * 0.5)}px;line-height:1">${emoji}</div>`,
    iconSize: [size, size], iconAnchor: [size / 2, size], popupAnchor: [0, -size],
  });
  iconCache.set(key, icon);
  return icon;
}

// ---------------------------------------------------------------------------
// In-memory cache (10-minute TTL)
// ---------------------------------------------------------------------------
const reqCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Geoapify Places API — bbox fetch for all visible categories in ONE request
// ---------------------------------------------------------------------------
async function fetchGeoapifyPlaces(south, west, north, east, zoom, signal) {
  if (!GEOAPIFY_KEY) {
    console.warn('AmbientPOILayer: VITE_GEOAPIFY_KEY is not set');
    return [];
  }

  const visible = AMBIENT_CATEGORIES.filter(c => zoom >= c.minZoom);
  if (!visible.length) return [];

  const categories = visible.map(c => c.geo).join(',');
  const limit = zoom >= 16 ? 200 : zoom >= 15 ? 100 : zoom >= 14 ? 60 : 30;

  // Geoapify bbox format: rect:lon_min,lat_min,lon_max,lat_max  (west,south,east,north)
  const url =
    `https://api.geoapify.com/v2/places` +
    `?categories=${encodeURIComponent(categories)}` +
    `&filter=rect:${west},${south},${east},${north}` +
    `&limit=${limit}` +
    `&apiKey=${GEOAPIFY_KEY}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Geoapify places ${res.status}`);
  const data = await res.json();
  return data.features || [];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AmbientPOILayer({ onSelectPOI, selectedCategory }) {
  const [markers, setMarkers] = useState([]);
  const [zoom, setZoom]       = useState(13);
  const map      = useMap();
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    setZoom(map.getZoom());
    return () => map.off('zoomend', onZoom);
  }, [map]);

  useEffect(() => {
    if (selectedCategory) { setMarkers([]); return; }

    const load = async () => {
      const z = map.getZoom();
      if (z < 13) { setMarkers([]); return; }

      const b     = map.getBounds();
      const south = b.getSouth(), north = b.getNorth();
      const west  = b.getWest(),  east  = b.getEast();

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      const cacheKey = `ambient|${south.toFixed(2)}|${west.toFixed(2)}|${z}`;
      const cached   = reqCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setMarkers(cached.data);
        return;
      }

      try {
        const features = await fetchGeoapifyPlaces(south, west, north, east, z, signal);
        const result   = [];
        const seen     = new Set();

        for (const feat of features) {
          const [lon, lat] = feat.geometry?.coordinates || [];
          if (!lat || !lon) continue;

          const id = feat.properties?.place_id || `${lat.toFixed(5)}-${lon.toFixed(5)}`;
          if (seen.has(id)) continue;
          seen.add(id);

          const cat = detectCategory(feat);
          if (!cat) continue;

          const p = feat.properties || {};
          result.push({
            id, lat, lon,
            name:    p.name || p.address_line1 || cat.key,
            address: p.address_line2 || p.formatted || '',
            tags: {
              phone:         p.contact?.phone,
              website:       p.website || p.contact?.website,
              opening_hours: p.opening_hours,
            },
            _cat: cat,
          });
        }

        reqCache.set(cacheKey, { data: result, ts: Date.now() });
        if (!signal.aborted) setMarkers(result);
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('AmbientPOILayer:', e.message);
      }
    };

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(load, 800);

    const onMove = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(load, 1200);
    };
    map.on('moveend', onMove);
    map.on('zoomend', onMove);

    return () => {
      map.off('moveend', onMove);
      map.off('zoomend', onMove);
      clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [map, selectedCategory]);

  return (
    <>
      {markers.map(poi => (
        <Marker
          key={`ambient-${poi._cat.key}-${poi.id}`}
          position={[poi.lat, poi.lon]}
          icon={makeIcon(poi._cat.icon, poi._cat.color, zoom)}
          eventHandlers={{ click: () => onSelectPOI?.(poi, poi._cat) }}
        />
      ))}
    </>
  );
}