import { useEffect, useRef, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// ─── Icons: 2x smaller than before ──────────────────────────────────────────
// Road Closed — red no-entry circle (22×22)
const CLOSED_ICON = L.divIcon({
  html: `<div style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.5));line-height:0">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="22" height="22">
      <circle cx="50" cy="50" r="49" fill="white"/>
      <circle cx="50" cy="50" r="44" fill="#CC1111"/>
      <rect x="16" y="38" width="68" height="24" rx="4" fill="white"/>
    </svg></div>`,
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -14],
});

// Traffic Jam — white triangle with thick orange border + 3 black cars (23×21)
const JAM_ICON = L.divIcon({
  html: `<div style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.5));line-height:0">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 98" width="23" height="21">
      <polygon points="55,6 104,92 6,92" fill="white" stroke="#E07000" stroke-width="9" stroke-linejoin="round"/>
      <!-- Car 3 (back, smallest) -->
      <g transform="translate(22,68) scale(0.55)">
        <rect x="0" y="10" width="26" height="13" rx="2" fill="#111"/>
        <rect x="3" y="4" width="20" height="10" rx="2" fill="#111"/>
        <rect x="1" y="22" width="5" height="3" rx="1" fill="#444"/>
        <rect x="20" y="22" width="5" height="3" rx="1" fill="#444"/>
        <rect x="4" y="6" width="6" height="5" rx="1" fill="#334"/>
        <rect x="13" y="6" width="6" height="5" rx="1" fill="#334"/>
      </g>
      <!-- Car 2 (middle) -->
      <g transform="translate(37,60) scale(0.65)">
        <rect x="0" y="10" width="28" height="14" rx="2" fill="#111"/>
        <rect x="3" y="4" width="22" height="10" rx="2" fill="#111"/>
        <rect x="1" y="23" width="6" height="4" rx="1.5" fill="#444"/>
        <rect x="21" y="23" width="6" height="4" rx="1.5" fill="#444"/>
        <rect x="4" y="6" width="7" height="6" rx="1" fill="#334"/>
        <rect x="14" y="6" width="7" height="6" rx="1" fill="#334"/>
      </g>
      <!-- Car 1 (front, largest) -->
      <g transform="translate(54,50) scale(0.78)">
        <rect x="0" y="12" width="32" height="16" rx="2.5" fill="#111"/>
        <rect x="3" y="4" width="26" height="12" rx="2.5" fill="#111"/>
        <rect x="1" y="27" width="7" height="5" rx="2" fill="#444"/>
        <rect x="24" y="27" width="7" height="5" rx="2" fill="#444"/>
        <rect x="5" y="6" width="8" height="7" rx="1" fill="#334"/>
        <rect x="17" y="6" width="8" height="7" rx="1" fill="#334"/>
        <rect x="12" y="25" width="9" height="3" rx="1" fill="#cc2222"/>
      </g>
    </svg></div>`,
  className: '',
  iconSize: [23, 21],
  iconAnchor: [11, 10],
  popupAnchor: [0, -13],
});

// Road Works — orange/yellow diamond with a person shovelling (22×22)
const WORKS_ICON = L.divIcon({
  html: `<div style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.5));line-height:0">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="22" height="22">
      <rect x="8" y="8" width="84" height="84" rx="8" fill="#FF8C00" transform="rotate(45 50 50)"/>
      <rect x="12" y="12" width="76" height="76" rx="6" fill="#FFB300" transform="rotate(45 50 50)"/>
      <!-- Hard hat person -->
      <circle cx="50" cy="28" r="9" fill="#111"/>
      <rect x="39" y="20" width="22" height="6" rx="3" fill="#FF8C00"/>
      <!-- Body -->
      <rect x="44" y="37" width="12" height="20" rx="3" fill="#111"/>
      <!-- Arms with shovel -->
      <line x1="44" y1="44" x2="28" y2="52" stroke="#111" stroke-width="5" stroke-linecap="round"/>
      <line x1="56" y1="44" x2="68" y2="38" stroke="#111" stroke-width="5" stroke-linecap="round"/>
      <!-- Shovel -->
      <line x1="28" y1="52" x2="24" y2="68" stroke="#888" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="22" cy="72" rx="6" ry="4" fill="#888"/>
      <!-- Legs -->
      <line x1="50" y1="57" x2="44" y2="72" stroke="#111" stroke-width="5" stroke-linecap="round"/>
      <line x1="50" y1="57" x2="58" y2="72" stroke="#111" stroke-width="5" stroke-linecap="round"/>
    </svg></div>`,
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -14],
});

