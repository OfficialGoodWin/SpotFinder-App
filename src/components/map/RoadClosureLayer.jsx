import { useEffect, useRef, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// ─── Icons ────────────────────────────────────────────────────────────────────
const CLOSED_ICON = L.divIcon({
  html: `<div style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.5));line-height:0">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="22" height="22">
      <circle cx="50" cy="50" r="49" fill="white"/>
      <circle cx="50" cy="50" r="44" fill="#CC1111"/>
      <rect x="16" y="38" width="68" height="24" rx="4" fill="white"/>
    </svg></div>`,
  className: '', iconSize: [22,22], iconAnchor: [11,11], popupAnchor: [0,-14],
});

const JAM_ICON = L.divIcon({
  html: `<div style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.5));line-height:0">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 98" width="23" height="21">
      <polygon points="55,6 104,92 6,92" fill="white" stroke="#E07000" stroke-width="9" stroke-linejoin="round"/>
      <g transform="translate(22,68) scale(0.55)">
        <rect x="0" y="10" width="26" height="13" rx="2" fill="#111"/><rect x="3" y="4" width="20" height="10" rx="2" fill="#111"/>
        <rect x="1" y="22" width="5" height="3" rx="1" fill="#444"/><rect x="20" y="22" width="5" height="3" rx="1" fill="#444"/>
      </g>
      <g transform="translate(37,60) scale(0.65)">
        <rect x="0" y="10" width="28" height="14" rx="2" fill="#111"/><rect x="3" y="4" width="22" height="10" rx="2" fill="#111"/>
        <rect x="1" y="23" width="6" height="4" rx="1.5" fill="#444"/><rect x="21" y="23" width="6" height="4" rx="1.5" fill="#444"/>
      </g>
      <g transform="translate(54,50) scale(0.78)">
        <rect x="0" y="12" width="32" height="16" rx="2.5" fill="#111"/><rect x="3" y="4" width="26" height="12" rx="2.5" fill="#111"/>
        <rect x="1" y="27" width="7" height="5" rx="2" fill="#444"/><rect x="24" y="27" width="7" height="5" rx="2" fill="#444"/>
        <rect x="12" y="25" width="9" height="3" rx="1" fill="#cc2222"/>
      </g>
    </svg></div>`,
  className: '', iconSize: [23,21], iconAnchor: [11,10], popupAnchor: [0,-13],
});

const WORKS_ICON = L.divIcon({
  html: `<div style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.5));line-height:0">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="22" height="22">
      <rect x="8" y="8" width="84" height="84" rx="8" fill="#FF8C00" transform="rotate(45 50 50)"/>
      <rect x="12" y="12" width="76" height="76" rx="6" fill="#FFB300" transform="rotate(45 50 50)"/>
      <circle cx="50" cy="28" r="9" fill="#111"/><rect x="39" y="20" width="22" height="6" rx="3" fill="#FF8C00"/>
      <rect x="44" y="37" width="12" height="20" rx="3" fill="#111"/>
      <line x1="44" y1="44" x2="28" y2="52" stroke="#111" stroke-width="5" stroke-linecap="round"/>
      <line x1="56" y1="44" x2="68" y2="38" stroke="#111" stroke-width="5" stroke-linecap="round"/>
      <line x1="28" y1="52" x2="24" y2="68" stroke="#888" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="22" cy="72" rx="6" ry="4" fill="#888"/>
      <line x1="50" y1="57" x2="44" y2="72" stroke="#111" stroke-width="5" stroke-linecap="round"/>
      <line x1="50" y1="57" x2="58" y2="72" stroke="#111" stroke-width="5" stroke-linecap="round"/>
    </svg></div>`,
  className: '', iconSize: [22,22], iconAnchor: [11,11], popupAnchor: [0,-14],
});

// ─── TomTom category helpers ─────────────────────────────────────────────────
const isClosure = cat => [8, 14].includes(cat);
const isJam     = cat => [1, 6, 7, 13].includes(cat);
const isWorks   = cat => [9].includes(cat);

// Minimum zoom level before we even attempt to fetch (TomTom 400s on huge bboxes)
const MIN_ZOOM = 10;

// ─── TomTom event-code → translation key ─────────────────────────────────────
// TomTom returns English phrases in the `events[].description` field.
// We map the event's iconCategory code to a translation key instead.
// iconCategory codes: 1=Accident 2=Fog 3=Dangerous 4=Rain 5=Ice 6=Jam
// 7=LaneClosed 8=RoadClosed 9=RoadWorks 10=Wind 11=Flooding
// 13=BrokenDown 14=RoadClosed
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

  // TomTom v5 has a hard bbox limit. Clamp to ~2° on each axis to avoid 400.
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
    return isClosure(cat) || isJam(cat) || isWorks(cat);
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
  const markersRef   = useRef([]);
  const abortRef     = useRef(null);
  const loadingRef   = useRef(false);
  const lastBoundsRef = useRef(null);
  const cacheRef     = useRef([]);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => { try { map.removeLayer(m); } catch (_) {} });
    markersRef.current = [];
  }, [map]);

  // Translate a TomTom event's iconCategory code into the current language
  const translateEventCode = useCallback((code) => {
    if (!t || !code) return null;
    const key = EVENT_CODE_TO_KEY[code];
    if (!key) return null;
    const translated = t(key);
    // t() returns the key itself if missing — don't show raw key
    return translated !== key ? translated : null;
  }, [t]);

  const makePopupHTML = useCallback((inc) => {
    const titleKey = inc.type === 'closure' ? 'traffic.roadClosed'
                   : inc.type === 'works'   ? 'traffic.roadWorks'
                   : 'traffic.trafficJam';
    const title     = t ? t(titleKey) : inc.title || '—';
    const fromLabel = t ? t('traffic.roadFrom') : 'From';
    const toLabel   = t ? t('traffic.roadTo')   : 'To';

    // Translate the event description via its iconCategory code,
    // fall back to the raw English text TomTom sent
    const eventDesc = inc.eventCode
      ? (translateEventCode(inc.eventCode) || inc.desc || '')
      : (inc.desc || '');

    return `<div style="font-size:13px;line-height:1.5;max-width:210px">
      <strong style="color:#CC1111;font-size:14px">${title}</strong>
      ${inc.road ? `<div style="margin-top:5px">🛣️ ${inc.road}</div>` : ''}
      ${inc.from ? `<div style="margin-top:2px">${fromLabel}: ${inc.from}</div>` : ''}
      ${inc.to   ? `<div style="margin-top:2px">${toLabel}: ${inc.to}</div>` : ''}
      ${eventDesc ? `<div style="margin-top:5px;color:#555;font-size:12px">${eventDesc}</div>` : ''}
    </div>`;
  }, [t, translateEventCode]);

  const renderMarkers = useCallback((incidents) => {
    clearMarkers();
    requestAnimationFrame(() => {
      incidents.forEach(inc => {
        const icon = inc.type === 'closure' ? CLOSED_ICON
                   : inc.type === 'works'   ? WORKS_ICON
                   : JAM_ICON;
        L.marker([inc.lat, inc.lng], { icon, zIndexOffset: 3000, riseOnHover: false, keyboard: false })
          .bindPopup(makePopupHTML(inc), { maxWidth: 220 })
          .addTo(map);
      });
      // Capture newly added markers (all markers added since clearMarkers)
      markersRef.current = [];
      map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer.options.zIndexOffset === 3000) {
          markersRef.current.push(layer);
        }
      });
    });
  }, [map, clearMarkers, makePopupHTML]);

  const load = useCallback(async () => {
    if (!enabled) { clearMarkers(); return; }
    if (loadingRef.current) return;

    // Don't fetch when zoomed too far out — causes TomTom 400 and is useless
    const zoom = map.getZoom();
    if (zoom < MIN_ZOOM) { clearMarkers(); return; }

    const bounds = map.getBounds();

    // Skip refetch if we haven't moved much and have cached data
    if (lastBoundsRef.current && cacheRef.current.length > 0) {
      const prev = lastBoundsRef.current;
      const dist = haversineM(
        [prev.getCenter().lat, prev.getCenter().lng],
        [bounds.getCenter().lat, bounds.getCenter().lng]
      );
      const viewSize = haversineM(
        [prev._southWest.lat, prev._southWest.lng],
        [prev._northEast.lat, prev._northEast.lng]
      );
      if (dist < viewSize * 0.2) {
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
          const type = isClosure(cat) ? 'closure' : isWorks(cat) ? 'works' : 'jam';
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
        // Silently suppress — Overpass fallback below
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

  // 1200ms debounce — prevents hammering TomTom while user is zooming
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadDebounced = useCallback(debounce(load, 1200), [load]);

  useEffect(() => {
    load();
    return () => { clearMarkers(); abortRef.current?.abort(); };
  }, [load]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  useMapEvents({ moveend: loadDebounced, zoomend: loadDebounced });

  return null;
}