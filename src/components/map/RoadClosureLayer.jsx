import { useEffect, useRef, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// ─── Helper: build a standard red-triangle warning sign SVG ──────────────────
// All European road warning signs share this shape: white triangle, red border.
const triSign = (innerSVG, w = 26, h = 24) => `
  <div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.55));line-height:0">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 100" width="${w}" height="${h}">
      <!-- Red filled triangle -->
      <polygon points="55,4 107,96 3,96" fill="#CC1111"/>
      <!-- White inner area -->
      <polygon points="55,17 97,88 13,88" fill="white"/>
      ${innerSVG}
    </svg>
  </div>`;

// ─── Icon 1: Traffic Jam — red triangle, 3 cars queuing (matches real sign) ──
// Rear-view cars stacked smaller-to-bigger left-to-right
const JAM_ICON = L.divIcon({
  html: triSign(`
    <!-- 3 cars from back (small) to front (large), rear view, stacked -->
    <!-- Car 3 (back, smallest) -->
    <g transform="translate(16,52) scale(0.52)">
      <rect x="2" y="12" width="28" height="16" rx="3" fill="#111"/>
      <rect x="5" y="4"  width="18" height="12" rx="2" fill="#111"/>
      <rect x="1" y="27" width="7"  height="5"  rx="2" fill="#333"/>
      <rect x="22" y="27" width="7" height="5"  rx="2" fill="#333"/>
      <rect x="6" y="6"  width="16" height="8"  rx="1" fill="white" opacity=".85"/>
    </g>
    <!-- Car 2 (middle) -->
    <g transform="translate(29,44) scale(0.65)">
      <rect x="2" y="12" width="32" height="18" rx="3" fill="#111"/>
      <rect x="5" y="4"  width="22" height="12" rx="2" fill="#111"/>
      <rect x="1" y="29" width="8"  height="5"  rx="2" fill="#333"/>
      <rect x="25" y="29" width="8" height="5"  rx="2" fill="#333"/>
      <rect x="6" y="6"  width="20" height="8"  rx="1" fill="white" opacity=".85"/>
    </g>
    <!-- Car 1 (front, largest) -->
    <g transform="translate(43,34) scale(0.80)">
      <rect x="2" y="14" width="38" height="20" rx="3.5" fill="#111"/>
      <rect x="5" y="4"  width="28" height="14" rx="3"   fill="#111"/>
      <rect x="1" y="33" width="9"  height="6"  rx="2.5" fill="#333"/>
      <rect x="30" y="33" width="9" height="6"  rx="2.5" fill="#333"/>
      <rect x="6" y="6"  width="26" height="10" rx="1.5" fill="white" opacity=".85"/>
    </g>
  `, 26, 24),
  className: '', iconSize: [26,24], iconAnchor: [13,12], popupAnchor: [0,-14],
});

// ─── Icon 2: Road Works — red triangle, worker digging (matches real sign) ───
const WORKS_ICON = L.divIcon({
  html: triSign(`
    <!-- Worker figure digging, same pose as standard road-works sign -->
    <!-- Head -->
    <circle cx="62" cy="30" r="7" fill="#111"/>
    <!-- Hard hat -->
    <path d="M55 30 Q55 22 62 22 Q69 22 69 30 Z" fill="#111"/>
    <rect x="52" y="28" width="20" height="4" rx="2" fill="#111"/>
    <!-- Torso leaning forward -->
    <line x1="62" y1="37" x2="50" y2="55" stroke="#111" stroke-width="5.5" stroke-linecap="round"/>
    <!-- Left arm holding shovel handle -->
    <line x1="58" y1="43" x2="42" y2="50" stroke="#111" stroke-width="4.5" stroke-linecap="round"/>
    <!-- Right arm raised -->
    <line x1="58" y1="43" x2="70" y2="35" stroke="#111" stroke-width="4.5" stroke-linecap="round"/>
    <!-- Legs -->
    <line x1="50" y1="55" x2="42" y2="72" stroke="#111" stroke-width="5" stroke-linecap="round"/>
    <line x1="50" y1="55" x2="58" y2="72" stroke="#111" stroke-width="5" stroke-linecap="round"/>
    <!-- Shovel: handle down to blade -->
    <line x1="42" y1="50" x2="32" y2="72" stroke="#111" stroke-width="4" stroke-linecap="round"/>
    <!-- Shovel blade -->
    <path d="M27 70 Q22 78 30 80 Q38 82 38 74 Z" fill="#111"/>
    <!-- Dirt mound -->
    <ellipse cx="75" cy="78" rx="18" ry="9" fill="#111"/>
    <path d="M57 78 Q66 60 75 60 Q84 60 93 78 Z" fill="#111"/>
  `, 26, 24),
  className: '', iconSize: [26,24], iconAnchor: [13,12], popupAnchor: [0,-14],
});

// ─── Icon 3: Lane Closed — red triangle, right lane narrows (matches real sign)
const LANE_CLOSED_ICON = L.divIcon({
  html: triSign(`
    <!-- Two lanes: left stays straight, right narrows into left -->
    <!-- Left lane (straight, stays vertical) -->
    <rect x="38" y="28" width="10" height="48" rx="2" fill="#111"/>
    <!-- Right lane (curves left to merge) -->
    <path d="M72 28 L72 52 Q72 72 53 76" stroke="#111" stroke-width="10" 
          fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Arrow tip on merge end -->
    <polygon points="48,70 53,82 58,70" fill="#111"/>
  `, 26, 24),
  className: '', iconSize: [26,24], iconAnchor: [13,12], popupAnchor: [0,-14],
});

// ─── Icon 4: Road Closed — no-entry circle (red circle with white bar) ────────
const CLOSED_ICON = L.divIcon({
  html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.55));line-height:0">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="24" height="24">
      <circle cx="50" cy="50" r="48" fill="white"/>
      <circle cx="50" cy="50" r="43" fill="#CC1111"/>
      <rect x="14" y="38" width="72" height="24" rx="5" fill="white"/>
    </svg></div>`,
  className: '', iconSize: [24,24], iconAnchor: [12,12], popupAnchor: [0,-14],
});

// ─── TomTom category → incident type ─────────────────────────────────────────
// iconCategory codes: 1=Accident 2=Fog 3=Dangerous 4=Rain 5=Ice 6=Jam
// 7=LaneClosed 8=RoadClosed 9=RoadWorks 10=Wind 11=Flooding
// 13=BrokenDown 14=RoadClosed
const isClosure    = cat => [8, 14].includes(cat);
const isJam        = cat => [1, 6, 13].includes(cat);   // accidents + stationary + broken down
const isWorks      = cat => [9].includes(cat);           // road works
const isLaneClosed = cat => [7].includes(cat);           // lane closed (was wrongly in isJam)

const EVENT_CODE_TO_KEY = {
  1:  'traffic.eventAccident',
  2:  'traffic.eventFog',
  3:  'traffic.eventDangerous',
  4:  'traffic.eventRain',
  5:  'traffic.eventIce',
  6:  'traffic.eventStationary',
  7:  'traffic.eventLaneClosed',
  8:  'traffic.eventRoadClosed',
  9:  'traffic.eventRoadWorks',
  10: 'traffic.eventWind',
  11: 'traffic.eventFlooding',
  13: 'traffic.eventBrokenDown',
  14: 'traffic.eventRoadClosed',
};

function midpoint(geometry) {
  const c = geometry.coordinates;
  if (geometry.type === 'Point') return [c[1], c[0]];
  const m = c[Math.floor(c.length / 2)];
  return [m[1], m[0]];
}

function haversineM([lat1,lng1],[lat2,lng2]) {
  const R=6371e3, φ1=lat1*Math.PI/180, φ2=lat2*Math.PI/180;
  const Δφ=(lat2-lat1)*Math.PI/180, Δλ=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(Δφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

async function fetchTomTomIncidents(bounds, apiKey, signal) {
  const { _southWest: sw, _northEast: ne } = bounds;
  const maxDelta = 2.0;
  const latDelta = Math.min(ne.lat - sw.lat, maxDelta);
  const lngDelta = Math.min(ne.lng - sw.lng, maxDelta);
  const cLat = (sw.lat + ne.lat) / 2;
  const cLng = (sw.lng + ne.lng) / 2;
  const bbox = [
    cLng - lngDelta/2, cLat - latDelta/2,
    cLng + lngDelta/2, cLat + latDelta/2,
  ].map(n => n.toFixed(6)).join(',');

  const fields = encodeURIComponent(
    '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,from,to,roadNumbers,events{description,iconCategory}}}}'
  );
  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&fields=${fields}&language=en-GB&timeValidityFilter=present&key=${apiKey}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`TomTom ${res.status}`);
  const data = await res.json();
  return (data.incidents || []).filter(i => {
    const cat = i.properties?.iconCategory;
    return isClosure(cat) || isJam(cat) || isWorks(cat) || isLaneClosed(cat);
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
  const markersRef    = useRef([]);
  const abortRef      = useRef(null);
  const loadingRef    = useRef(false);
  const lastBoundsRef = useRef(null);
  const cacheRef      = useRef([]);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => { try { map.removeLayer(m); } catch (_) {} });
    markersRef.current = [];
  }, [map]);

  const translateEventCode = useCallback((code) => {
    if (!t || !code) return null;
    const key = EVENT_CODE_TO_KEY[code];
    if (!key) return null;
    const translated = t(key);
    return translated !== key ? translated : null;
  }, [t]);

  // Detect dark mode from the document
  const isDark = () => document.documentElement.classList.contains('dark') ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const makePopupHTML = useCallback((inc) => {
    const titleKey = inc.type === 'closure'    ? 'traffic.roadClosed'
                   : inc.type === 'works'      ? 'traffic.roadWorks'
                   : inc.type === 'lane'       ? 'traffic.eventLaneClosed'
                   :                             'traffic.trafficJam';
    const title     = t ? t(titleKey) : '—';
    const fromLabel = t ? t('traffic.roadFrom') : 'From';
    const toLabel   = t ? t('traffic.roadTo')   : 'To';
    const eventDesc = inc.eventCode
      ? (translateEventCode(inc.eventCode) || inc.desc || '')
      : (inc.desc || '');

    const dark = isDark();
    const bg       = dark ? '#1e293b' : '#ffffff';
    const fg       = dark ? '#f1f5f9' : '#1e293b';
    const subColor = dark ? '#94a3b8' : '#555555';
    const border   = dark ? '#334155' : '#e2e8f0';

    return `<div style="font-size:13px;line-height:1.6;max-width:220px;padding:2px;
                        background:${bg};color:${fg};border-radius:4px;">
      <strong style="color:#CC1111;font-size:14px;display:block;margin-bottom:3px">${title}</strong>
      ${inc.road ? `<div style="border-top:1px solid ${border};padding-top:4px;margin-top:3px">🛣️ ${inc.road}</div>` : ''}
      ${inc.from ? `<div style="color:${subColor}">${fromLabel}: ${inc.from}</div>` : ''}
      ${inc.to   ? `<div style="color:${subColor}">${toLabel}: ${inc.to}</div>` : ''}
      ${eventDesc ? `<div style="margin-top:4px;color:${subColor};font-size:12px;font-style:italic">${eventDesc}</div>` : ''}
    </div>`;
  }, [t, translateEventCode]);

  const renderMarkers = useCallback((incidents) => {
    clearMarkers();
    requestAnimationFrame(() => {
      const newMarkers = [];
      incidents.forEach(inc => {
        const icon = inc.type === 'closure' ? CLOSED_ICON
                   : inc.type === 'works'  ? WORKS_ICON
                   : inc.type === 'lane'   ? LANE_CLOSED_ICON
                   :                         JAM_ICON;
        const marker = L.marker([inc.lat, inc.lng], {
          icon,
          zIndexOffset: 5000,   // always above map tiles
          riseOnHover: true,    // pop to front on hover
          keyboard: false,
        })
          .bindPopup(makePopupHTML(inc), {
            maxWidth: 240,
            className: 'traffic-popup',   // hook for CSS if needed
          })
          .addTo(map);
        newMarkers.push(marker);
      });
      markersRef.current = newMarkers;
    });
  }, [map, clearMarkers, makePopupHTML]);

  const load = useCallback(async () => {
    if (!enabled) { clearMarkers(); return; }
    if (loadingRef.current) return;

    const zoom = map.getZoom();
    // Lower MIN_ZOOM so icons appear even at very close zoom (was 10, now 7)
    if (zoom < 7) { clearMarkers(); return; }

    const bounds = map.getBounds();

    // Cache skip: only if map moved less than 15% of view size
    // At high zoom this threshold is intentionally small so we always refresh
    if (lastBoundsRef.current && cacheRef.current.length > 0 && zoom < 16) {
      const prev = lastBoundsRef.current;
      const dist = haversineM(
        [prev.getCenter().lat, prev.getCenter().lng],
        [bounds.getCenter().lat, bounds.getCenter().lng]
      );
      const viewSize = haversineM(
        [prev._southWest.lat, prev._southWest.lng],
        [prev._northEast.lat, prev._northEast.lng]
      );
      if (dist < viewSize * 0.15) {
        renderMarkers(cacheRef.current);
        return;
      }
    }
    lastBoundsRef.current = bounds;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    loadingRef.current = true;
    let incidents = [];

    if (apiKey) {
      try {
        const raw = await fetchTomTomIncidents(bounds, apiKey, ctrl.signal);
        incidents = raw.map(inc => {
          if (!inc.geometry) return null;
          const [lat, lng] = midpoint(inc.geometry);
          const p   = inc.properties || {};
          const cat = p.iconCategory;
          const eventCode = p.events?.[0]?.iconCategory ?? null;
          // Fix: lane closed (cat 7) gets its own type instead of being 'jam'
          const type = isClosure(cat)    ? 'closure'
                     : isWorks(cat)      ? 'works'
                     : isLaneClosed(cat) ? 'lane'
                     :                    'jam';
          return {
            lat, lng, type, eventCode,
            road: (p.roadNumbers || []).join(', '),
            from: p.from || '',
            to:   p.to   || '',
            desc: p.events?.[0]?.description || '',
          };
        }).filter(Boolean);
      } catch (err) {
        if (err.name === 'AbortError') { loadingRef.current = false; return; }
      }
    }

    if (incidents.length === 0 && !ctrl.signal.aborted) {
      try {
        const ov = await fetchOverpassClosures(bounds, ctrl.signal);
        incidents = ov.map(o => ({ ...o, from:'', to:'', desc:'', eventCode: null }));
      } catch (err) {
        if (err.name !== 'AbortError') { /* ignore */ }
      }
    }

    loadingRef.current = false;
    if (ctrl.signal.aborted) return;
    cacheRef.current = incidents;
    renderMarkers(incidents);
  }, [map, apiKey, enabled, clearMarkers, renderMarkers]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadDebounced = useCallback(debounce(load, 1000), [load]);

  useEffect(() => {
    load();
    return () => { clearMarkers(); abortRef.current?.abort(); };
  }, [load]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  useMapEvents({ moveend: loadDebounced, zoomend: loadDebounced });

  return null;
}
