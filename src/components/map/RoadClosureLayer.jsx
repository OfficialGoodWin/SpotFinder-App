import { useEffect, useRef, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// ─── Zoom thresholds — hide icons when below these zoom levels ────────────────
const ZOOM = {
  jam:      6,   // traffic jam: visible when zoom > 6
  accident: 8,   // accident:    visible when zoom > 8
  lane:     8,   // lane closed: visible when zoom > 8
  works:    12,  // road works:  visible when zoom > 12
  closure:  11,  // road closed: visible when zoom > 11
};

// ─── Helper: European red-triangle warning sign ───────────────────────────────
const triSign = (inner, w = 26, h = 24) =>
  `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.55));line-height:0">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 100" width="${w}" height="${h}">
      <polygon points="55,4 107,96 3,96" fill="#CC1111"/>
      <polygon points="55,17 97,88 13,88" fill="white"/>
      ${inner}
    </svg>
  </div>`;

// ─── TRAFFIC JAM: red triangle, 3 rear-view cars queuing bottom of triangle ───
const JAM_ICON = L.divIcon({
  html: triSign(`
    <g transform="translate(16,62) scale(0.52)">
      <rect x="2" y="12" width="28" height="16" rx="3" fill="#111"/>
      <rect x="5" y="4"  width="18" height="12" rx="2" fill="#111"/>
      <rect x="1" y="27" width="7"  height="5"  rx="2" fill="#333"/>
      <rect x="22" y="27" width="7" height="5"  rx="2" fill="#333"/>
      <rect x="6" y="6"  width="16" height="8"  rx="1" fill="white" opacity=".85"/>
    </g>
    <g transform="translate(29,55) scale(0.65)">
      <rect x="2" y="12" width="32" height="18" rx="3" fill="#111"/>
      <rect x="5" y="4"  width="22" height="12" rx="2" fill="#111"/>
      <rect x="1" y="29" width="8"  height="5"  rx="2" fill="#333"/>
      <rect x="25" y="29" width="8" height="5"  rx="2" fill="#333"/>
      <rect x="6" y="6"  width="20" height="8"  rx="1" fill="white" opacity=".85"/>
    </g>
    <g transform="translate(43,46) scale(0.80)">
      <rect x="2" y="14" width="38" height="20" rx="3.5" fill="#111"/>
      <rect x="5" y="4"  width="28" height="14" rx="3"   fill="#111"/>
      <rect x="1" y="33" width="9"  height="6"  rx="2.5" fill="#333"/>
      <rect x="30" y="33" width="9" height="6"  rx="2.5" fill="#333"/>
      <rect x="6" y="6"  width="26" height="10" rx="1.5" fill="white" opacity=".85"/>
    </g>
  `),
  className: '', iconSize: [26,24], iconAnchor: [13,12], popupAnchor: [0,-14],
});

// ─── ACCIDENT: red triangle, explosion + two side-view cars ────────────────────
const ACCIDENT_ICON = L.divIcon({
  html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.55));line-height:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 100" width="26" height="24">
    <!-- Bold 6-point star explosion, centred in triangle -->
    <polygon points="55.0,39.0 58.0,46.8 66.3,45.5 61.0,52.0 66.3,58.5 58.0,57.2 55.0,65.0 52.0,57.2 43.7,58.5 49.0,52.0 43.7,45.5 52.0,46.8" fill="#FF8800"/>
    <circle cx="55" cy="52" r="6" fill="#FFE500"/>
    <!-- Left car: side profile facing right, bottom-left corner -->
    <g transform="translate(10,66)">
      <rect x="0" y="5"  width="24" height="13" rx="3" fill="#111"/>
      <rect x="4" y="0"  width="13" height="9"  rx="2" fill="#111"/>
      <circle cx="5"  cy="19" r="4" fill="#444"/>
      <circle cx="19" cy="19" r="4" fill="#444"/>
    </g>
    <!-- Right car: mirrored, bottom-right corner -->
    <g transform="translate(100,66) scale(-1,1)">
      <rect x="0" y="5"  width="24" height="13" rx="3" fill="#111"/>
      <rect x="4" y="0"  width="13" height="9"  rx="2" fill="#111"/>
      <circle cx="5"  cy="19" r="4" fill="#444"/>
      <circle cx="19" cy="19" r="4" fill="#444"/>
    </g>
  </svg></div>`,
  className: '', iconSize: [26,24], iconAnchor: [13,12], popupAnchor: [0,-14],
});

// ─── LANE CLOSED: two vertical bars at top, right bar angles into left bar ─────
// Pure straight-line segments — no bezier. Reads clearly at 26px.
const LANE_CLOSED_ICON = L.divIcon({
  html: triSign(`
    <!-- Left lane: full-height vertical bar -->
    <rect x="28" y="24" width="13" height="58" rx="3" fill="#111"/>
    <!-- Right lane: straight down to midpoint, then sharp diagonal left to join left lane -->
    <polyline points="72,24 72,52 41,82"
              stroke="#111" stroke-width="13"
              fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  `),
  className: '', iconSize: [26,24], iconAnchor: [13,12], popupAnchor: [0,-14],
});

// ─── ROAD WORKS: orange emoji badge — clean, universally recognised ────────────
const WORKS_ICON = L.divIcon({
  html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.55));
                     background:#FF8C00;border-radius:4px;
                     width:24px;height:24px;
                     display:flex;align-items:center;justify-content:center;
                     font-size:16px;line-height:1">🚧</div>`,
  className: '', iconSize: [24,24], iconAnchor: [12,12], popupAnchor: [0,-14],
});

