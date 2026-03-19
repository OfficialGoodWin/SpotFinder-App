import React, { useEffect, useState, useRef } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

const MAPY_API_KEY = import.meta.env.VITE_MAPY_API_KEY || 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';

// ---------------------------------------------------------------------------
// Category hints matched against Mapy.cz `type` / `category` / `name`.
// We join all three into one string and do substring search. The `words`
// list uses simple tokens so they work across all possible Mapy.cz formats.
// ---------------------------------------------------------------------------
const CAT_HINTS = [
  { key: 'train',       minZoom: 13, icon: '🚆', color: '#34495E', words: ['railway', 'train_station', 'nádraží', 'bahnhof', 'gare', 'stacja'] },
  { key: 'fuel',        minZoom: 13, icon: '⛽', color: '#E74C3C', words: ['fuel', 'petrol', 'gas_station', 'čerpací', 'tankstelle'] },
  { key: 'charging',    minZoom: 13, icon: '🔌', color: '#27AE60', words: ['charging_station', 'electric_vehicle', 'nabíjecí', 'ladestation'] },
  { key: 'hotel',       minZoom: 13, icon: '🏨', color: '#2980B9', words: ['hotel', 'accommodation', 'ubytování', 'unterkunft'] },
  { key: 'museum',      minZoom: 13, icon: '🏛️', color: '#34495E', words: ['museum', 'muzeum', 'musée', 'museo'] },
  { key: 'castle',      minZoom: 13, icon: '🏰', color: '#95A5A6', words: ['castle', 'hrad', 'château', 'schloss', 'zamek'] },
  { key: 'hospital',    minZoom: 13, icon: '🏥', color: '#C0392B', words: ['hospital', 'nemocnice', 'krankenhaus', 'szpital'] },
  { key: 'restaurant',  minZoom: 15, icon: '🍽️', color: '#E74C3C', words: ['restaurant', 'restaurace', 'ristorante', 'restauracja'] },
  { key: 'cafe',        minZoom: 15, icon: '☕', color: '#8B4513', words: ['cafe', 'coffee', 'kavárna', 'caffè', 'kawiarnia'] },
  { key: 'bar',         minZoom: 15, icon: '🍺', color: '#D68910', words: ['bar', 'pub', 'hospoda', 'kneipe', 'brasserie'] },
  { key: 'pharmacy',    minZoom: 15, icon: '💊', color: '#E67E22', words: ['pharmacy', 'lékárna', 'apotheke', 'farmacia', 'apteka'] },
  { key: 'supermarket', minZoom: 15, icon: '🏪', color: '#27AE60', words: ['supermarket', 'grocery', 'potraviny', 'spożywczy'] },
  { key: 'atm',         minZoom: 16, icon: '💳', color: '#16A085', words: ['atm', 'bankomat', 'geldautomat', 'cajero'] },
  { key: 'bakery',      minZoom: 16, icon: '🥖', color: '#D4A574', words: ['bakery', 'pekárna', 'bäckerei', 'boulangerie'] },
  { key: 'parking',     minZoom: 16, icon: '🅿️', color: '#3498DB', words: ['parking', 'parkoviště', 'parkplatz'] },
  { key: 'toilets',     minZoom: 16, icon: '🚻', color: '#3498DB', words: ['toilet', 'restroom', 'záchod', 'toilette'] },
  // bank last — very short word, needs to not shadow bakery/bankomat
  { key: 'bank',        minZoom: 15, icon: '🏦', color: '#F39C12', words: ['bank'] },
];

function detectCategory(item, zoom) {
  const typeStr = (item.type || item.category || '').toLowerCase();
  const nameStr = (item.name || item.label || '').toLowerCase();

  // Check structured type/category field first (more reliable)
  for (const hint of CAT_HINTS) {
    if (zoom < hint.minZoom) continue;
    if (hint.words.some(w => typeStr.includes(w))) return hint;
  }
  // Fall back to name (less reliable but catches e.g. "Kavárna XYZ")
  for (const hint of CAT_HINTS) {
    if (zoom < hint.minZoom) continue;
    if (hint.words.some(w => nameStr.includes(w))) return hint;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Icon factory (div-based, emoji-coloured circle, cached)
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
// In-memory request cache (10-minute TTL)
// ---------------------------------------------------------------------------
const reqCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Mapy.cz Places API — returns all POIs in a bounding box
// ---------------------------------------------------------------------------
async function fetchMapyPlaces(south, west, north, east, zoom, signal) {
  const limit = zoom >= 16 ? 200 : zoom >= 15 ? 100 : zoom >= 14 ? 60 : 30;
  const url =
    `https://api.mapy.com/v1/places` +
    `?apikey=${MAPY_API_KEY}` +
    `&bbox=${west},${south},${east},${north}` +
    `&limit=${limit}` +
    `&lang=en`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Mapy.cz places ${res.status}`);
  const data = await res.json();
  return data.items || [];
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
        const items  = await fetchMapyPlaces(south, west, north, east, z, signal);
        const result = [];
        const seen   = new Set();

        for (const item of items) {
          const lat = item.position?.lat ?? item.lat;
          const lon = item.position?.lon ?? item.position?.lng ?? item.lon ?? item.lng;
          if (!lat || !lon) continue;

          const id = item.id || `${lat.toFixed(5)}-${lon.toFixed(5)}`;
          if (seen.has(id)) continue;
          seen.add(id);

          const cat = detectCategory(item, z);
          if (!cat) continue;

          result.push({
            id, lat, lon,
            name:    item.name || item.label || '',
            address: item.location || '',
            tags:    {},
            _cat:    cat,
            mapyId:  item.id,
            source:  item.source,
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