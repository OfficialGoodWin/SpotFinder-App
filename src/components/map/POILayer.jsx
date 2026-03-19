import React, { useEffect, useState, useRef } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

// ─── Emoji marker icon ────────────────────────────────────────────────────────
const iconCache = new Map();

const createPOIIcon = (emoji, color, zoom) => {
  const size = zoom >= 16 ? 36 : zoom >= 14 ? 30 : 26;
  const key = `${emoji}-${color}-${size}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};
      display:flex;align-items:center;justify-content:center;
      border:2px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
      cursor:pointer;
      font-size:${Math.round(size * 0.52)}px;
      line-height:1;
      transition:transform 0.1s;
    ">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
  iconCache.set(key, icon);
  return icon;
};

// ─── Mapy.cz (primary fallback — replaces Overpass) ──────────────────────────
const MAPY_API_KEY = import.meta.env.VITE_MAPY_API_KEY || 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';

async function fetchMapy(category, south, west, north, east, limit, signal) {
  // Use the first short English keyword as the search query
  const query = (category.keywords || []).find(k => /^[a-z]/i.test(k)) || category.name;
  const centerLat = (south + north) / 2;
  const centerLon = (west + east) / 2;
  // Estimate a search radius from the bbox width (capped at 50 km)
  const radiusM = Math.min(50000, Math.round((east - west) * 111_000 / 2));

  const url =
    `https://api.mapy.com/v1/suggest` +
    `?apikey=${MAPY_API_KEY}` +
    `&query=${encodeURIComponent(query)}` +
    `&lang=en` +
    `&limit=${Math.min(limit, 50)}` +
    `&preferNear=${centerLon},${centerLat}` +
    `&preferNearPrecision=${radiusM}` +
    `&category=poi`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Mapy.cz suggest ${res.status}`);
  const data = await res.json();

  return (data.items || [])
    .map(item => {
      const lat = item.position?.lat ?? item.lat;
      const lon = item.position?.lon ?? item.position?.lng ?? item.lon ?? item.lng;
      if (!lat || !lon) return null;
      // Filter to items actually inside the current bbox
      if (lat < south || lat > north || lon < west || lon > east) return null;
      return {
        id:      item.id || `${lat.toFixed(5)}-${lon.toFixed(5)}`,
        lat, lon,
        name:    item.name || item.label || category.name,
        address: item.location || '',
        tags:    {},
        mapyId:  item.id,
        source:  item.source,
      };
    })
    .filter(Boolean);
}

// ─── Geoapify (kept for users who supply their own key) ───────────────────────
const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '';

async function fetchGeoapify(category, south, west, north, east, limit, signal) {
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
        phone: p.phone || p.contact?.phone,
        website: p.website || p.contact?.website,
        email: p.email || p.contact?.email,
        opening_hours: p.opening_hours,
        description: p.description || p.details?.description,
      },
    };
  });
}

// ─── Spatial distribution ─────────────────────────────────────────────────────
const GRID_SIZE = 6;
const SLOTS_PER_CELL = 3;
const MAX_DISPLAY = 60;

function distributeEvenly(pois, south, west, north, east) {
  if (pois.length <= MAX_DISPLAY) return pois;
  const latStep = (north - south) / GRID_SIZE;
  const lngStep = (east - west) / GRID_SIZE;
  const grid = new Map();
  for (const poi of pois) {
    const row = Math.min(Math.floor((poi.lat - south) / latStep), GRID_SIZE - 1);
    const col = Math.min(Math.floor((poi.lon - west) / lngStep), GRID_SIZE - 1);
    const key = `${row}_${col}`;
    const cell = grid.get(key) || [];
    if (cell.length < SLOTS_PER_CELL) { cell.push(poi); grid.set(key, cell); }
  }
  const result = [];
  for (const cell of grid.values()) result.push(...cell);
  return result.slice(0, MAX_DISPLAY);
}

// ─── Cache ────────────────────────────────────────────────────────────────────
const poiCache = new Map();
const CACHE_DURATION = 600_000;

// ─── Component ────────────────────────────────────────────────────────────────
export default function POILayer({ category, onNavigate, onPOIsLoaded, onLoadingChange, onSelectPOI }) {
  const [pois, setPois] = useState([]);
  const [zoom, setZoom] = useState(13);
  const map = useMap();
  const loadTimeoutRef = useRef(null);
  const lastRequestRef = useRef(0);
  const abortControllerRef = useRef(null);

  // Track zoom for icon sizing
  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    setZoom(map.getZoom());
    return () => map.off('zoomend', onZoom);
  }, [map]);

  useEffect(() => {
    // Clear everything when category is removed
    if (!category) {
      setPois([]);
      onPOIsLoaded?.([]);
      onLoadingChange?.(false);
      abortControllerRef.current?.abort();
      clearTimeout(loadTimeoutRef.current);
      return;
    }

    const loadPOIs = async () => {
      const currentZoom = map.getZoom();
      const fetchLimit = currentZoom >= 16 ? 200 : currentZoom >= 14 ? 100 : currentZoom >= 12 ? 50 : 25;
      const now = Date.now();
      if (now - lastRequestRef.current < 1500) return;

      const b = map.getBounds();
      const south = b.getSouth(), north = b.getNorth();
      const west = b.getWest(), east = b.getEast();

      const cacheKey = `${category.osmTag}-${south.toFixed(3)}-${west.toFixed(3)}-z${Math.floor(currentZoom)}`;
      const cached = poiCache.get(cacheKey);
      if (cached && now - cached.timestamp < CACHE_DURATION) {
        setPois(cached.data);
        onPOIsLoaded?.(cached.data);
        onLoadingChange?.(false);
        return;
      }

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      onLoadingChange?.(true);
      lastRequestRef.current = now;

      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
        onLoadingChange?.(false);
      }, 20_000);

      try {
        let poiList = [];

        if (category.geoapifyCategory && GEOAPIFY_KEY) {
          poiList = await fetchGeoapify(
            category.geoapifyCategory, south, west, north, east,
            fetchLimit, abortControllerRef.current.signal
          );
        } else {
          // Mapy.cz suggest — replaces Overpass, no rate-limit issues
          poiList = await fetchMapy(
            category, south, west, north, east,
            fetchLimit, abortControllerRef.current.signal
          );
        }

        const distributed = distributeEvenly(poiList, south, west, north, east);
        clearTimeout(timeoutId);
        poiCache.set(cacheKey, { data: distributed, timestamp: now });
        setPois(distributed);
        onPOIsLoaded?.(distributed);
        onLoadingChange?.(false);
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') return;
        console.error('POI load error:', err.message);
        onLoadingChange?.(false);
      }
    };

    clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(loadPOIs, 300);

    const handleMoveEnd = () => {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = setTimeout(loadPOIs, 500);
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
          icon={createPOIIcon(category.icon, category.color, zoom)}
          eventHandlers={{ click: () => onSelectPOI?.(poi) }}
        />
      ))}
    </>
  );
}