// ─── ROAD CLOSED: no-entry circle (red circle, white horizontal bar) ──────────
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
// 1=Accident  2=Fog  3=Dangerous  4=Rain  5=Ice  6=Jam
// 7=LaneClosed  8=RoadClosed  9=RoadWorks  10=Wind  11=Flooding
// 13=BrokenDown  14=RoadClosed
const isClosure    = cat => [8, 14].includes(cat);
const isJam        = cat => [6, 13].includes(cat);
const isAccident   = cat => [1].includes(cat);
const isWorks      = cat => [9].includes(cat);
const isLaneClosed = cat => [7].includes(cat);

const EVENT_CODE_TO_KEY = {
  1:'traffic.eventAccident', 2:'traffic.eventFog', 3:'traffic.eventDangerous',
  4:'traffic.eventRain', 5:'traffic.eventIce', 6:'traffic.eventStationary',
  7:'traffic.eventLaneClosed', 8:'traffic.eventRoadClosed', 9:'traffic.eventRoadWorks',
  10:'traffic.eventWind', 11:'traffic.eventFlooding', 13:'traffic.eventBrokenDown',
  14:'traffic.eventRoadClosed',
};

function midpoint(geometry) {
  const c = geometry.coordinates;
  if (geometry.type === 'Point') return [c[1], c[0]];
  const m = c[Math.floor(c.length / 2)];
  return [m[1], m[0]];
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
    return isClosure(cat) || isJam(cat) || isAccident(cat) || isWorks(cat) || isLaneClosed(cat);
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
  const fetchingRef = useRef(false);
  const cacheRef   = useRef([]);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => { try { map.removeLayer(m); } catch (_) {} });
    markersRef.current = [];
  }, [map]);

  const isDark = () =>
    document.documentElement.classList.contains('dark') ||
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  const translateEventCode = useCallback((code) => {
    if (!t || !code) return null;
    const key = EVENT_CODE_TO_KEY[code];
    if (!key) return null;
    const v = t(key);
    return v !== key ? v : null;
  }, [t]);

  const makePopupHTML = useCallback((inc) => {
    const titleKey = inc.type === 'closure'  ? 'traffic.roadClosed'
                   : inc.type === 'works'    ? 'traffic.roadWorks'
                   : inc.type === 'lane'     ? 'traffic.eventLaneClosed'
                   : inc.type === 'accident' ? 'traffic.eventAccident'
                   :                           'traffic.trafficJam';
    const title     = t ? t(titleKey) : '—';
    const fromLabel = t ? t('traffic.roadFrom') : 'From';
    const toLabel   = t ? t('traffic.roadTo')   : 'To';
    const eventDesc = inc.eventCode
      ? (translateEventCode(inc.eventCode) || inc.desc || '')
      : (inc.desc || '');

    const dark = isDark();
    const bg  = dark ? '#1e293b' : '#ffffff';
    const fg  = dark ? '#f1f5f9' : '#1e293b';
    const sub = dark ? '#94a3b8' : '#555555';
    const brd = dark ? '#334155' : '#e2e8f0';

    return `<div style="font-size:13px;line-height:1.6;max-width:220px;padding:2px;
                        background:${bg};color:${fg};border-radius:4px">
      <strong style="color:#CC1111;font-size:14px;display:block;margin-bottom:3px">${title}</strong>
      ${inc.road ? `<div style="border-top:1px solid ${brd};padding-top:4px;margin-top:3px">🛣️ ${inc.road}</div>` : ''}
      ${inc.from ? `<div style="color:${sub}">${fromLabel}: ${inc.from}</div>` : ''}
      ${inc.to   ? `<div style="color:${sub}">${toLabel}: ${inc.to}</div>` : ''}
      ${eventDesc ? `<div style="margin-top:4px;color:${sub};font-size:12px;font-style:italic">${eventDesc}</div>` : ''}
    </div>`;
  }, [t, translateEventCode]);

  // renderMarkers: applies zoom-based visibility filtering
  const renderMarkers = useCallback((incidents) => {
    clearMarkers();
    const zoom = map.getZoom();
    const newMarkers = [];

    incidents.forEach(inc => {
      const threshold = ZOOM[inc.type] ?? 0;
      if (zoom <= threshold) return;  // hide below threshold zoom

      const icon = inc.type === 'closure'  ? CLOSED_ICON
                 : inc.type === 'works'    ? WORKS_ICON
                 : inc.type === 'lane'     ? LANE_CLOSED_ICON
                 : inc.type === 'accident' ? ACCIDENT_ICON
                 :                           JAM_ICON;

      const marker = L.marker([inc.lat, inc.lng], {
        icon,
        zIndexOffset: 5000,
        riseOnHover: true,
        keyboard: false,
      })
        .bindPopup(makePopupHTML(inc), { maxWidth: 240 })
        .addTo(map);
      newMarkers.push(marker);
    });

    markersRef.current = newMarkers;
  }, [map, clearMarkers, makePopupHTML]);

  // load: fetch fresh data from TomTom/Overpass and render
  const load = useCallback(async () => {
    if (!enabled) { clearMarkers(); return; }
    if (fetchingRef.current) return;

    const bounds = map.getBounds();

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    fetchingRef.current = true;
    let incidents = [];

    if (apiKey) {
      try {
        const raw = await fetchTomTomIncidents(bounds, apiKey, ctrl.signal);
        incidents = raw.map(inc => {
          if (!inc.geometry) return null;
          const [lat, lng] = midpoint(inc.geometry);
          const p = inc.properties || {};
          const cat = p.iconCategory;
          const eventCode = p.events?.[0]?.iconCategory ?? null;
          const type = isClosure(cat)    ? 'closure'
                     : isWorks(cat)      ? 'works'
                     : isLaneClosed(cat) ? 'lane'
                     : isAccident(cat)   ? 'accident'
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
        if (err.name === 'AbortError') { fetchingRef.current = false; return; }
      }
    }

    if (incidents.length === 0 && !ctrl.signal.aborted) {
      try {
        const ov = await fetchOverpassClosures(bounds, ctrl.signal);
        incidents = ov.map(o => ({ ...o, from:'', to:'', desc:'', eventCode: null }));
      } catch (_) {}
    }

    fetchingRef.current = false;
    if (ctrl.signal.aborted) return;
    cacheRef.current = incidents;
    renderMarkers(incidents);
  }, [map, apiKey, enabled, clearMarkers, renderMarkers]);

  // onZoom: re-render cached data immediately with new zoom thresholds applied.
  // Also trigger a fresh fetch (debounced) since bbox may now cover a different area.
  const onZoom = useCallback(() => {
    // Re-render immediately from cache so thresholds apply without waiting for fetch
    if (cacheRef.current.length > 0) {
      renderMarkers(cacheRef.current);
    }
  }, [renderMarkers]);

  const loadDebounced = useCallback(debounce(load, 900), [load]);
  const onZoomDebounced = useCallback(debounce(() => { onZoom(); loadDebounced(); }, 200), [onZoom, loadDebounced]);

  useEffect(() => {
    load();
    return () => { clearMarkers(); abortRef.current?.abort(); };
  }, [load]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  useMapEvents({
    moveend: loadDebounced,
    zoomend: onZoomDebounced,
  });

  return null;
}
