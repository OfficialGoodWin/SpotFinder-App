import React, { useEffect, useState, useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// ─── Icon SVGs ────────────────────────────────────────────────────────────────
function getIconSVG(iconName) {
  const paths = {
    school: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path>',
    restaurant: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path>',
    cafe: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"></path><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path><line x1="6" x2="6" y1="2" y2="4"></line><line x1="10" x2="10" y1="2" y2="4"></line><line x1="14" x2="14" y1="2" y2="4"></line>',
    shop: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path>',
    supermarket: '<circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>',
    wc: '<rect width="14" height="6" x="5" y="16" rx="2"></rect><rect width="10" height="6" x="7" y="2" rx="2"></rect><path d="M22 12h-2"></path><path d="M4 12H2"></path>',
    bank: '<path d="m16 6 4 14"></path><path d="M12 6v14"></path><path d="M8 8v12"></path><path d="M4 4v16"></path>',
    atm: '<rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" x2="22" y1="10" y2="10"></line>',
    pharmacy: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"></path><path d="m8.5 8.5 7 7"></path>',
    hospital: '<path d="M12 6v4"></path><path d="M14 14h-4"></path><path d="M14 18h-4"></path><path d="M14 8h-4"></path><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path><path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"></path>',
    parking: '<circle cx="12" cy="12" r="10"></circle><path d="M9 17V7h4a3 3 0 0 1 0 6H9"></path>',
    fuel: '<path d="M3 22h12"></path><path d="M4 9h10"></path><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"></path><path d="m14 13 5.5-5.5a2.12 2.12 0 0 1 3 3L17 16v6"></path><path d="M14 13h6"></path>',
    charging: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"></path>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle>',
  };
  return paths[iconName] || '<circle cx="12" cy="12" r="10"></circle><path d="M12 8v8"></path><path d="M8 12h8"></path>';
}

const createPOIIcon = (iconName, color) => {
  const svgPath = getIconSVG(iconName);
  return L.divIcon({
    className: 'custom-poi-marker',
    html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>
    </div>`,
    iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32],
  });
};

// ─── Spatial grid distribution ────────────────────────────────────────────────
// Divides the bbox into a GRID_SIZE × GRID_SIZE grid and keeps at most
// SLOTS_PER_CELL POIs per cell, then caps the total at MAX_DISPLAY.
// This spreads results evenly across the visible map instead of clustering.
const GRID_SIZE    = 5;   // 5×5 = 25 cells
const SLOTS_PER_CELL = 2; // max 2 per cell → max 50 candidates, capped at 30
const MAX_DISPLAY  = 30;

function distributeEvenly(pois, south, west, north, east) {
  if (pois.length <= MAX_DISPLAY) return pois;

  const latStep = (north - south) / GRID_SIZE;
  const lngStep = (east  - west)  / GRID_SIZE;
  const grid    = new Map(); // "row_col" → [poi, ...]

  for (const poi of pois) {
    const row = Math.min(Math.floor((poi.lat - south) / latStep), GRID_SIZE - 1);
    const col = Math.min(Math.floor((poi.lon - west)  / lngStep), GRID_SIZE - 1);
    const key = `${row}_${col}`;
    const cell = grid.get(key) || [];
    if (cell.length < SLOTS_PER_CELL) {
      cell.push(poi);
      grid.set(key, cell);
    }
  }

  const result = [];
  for (const cell of grid.values()) result.push(...cell);
  return result.slice(0, MAX_DISPLAY);
}

// ─── Geoapify Places API ──────────────────────────────────────────────────────
const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '';

async function fetchGeoapify(category, south, west, north, east, limit, signal) {
  if (!GEOAPIFY_KEY) throw new Error('VITE_GEOAPIFY_KEY not set');
  const url = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(category)}&filter=rect:${west},${south},${east},${north}&limit=${limit}&apiKey=${GEOAPIFY_KEY}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Geoapify ${res.status}`);
  const data = await res.json();
  return (data.features || []).map(f => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    return {
      id: p.place_id || `geo_${lat}_${lon}`,
      lat, lon,
      name: p.name || p.address_line1 || category,
      address: p.address_line2 || p.formatted || '',
      tags: {
        phone:         p.phone       || p.contact?.phone,
        website:       p.website     || p.contact?.website,
        email:         p.email       || p.contact?.email,
        opening_hours: p.opening_hours,
        description:   p.description || p.details?.description,
      },
    };
  });
}

// ─── Overpass fallback (for categories with no Geoapify equivalent) ───────────
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

async function fetchOverpass(queryStr, signal) {
  for (const endpoint of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST', body: queryStr, signal,
        headers: { 'Content-Type': 'text/plain' },
      });
      if (res.ok) return res;
      console.warn(`Overpass ${endpoint} → ${res.status}, trying next`);
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn(`Overpass ${endpoint} failed: ${err.message}, trying next`);
    }
  }
  throw new Error('All Overpass mirrors failed');
}

