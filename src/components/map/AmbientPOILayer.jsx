import React, { useEffect, useState, useRef } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

// Which categories to show at each zoom level (ambient, no search required)
// Only show the most universally useful ones to avoid clutter
const AMBIENT_CATEGORIES = [
  // zoom 13+ — big infrastructure
  { osmTag: 'railway=station',          icon: '🚆', color: '#34495E', minZoom: 13 },
  { osmTag: 'amenity=fuel',             icon: '⛽', color: '#E74C3C', minZoom: 13 },
  { osmTag: 'amenity=charging_station', icon: '🔌', color: '#27AE60', minZoom: 13 },
  { osmTag: 'tourism=hotel',            icon: '🏨', color: '#2980B9', minZoom: 13 },
  { osmTag: 'tourism=museum',           icon: '🏛️', color: '#34495E', minZoom: 13 },
  { osmTag: 'historic=castle',          icon: '🏰', color: '#95A5A6', minZoom: 13 },
  { osmTag: 'amenity=hospital',         icon: '🏥', color: '#C0392B', minZoom: 13 },
  // zoom 14+ — neighbourhood
  { osmTag: 'amenity=restaurant',       icon: '🍽️', color: '#E74C3C', minZoom: 15 },
  { osmTag: 'amenity=cafe',             icon: '☕', color: '#8B4513', minZoom: 15 },
  { osmTag: 'amenity=bar',              icon: '🍺', color: '#D68910', minZoom: 15 },
  { osmTag: 'amenity=pharmacy',         icon: '💊', color: '#E67E22', minZoom: 15 },
  { osmTag: 'amenity=bank',             icon: '🏦', color: '#F39C12', minZoom: 15 },
  { osmTag: 'amenity=atm',              icon: '💳', color: '#16A085', minZoom: 16 },
  { osmTag: 'shop=supermarket',         icon: '🏪', color: '#27AE60', minZoom: 15 },
  { osmTag: 'shop=bakery',              icon: '🥖', color: '#D4A574', minZoom: 16 },
  { osmTag: 'amenity=parking',          icon: '🅿️', color: '#3498DB', minZoom: 16 },
  { osmTag: 'amenity=toilets',          icon: '🚻', color: '#3498DB', minZoom: 16 },
];

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const iconCache = new Map();
function makeIcon(emoji, color, zoom) {
  const size = zoom >= 16 ? 32 : zoom >= 14 ? 28 : 24;
  const key = `${emoji}-${color}-${size}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const icon = L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer;font-size:${Math.round(size*0.5)}px;line-height:1">${emoji}</div>`,
    iconSize: [size, size], iconAnchor: [size/2, size], popupAnchor: [0, -size],
  });
  iconCache.set(key, icon);
  return icon;
}

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

async function fetchPOIs(osmTag, south, west, north, east, limit, signal) {
  const eq = osmTag.indexOf('=');
  const filter = eq !== -1
    ? `["${osmTag.slice(0,eq)}"="${osmTag.slice(eq+1)}"]`
    : `["${osmTag}"]`;
  const query = `[out:json][timeout:10];(node${filter}(${south},${west},${north},${east});way${filter}(${south},${west},${north},${east}););out center ${limit};`;
  
  for (const ep of OVERPASS_MIRRORS) {
    try {
      const r = await fetch(ep, { method:'POST', body:query, signal, headers:{'Content-Type':'text/plain'} });
      if (!r.ok) continue;
      const d = await r.json();
      return (d.elements||[]).map(el => {
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (!lat||!lon) return null;
        return { id: el.id, lat, lon, name: el.tags?.name || '', address: el.tags?.['addr:street'] ? `${el.tags['addr:street']} ${el.tags['addr:housenumber']||''}`.trim() : '', tags: el.tags||{} };
      }).filter(Boolean);
    } catch(e) {
      if (e.name==='AbortError') throw e;
    }
  }
  return [];
}

export default function AmbientPOILayer({ onSelectPOI, selectedCategory }) {
  const [markers, setMarkers] = useState([]);
  const [zoom, setZoom] = useState(13);
  const map = useMap();
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    setZoom(map.getZoom());
    return () => map.off('zoomend', onZoom);
  }, [map]);

  useEffect(() => {
    // Don't show ambient POIs when a category search is active
    if (selectedCategory) { setMarkers([]); return; }

    const load = async () => {
      const z = map.getZoom();
      const b = map.getBounds();
      const south = b.getSouth(), north = b.getNorth(), west = b.getWest(), east = b.getEast();

      // Which categories are visible at this zoom?
      const visible = AMBIENT_CATEGORIES.filter(c => z >= c.minZoom);
      if (!visible.length) { setMarkers([]); return; }

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      const limit = z >= 16 ? 15 : z >= 14 ? 10 : 6;
      const all = [];

      await Promise.all(visible.map(async cat => {
        const key = `${cat.osmTag}|${south.toFixed(2)}|${west.toFixed(2)}|${z}`;
        const cached = cache.get(key);
        if (cached && Date.now() - cached.ts < CACHE_TTL) { all.push(...cached.data); return; }
        try {
          const pois = await fetchPOIs(cat.osmTag, south, west, north, east, limit, signal);
          const tagged = pois.map(p => ({ ...p, _cat: cat }));
          cache.set(key, { data: tagged, ts: Date.now() });
          all.push(...tagged);
        } catch(e) { if (e.name !== 'AbortError') console.warn('ambient POI error:', e.message); }
      }));

      if (!signal.aborted) setMarkers(all);
    };

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(load, 400);

    const onMove = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(load, 600);
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
          key={`ambient-${poi._cat.osmTag}-${poi.id}`}
          position={[poi.lat, poi.lon]}
          icon={makeIcon(poi._cat.icon, poi._cat.color, zoom)}
          eventHandlers={{ click: () => onSelectPOI?.(poi, poi._cat) }}
        />
      ))}
    </>
  );
}
