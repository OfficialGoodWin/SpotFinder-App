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

      const visible = AMBIENT_CATEGORIES.filter(c => z >= c.minZoom);
      if (!visible.length) { setMarkers([]); return; }

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      const cacheKey = `ambient|${south.toFixed(2)}|${west.toFixed(2)}|${z}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) { setMarkers(cached.data); return; }

      const limit = z >= 16 ? 10 : z >= 14 ? 6 : 4;

      // Build ONE combined Overpass query for all visible categories
      const bbox = `(${south},${west},${north},${east})`;
      const parts = visible.map(cat => {
        const eq = cat.osmTag.indexOf('=');
        const filter = eq !== -1
          ? `["${cat.osmTag.slice(0,eq)}"="${cat.osmTag.slice(eq+1)}"]`
          : `["${cat.osmTag}"]`;
        return `node${filter}${bbox};way${filter}${bbox};`;
      }).join('');
      const query = `[out:json][timeout:15];(${parts});out center ${limit * visible.length};`;

      try {
        let res = null;
        for (const ep of OVERPASS_MIRRORS) {
          try {
            res = await fetch(ep, { method:'POST', body:query, signal, headers:{'Content-Type':'text/plain'} });
            if (res.ok) break;
          } catch(e) { if (e.name==='AbortError') throw e; }
        }
        if (!res?.ok) return;
        const data = await res.json();

        // Map each element back to its category by matching OSM tags
        const all = [];
        for (const el of data.elements || []) {
          const lat = el.lat ?? el.center?.lat;
          const lon = el.lon ?? el.center?.lon;
          if (!lat || !lon) continue;

          // Find which ambient category this element belongs to
          const cat = visible.find(c => {
            const eq = c.osmTag.indexOf('=');
            if (eq !== -1) {
              const k = c.osmTag.slice(0, eq), v = c.osmTag.slice(eq+1);
              return el.tags?.[k] === v;
            }
            return el.tags?.[c.osmTag] !== undefined;
          });
          if (!cat) continue;

          all.push({ id: el.id, lat, lon, name: el.tags?.name || '', address: el.tags?.['addr:street'] ? `${el.tags['addr:street']} ${el.tags['addr:housenumber']||''}`.trim() : '', tags: el.tags||{}, _cat: cat });
        }

        cache.set(cacheKey, { data: all, ts: Date.now() });
        if (!signal.aborted) setMarkers(all);
      } catch(e) {
        if (e.name !== 'AbortError') console.warn('ambient POI error:', e.message);
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
          key={`ambient-${poi._cat.osmTag}-${poi.id}`}
          position={[poi.lat, poi.lon]}
          icon={makeIcon(poi._cat.icon, poi._cat.color, zoom)}
          eventHandlers={{ click: () => onSelectPOI?.(poi, poi._cat) }}
        />
      ))}
    </>
  );
}