// ─── Cache ────────────────────────────────────────────────────────────────────
const poiCache = new Map();
const CACHE_DURATION = 600000; // 10 minutes

// ─── Component ────────────────────────────────────────────────────────────────
export default function POILayer({ category, onNavigate, onPOIsLoaded, onLoadingChange, onSelectPOI }) {
  const [pois, setPois] = useState([]);
  const map = useMap();
  const loadTimeoutRef    = useRef(null);
  const lastRequestRef    = useRef(0);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (!category) {
      setPois([]);
      onPOIsLoaded?.([]);
      onLoadingChange?.(false);
      return;
    }

    const loadPOIs = async () => {
      const zoom = map.getZoom();
      // Fetch more at high zoom, fewer at low zoom
      const fetchLimit = zoom >= 16 ? 200 : zoom >= 14 ? 80 : zoom >= 12 ? 40 : 20;

      // 2s cooldown between requests
      const now = Date.now();
      if (now - lastRequestRef.current < 2000) return;

      const rawBounds = map.getBounds();
      // Use actual visible map bounds — no artificial clamping that clusters results at center
      const south = rawBounds.getSouth();
      const north = rawBounds.getNorth();
      const west  = rawBounds.getWest();
      const east  = rawBounds.getEast();

      const cacheKey = `${category.osmTag}-${south.toFixed(3)}-${west.toFixed(3)}-z${Math.floor(zoom)}`;
      const cached = poiCache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_DURATION) {
        setPois(cached.data);
        onPOIsLoaded?.(cached.data);
        onLoadingChange?.(false);
        return;
      }

      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      onLoadingChange?.(true);
      lastRequestRef.current = now;

      // Hard 20s timeout
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
        onLoadingChange?.(false);
      }, 20000);

      try {
        let poiList = [];

        if (category.geoapifyCategory && GEOAPIFY_KEY) {
          // ── Geoapify path (fast, reliable) ──────────────────────────────
          poiList = await fetchGeoapify(
            category.geoapifyCategory, south, west, north, east,
            fetchLimit, abortControllerRef.current.signal
          );
        } else {
          // ── Overpass fallback (speed cameras etc.) ───────────────────────
          const osmTag = category.osmTag;
          const eqIdx  = osmTag.indexOf('=');
          const tagFilter = eqIdx !== -1
            ? `["${osmTag.slice(0, eqIdx)}"="${osmTag.slice(eqIdx + 1)}"]`
            : `["${osmTag}"]`;
          const query = `[out:json][timeout:15];(node${tagFilter}(${south},${west},${north},${east});way${tagFilter}(${south},${west},${north},${east}););out center ${fetchLimit};`;
          const res   = await fetchOverpass(query, abortControllerRef.current.signal);
          const text  = await res.text();
          if (!text.trim().startsWith('{')) throw new Error('Invalid Overpass response');
          const data  = JSON.parse(text);
          poiList = data.elements.map(el => {
            const lat = el.lat || el.center?.lat;
            const lon = el.lon || el.center?.lon;
            if (!lat || !lon) return null;
            return {
              id: el.id, lat, lon,
              name: el.tags?.name || category.name,
              address: el.tags?.['addr:street']
                ? `${el.tags['addr:street']} ${el.tags['addr:housenumber'] || ''}`.trim() : '',
              tags: el.tags || {},
            };
          }).filter(Boolean);
        }

        // Spread results evenly across visible map
        const distributed = distributeEvenly(poiList, south, west, north, east);

        clearTimeout(timeoutId);
        poiCache.set(cacheKey, { data: distributed, timestamp: now });
        setPois(distributed);
        onPOIsLoaded?.(distributed);
        onLoadingChange?.(false);
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') return;
        console.error('Error loading POIs:', err.message);
        onLoadingChange?.(false);
      }
    };

    clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(loadPOIs, 300);

    const handleMoveEnd = () => {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = setTimeout(loadPOIs, 600);
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
      clearTimeout(loadTimeoutRef.current);
      abortControllerRef.current?.abort();
    };
  }, [category, map]);

  if (!category) return null;

  return (
    <>
      {pois.map(poi => (
        <Marker
          key={poi.id}
          position={[poi.lat, poi.lon]}
          icon={createPOIIcon(category.icon, category.color)}
          eventHandlers={{ click: () => onSelectPOI?.(poi) }}
        >
          <Popup>
            <div style={{ minWidth: '180px' }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 600 }}>{poi.name}</h3>
              {poi.address && <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#666' }}>📍 {poi.address}</p>}
              <button onClick={() => onNavigate({ lat: poi.lat, lng: poi.lon, label: poi.name })}
                style={{ padding: '7px 14px', background: category.color, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, width: '100%' }}>
                Navigate
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}