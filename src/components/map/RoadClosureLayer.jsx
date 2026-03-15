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

// ─── ACCIDENT: embedded PNG icon (user-provided, black bg removed)
const ACCIDENT_ICON = L.divIcon({
  html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.45));line-height:0"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAdCAYAAADLnm6HAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAEIklEQVR42u2WX0zbVRzFz6/8nZMOHBOH/LEEN4ssM0oHmhDRdNnCEkN8MRrmS4UQYpuRENGMBQaRRceCoA43mWF0yX7IYsKfJTgyYEsHnWOFYhoJEv6sncWOFthaWlra44Nxccmi1BKf+Lzee0/OvSfnmwtssskmIXDu5DEOXPiSoWiEB3vgyPsFzN33ElITn8YruftwvfUMaNcTkmhc/+EyXlcdFYLRE4I1wPtTBFcAwQPQhTtf1cLvXISwRQqnEIVMzVHAG46L5zrw3sdfCBtq4GrHObruTiDCvQDZ9iew1euA1D0PaUwE/F7AsrQCy4oEkh3pePnQYUS/8IawYRGUH1FTJpNB9qYCQ9rTgG8FSXv2An45EPDDMfkrAnESREmjkfXWYWCnfF26Yes1MKT/6Xji9phqqd+DrINKxO/dg9HvRexMfgZwPsDW5BQs/27HknsN8YkyRGxLwL3llepbI7eP/5OuJJgI7nvWsIpIYFsCYLYjIjIaa6Zh4O4o/KNXsNX9GyIfWHD7xw4smIZw6pPSjW3Bs889j6xDbwMBFy51X0VyxBbYHBZEeRextBYOb3Qcst79AEhIB57cAaxFwTZl5LG6UzjzXZsQUudrPv2cJHm++WvSbSdXbaR5iMsXP+Jswzvkncsc+KyI9hsdpPVn0mvjhdMnyYCHMzMzIc0KtLSep4+kdX6BI/qbXF128OI3jX+a+OUK/SOXSPcM6bHSNmGgfXaC92Yn6bRbOXpLzwDJ+UUX/3MNvWs+Dg/dxLdnz0K+exdezJRjV5oM8swMgD7AuwpERmP4mg6KV1+DZ9WL9vZ2XNPdQHp6OuKeiseHajUmJiaRId8dXBT19fUcGBhgcXExSbK4uPjhTQoKCiiKIk0mE0mytraWJB+uFxYW0uPxUBRFtrS0cHZ2NvgoDAYDVSoVs7OzSZLl5eWPFVEoFMzPz6fX62V/f//DPY2NjQQAlUpFt9sdvIHx8XFWVVX968Hp6Wl2d3ezr6/vkVf4C6PRSIPBwKDngN1uR3V1NQAgLy+PpaWljzUTGxuL1NRUdHZ2AgBaW1vpdDo5ODhIhULBlJQUmEym4BvQ1dVFq9XKiooK6vV6BgIBkqTZbGZTUxMPHDjwiCFRFOlwOKjX69nf30+r1UqS7Ovro06nY9At6OnpocViQVFREYxGI7RaLRISEiCXy5GWloaMjAycOHEClZWVQl1dHUtKStDb24upqSkkJyfDbDYjKSkJPp8POp0OWq1WCLqGTU1N9Pl8kEgkKCsrEwCgoaGBNpsNOTk5kEqlGBsbg1qthiiKmJycRE1NjQAAGo2GSqUSc3NzUKvVQsj/gb/T3NxMqVSK3NxcxMTEoK2tDYIgQKPRrFs3tPkMoKqqimFhYXC5XFAqldi/f3/Impv8r/wBuM4vtbKBO5AAAAAASUVORK5CYII=" width="32" height="29" style="display:block;image-rendering:pixelated"/></div>`,
  className: '', iconSize: [32,29], iconAnchor: [16,14], popupAnchor: [0,-14],
});

// ─── LANE CLOSED: embedded PNG icon (user-provided, black bg removed)
const LANE_CLOSED_ICON = L.divIcon({
  html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.45));line-height:0"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABsAAAAgCAYAAADjaQM7AAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAEM0lEQVR42u2WS2xVVRiFv3Pu69xXb2ubcKOUlhICKiBpgyhQBBuLqDxtY6GUQMPLAAMlzgiJAxJHDhlgSCAIMWpES2KIEdAUEYOaICpgFAhCH/S2t7f3cc655/E7cXK4IBRK4oB/ttc+a62z/j87e8OjGoNSRkvY+cxsqVB8OFLko3M/8vMoNNTRmj1eXkaZY1MXixMZJXdUZtua50q0qoyJT02morKSlfWzHk6/Z8+oEYB3ly8W/ejnIsePy57mRbJ3bYc81EFLdkCk57pkv+iS3XPnyZi2cff69V7BQAAiGrEFC6kuH8fHa9bImJnlrvR51k4ojh0uA8eho2Mt/ZevjU2yw62bZIL2mAc7ebwbJRiAYBjmzSFenuDQxo0PPrtdU56T3IGjJULd3T+J6K5IakjShw7L+41N8kDJ9nVukQmTJxKtf7pkr7GxQRlM3YRYgPKm+cS1KEc6t8l9m/VeuEhz21Lw6bfdr6pOKt+f+RYiPt7Y0Mnv53+9v2Qntr4jyVgZ1S/OhrqqOwrMWfCacvK7b4i//ALRZBX72u9jdrumzBT7ky6RXK9knH6PwKlTp0oEv/5wv1w90iXvzVk0OrP9b26SvStbRXp7RdcHJSNFj4AURa78da1EVPSCfLC4VT5t33DvhjtnNUiq6zORwqDYUig1yzoirsiFC5e8eGFYCl98KbumN8g9zexgy3J5sqaaynkzQTWwrQJhXM83upMHxWLq1IlesqYQnjud8dNqObimTe5qdvm3i7yyZAlENGxF8Pn8qK6XF05EsdwieSNXejsmwjS3tXDp7C88D3du556mV+XE9h0igymRYlpMc1BcsSSbK3hItiOiiymWWB58JDsglgyLmGn5asN2ObBwmdw22bEtOyTfN8TC1avAp4Bh4VeCODYo4vP8lGmauI5NwTA8eDyWIGNZoKq89Nbb/H2jl4Ptm6XE7I/z52hZuQLGJyHkh0AIVfz4XYhGgx7RSNBHxOcjpnlxyRuEAxr4VUgmWNbRxsj1G95k+7auk0RQoba9BSJ+sC1IZ8BxIG+AYXv7PTIMw4Oo+WzJyCKWBUUdAi7TOttIWEWO/XvQ1fkgqdPdrG1fCpoNeh76+0EsGEmDbcLNPlqrxwvA65UVgmVCwQBDZ13NEwKwuaZWSKVgYAgMEzL9oBi0r1pB5txZGkGU06uXyp9XrzCUGcEWcIughjWUaAzdsKDoEo5ESLsmPT09TEomCSkKYhkMj2TRogl6+vpIJBLU1tXRM9CH7XPxR/1ous24dJGYFiI2YxLK4WfrJW3ksSIhApEYjuWiuAoqKqZeJBQKk7dMCjjEo2GsdIZyLYyIA6gUbcFRVELxKNlcjmAggG4bBMs0FNukwlZQHAc3pKI0geSAH255/zWABIAzt+D1IEHADxhACCgCZ+/yfqz/rzP3qP639Q/tMvgkAOyV4gAAAABJRU5ErkJggg==" width="27" height="32" style="display:block;image-rendering:pixelated"/></div>`,
  className: '', iconSize: [27,32], iconAnchor: [13,16], popupAnchor: [0,-16],
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
    if (!enabled) { clearMarkers(); return; }   // ← fix: don't flash icons on other layers
    if (cacheRef.current.length > 0) {
      renderMarkers(cacheRef.current);
    }
  }, [enabled, clearMarkers, renderMarkers]);

  const loadDebounced = useCallback(debounce(load, 900), [load]);
  const onZoomDebounced = useCallback(debounce(() => { onZoom(); loadDebounced(); }, 200), [onZoom, loadDebounced]);

  // Clear markers immediately and synchronously when disabled (layer switch)
  // This runs BEFORE the load() effect so there is no flash of cached icons
  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      clearMarkers();
      cacheRef.current = [];
    }
  }, [enabled, clearMarkers]);

  useEffect(() => {
    if (!enabled) return;
    load();
    return () => { clearMarkers(); abortRef.current?.abort(); };
  }, [load, enabled]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  useMapEvents({
    moveend: loadDebounced,
    zoomend: onZoomDebounced,
  });

  return null;
}