// TomTom category helpers
const isClosure  = cat => [8, 14].includes(cat);
const isJam      = cat => [1, 6, 7].includes(cat);
const isWorks    = cat => [9].includes(cat);        // road works
const isIncident = cat => [13].includes(cat);       // broken down / accident jam

function midpoint(geometry) {
  const c = geometry.coordinates;
  if (geometry.type === 'Point') return [c[1], c[0]];
  const m = c[Math.floor(c.length / 2)];
  return [m[1], m[0]];
}

function haversineM([lat1, lng1], [lat2, lng2]) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Debounce helper
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function fetchTomTomIncidents(bounds, apiKey, signal) {
  const { _southWest: sw, _northEast: ne } = bounds;
  const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
  const fields = encodeURIComponent('{incidents{type,geometry{type,coordinates},properties{id,iconCategory,from,to,roadNumbers,events{description,iconCategory}}}}');
  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&fields=${fields}&language=en-GB&timeValidityFilter=present&key=${apiKey}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`TomTom ${res.status}`);
  const data = await res.json();
  return (data.incidents || []).filter(i => {
    const cat = i.properties?.iconCategory;
    return isClosure(cat) || isJam(cat) || isWorks(cat) || isIncident(cat);
  });
}

async function fetchOverpassClosures(bounds, signal) {
  const { _southWest: sw, _northEast: ne } = bounds;
  const bbox = `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
  const query = `[out:json][timeout:8];(way["access"="no"]["highway"](${bbox});way["motor_vehicle"="no"]["highway"](${bbox}););out center 15;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', body: 'data=' + encodeURIComponent(query), signal,
  });
  if (!res.ok) throw new Error('Overpass error');
  const data = await res.json();
  return (data.elements || []).slice(0, 15).map(el => ({
    type: 'closure',
    lat: el.center?.lat || el.lat,
    lng: el.center?.lon || el.lon,
    road: el.tags?.ref || el.tags?.name || '',
  })).filter(e => e.lat && e.lng);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RoadClosureLayer({ apiKey, enabled, lang, t }) {
  const map = useMap();
  const markersRef = useRef([]);
  const abortRef   = useRef(null);
  const loadingRef = useRef(false);   // prevent concurrent fetches

  // Cache: don't re-fetch if bounds haven't changed significantly
  const lastBoundsRef = useRef(null);
  const cacheRef = useRef([]);        // cached incidents

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => { try { map.removeLayer(m); } catch (_) {} });
    markersRef.current = [];
  }, [map]);

  // Build popup HTML using translated strings
  const makePopupHTML = useCallback((inc) => {
    const tKey = inc.type === 'closure' ? 'traffic.roadClosed'
               : inc.type === 'works'   ? 'traffic.roadWorks'
               : 'traffic.trafficJam';
    const title = t ? t(tKey) : inc.title || '—';
    const fromLabel = t ? t('traffic.roadFrom') : 'From';
    const toLabel   = t ? t('traffic.roadTo')   : 'To';
    return `<div style="font-size:13px;line-height:1.5;max-width:210px">
      <strong style="color:#CC1111;font-size:14px">${title}</strong>
      ${inc.road ? `<div style="margin-top:5px">🛣️ ${inc.road}</div>` : ''}
      ${inc.from ? `<div style="margin-top:2px">${fromLabel}: ${inc.from}</div>` : ''}
      ${inc.to   ? `<div style="margin-top:2px">${toLabel}: ${inc.to}</div>` : ''}
      ${inc.desc ? `<div style="margin-top:5px;color:#666;font-size:12px">${inc.desc}</div>` : ''}
    </div>`;
  }, [t]);

  const renderMarkers = useCallback((incidents) => {
    clearMarkers();
    // Batch DOM ops in a requestAnimationFrame to avoid layout thrash
    requestAnimationFrame(() => {
      incidents.forEach(inc => {
        const icon = inc.type === 'closure' ? CLOSED_ICON
                   : inc.type === 'works'   ? WORKS_ICON
                   : JAM_ICON;
        const marker = L.marker([inc.lat, inc.lng], {
          icon,
          zIndexOffset: 3000,
          // Performance: riseOnHover false prevents expensive z-index recalculations
          riseOnHover: false,
          keyboard: false,
        })
          .bindPopup(makePopupHTML(inc), { maxWidth: 220, className: 'road-incident-popup' })
          .addTo(map);
        markersRef.current.push(marker);
      });
    });
  }, [map, clearMarkers, makePopupHTML]);

  const load = useCallback(async () => {
    if (!enabled) { clearMarkers(); return; }
    if (loadingRef.current) return; // skip if already fetching

    // Check if bounds changed enough to warrant a refresh (>200m shift)
    const bounds = map.getBounds();
    if (lastBoundsRef.current) {
      const prevCenter = lastBoundsRef.current.getCenter();
      const currCenter = bounds.getCenter();
      const dist = haversineM([prevCenter.lat, prevCenter.lng], [currCenter.lat, currCenter.lng]);
      const prevSize = haversineM(
        [lastBoundsRef.current._southWest.lat, lastBoundsRef.current._southWest.lng],
        [lastBoundsRef.current._northEast.lat, lastBoundsRef.current._northEast.lng]
      );
      // Skip if moved less than 15% of viewport width
      if (dist < prevSize * 0.15 && cacheRef.current.length > 0) {
        renderMarkers(cacheRef.current);
        return;
      }
    }
    lastBoundsRef.current = bounds;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    loadingRef.current = true;
    let incidents = [];

    try {
      if (apiKey) {
        const raw = await fetchTomTomIncidents(bounds, apiKey, controller.signal);
        incidents = raw.map(inc => {
          if (!inc.geometry) return null;
          const [lat, lng] = midpoint(inc.geometry);
          const p = inc.properties || {};
          const cat = p.iconCategory;
          const type = isClosure(cat) ? 'closure' : isWorks(cat) ? 'works' : 'jam';
          return {
            lat, lng, type,
            road: (p.roadNumbers || []).join(', '),
            from: p.from || '',
            to:   p.to   || '',
            desc: p.events?.[0]?.description || '',
          };
        }).filter(Boolean);
      }
    } catch (err) {
      if (err.name === 'AbortError') { loadingRef.current = false; return; }
      console.warn('[RoadClosureLayer] TomTom failed:', err.message);
    }

    // Overpass fallback
    if (incidents.length === 0 && !controller.signal.aborted) {
      try {
        const overpass = await fetchOverpassClosures(bounds, controller.signal);
        incidents = overpass.map(o => ({ ...o, type: 'closure', from: '', to: '', desc: '' }));
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('[RoadClosureLayer] Overpass failed:', err.message);
      }
    }

    loadingRef.current = false;
    if (controller.signal.aborted) return;

    cacheRef.current = incidents;
    renderMarkers(incidents);
  }, [map, apiKey, enabled, clearMarkers, renderMarkers]);

  // Debounced version for map move/zoom events (600ms)
  const loadDebounced = useCallback(debounce(load, 600), [load]);

  useEffect(() => {
    load();
    return () => {
      clearMarkers();
      abortRef.current?.abort();
    };
  }, [load]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  useMapEvents({ moveend: loadDebounced, zoomend: loadDebounced });

  return null;
}

// Export for use by NavigationPanel to check if destination is near a closure
export function getClosureNearPoint(lat, lng, radiusM = 80) {
  // This is a lightweight client-side check against the Overpass data
  // In practice NavigationPanel uses OSRM which already avoids access=no roads
  return false; // OSRM handles this natively; this hook is for future extension
}
