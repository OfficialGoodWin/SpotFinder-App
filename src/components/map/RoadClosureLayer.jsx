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
  html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.45));line-height:0;background:transparent"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAdCAYAAADLnm6HAAAEV0lEQVR42u2WX0yTZxjFz/d9tPxxtDAQhsC2kk5XpnHZqLolZG6pwWiykN0sW3Q3HYQQ2mhC5hZjqjSb2dQw2CbT4YLUxM9hdiGYMIkUTcU6tVgWMsKIoK2rq7aAtrS0tGcXS8iyJYsdblf8kvfufc57kpPz5gGWWGKJRXDswB7aT3zBxWikpTqw471qVq57Ec+sKMDLletwseMIGHASYgYufn8Wrxl3C6noCaka4INxgrOAEAUYxu0vrUiEpiBkqhAS0rHavBuIpeHksS68++HnwmM1cL7rGMN3RqGI3IcmLwvLYkGoInehylYgEQO807PwzooQl2vx0tbtyHj+deGxRdC4w0SNRgPNG3oM2g4D8VmUrFkLJHRAMoHg2C9I5opIV2Wg4s3tQJHukXSlRzUw6Pxx34q87L2qRBQVmw3IX7sGQ9/JKCp9Cgg9xLLSpzHzWwDTkXnkr9BAoS7EvZnZvVevXd/3T7piKhE8iM5jDkpAXQh4AlAoMzA/chm4M4TE0Dksi/wK5UMvrv/Qhfsjgzj0Uf3jbUHxs8+hYutbQDKM093nUarIhD/oRXpsCtPzaYhl5KLinfeBQi3wxHJgPh3+cTf3fHIIR77tFBbV+aaPPyNJHm/7iowEyDk/6RnkzMkPONn8Nnn7LO2f1jBwqYv0/UTG/Dxx+ACZjHJiYmJRfwXaO44zTtJ39z6vOa9wbibIk1+3/GHi53NMXDtNRibIqI/+URcDk6O8NznGUMDHoatOJknenQrzX9cwNh/n5cEr+OboUehWrcQLq3VYWaaBbnU5wDgQmwOUGbh8wQH9K68iOhfDqVOncMFxCVqtFrlP5qPBZMLo6BjKdatSi+LgwYO02+2sra0lSdbW1jItLY1qtZrV1dWUZZkjIyMkSavVSpJUKBQEwG3btjEajVKWZba3t3NycjL1KFwuF41GI9evX0+SbGxspEKhoCiKBEBRFJmVlUW9Xs8tW7YwFouxv7+fkiQxNzeXLS0t1Gq1NBqNjEQiqRsYHh6mxWIhgL8dpVJJSZJYUFDAmzdvsru7m319fSS5cEetVhMA3W43XS5X6gbsdvuC4MaNG1lfX8/i4uKFBzIzMylJEoPBIIeHh9nQ0ECS7OjoYCgU4sDAAPV6Paempmiz2VI3cObMGfp8Pu7atYtOp5PJZJIk6fF42NrayqqqKhYVFTEnJ4d5eXmUZZnBYJBOp5P9/f30+Xwkyb6+PjocDqbcgp6eHnq9XtTU1MDtdsNms6GwsBA6nQ5lZWUoLy/H/v37YbVaYbFYUFdXh97eXoyPj6O0tBQejwclJSWIx+NwOByw2WxCyjVsbW1lPB6HKIrYuXOnAADNzc30+/3YsGEDVCoVbty4AZPJBFmWMTY2hqamJgEAzGYzDQYDbt26BZPJJCx6H/gzbW1tVKlUqKysRHZ2Njo7OyEIAsxms/CfLSR/xWKxUJIkhMNhGAwGbNq0adGaS/yv/A742mQXcfkoTQAAAABJRU5ErkJggg==" width="32" height="29" style="display:block;image-rendering:pixelated"/></div>`,
  className: '', iconSize: [32,29], iconAnchor: [16,14], popupAnchor: [0,-14],
});

// ─── LANE CLOSED: PNG with background removed
const LANE_CLOSED_ICON = L.divIcon({
  html: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABsAAAAgCAYAAADjaQM7AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAZdEVYdFNvZnR3YXJlAFBhaW50Lk5FVCA1LjEuMTITAUd0AAAAuGVYSWZJSSoACAAAAAUAGgEFAAEAAABKAAAAGwEFAAEAAABSAAAAKAEDAAEAAAACAAAAMQECABEAAABaAAAAaYcEAAEAAABsAAAAAAAAAGAAAAABAAAAYAAAAAEAAABQYWludC5ORVQgNS4xLjEyAAADAACQBwAEAAAAMDIzMAGgAwABAAAAAQAAAAWgBAABAAAAlgAAAAAAAAACAAEAAgAEAAAAUjk4AAIABwAEAAAAMDEwMAAAAADZp5qVybcLXwAAApdJREFUSEvtVs9vEkEUfksZBIRSCOVnjY0JFyUhaNuDJt5NajyaNNV48N6Ll/49vTW1Hrx4wVJba2OIMa3xRJQQE5MmFuXQpoD7nPe6M9kCoWzZm/3ItzPvm93vvbcDu8Al3IBhjUOjEo2iNYWZRsPR9R5rHBoik4GxaJRHp3CU7EN6EkUqBVemp4HGj5mE7tJVPLgxibIyfLG4iH82NphfZmfx/ZO7ria8apFMMR6Po9lqMQ/X19Ht7ibePJ7jRMRIJKKTEZ10N9Seic1v1qwXmeVlEKWqFQ3GuclkV41A+poVATSbTdja3rYi2fb8PASz18GVvSul4vh9ZUXfRuL4+Dh+rlTc3TuqdqdYxMODgzPJiNlsFmvV6oX2ri+oWurKnswwDD1PJBJYLpVG746qpGqPmk2mlJjBYBCFEDqm+cvV1dG6oyqp2vbxMVNKTL/fj+VyGZPJpNZ8Ph++Wlu7WHeqK7UfRClrEur1OuZyOY5DoRD/2AmOu1NdDUpG+FGrcRwOhzEWi7HmqLvdR7d7uupORjFB6bRv9GVRGl1PPnJtMOh91d2VMlXsp6fTaa3R9fb3Xl9szU1hdWFBV2inXNbspwcCAa0RyIf85Fov3j6/xdUc7e/zyXZDojxF8zydQD7kR75yjaGfjcGdX5BaWoJAPm8po4F8yI98z2D32R3cy+fRPDnhqghqPqiDbp3P7/IgX/KX66edic2f/KoAwwBst5lqrlAsFnksFAo8Kth1+3Vqzq8g6U8w9p7ew9brrxwMwm/ThEqnAzNeL0x4Tu8+aYR30vi+EFrvB9/Dm2B8yk2hdQ8kAcy/HTCliVf4tCaPPCqQLh/IVsQNyP+E8kOjPHTaLfDIxJ4xr9Yc/ee7xP8IgH9uFrEBbXBA4AAAAABJRU5ErkJggg=="
              width="27" height="32"
              style="display:block;image-rendering:pixelated"/>`,
  className: 'leaflet-div-icon-clean',
  iconSize: [27,32], iconAnchor: [13,16], popupAnchor: [0,-16],
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

// Returns true when the new bounds have shifted enough to warrant a fresh fetch
// (centre moved > 40% of the current viewport diagonal).
function boundsChangedSignificantly(prev, next) {
  if (!prev) return true;
  const latSpan = next._northEast.lat - next._southWest.lat;
  const lngSpan = next._northEast.lng - next._southWest.lng;
  const threshold = Math.sqrt(latSpan * latSpan + lngSpan * lngSpan) * 0.40;
  const prevCLat = (prev._northEast.lat + prev._southWest.lat) / 2;
  const prevCLng = (prev._northEast.lng + prev._southWest.lng) / 2;
  const nextCLat = (next._northEast.lat + next._southWest.lat) / 2;
  const nextCLng = (next._northEast.lng + next._southWest.lng) / 2;
  const dist = Math.sqrt((nextCLat - prevCLat) ** 2 + (nextCLng - prevCLng) ** 2);
  return dist > threshold;
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

// Overpass removed — TomTom incidents are the sole source for road closures.

// ─── Component ────────────────────────────────────────────────────────────────
export default function RoadClosureLayer({ apiKey, enabled, lang, t }) {
  const map = useMap();
  const markersRef = useRef([]);
  const abortRef   = useRef(null);
  const fetchingRef = useRef(false);
  const cacheRef   = useRef([]);
  const lastFetchedBoundsRef = useRef(null);

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

  // renderMarkers: add new markers FIRST, then remove old ones — eliminates stutter
  const renderMarkers = useCallback((incidents) => {
    const zoom = map.getZoom();
    const newMarkers = [];

    incidents.forEach(inc => {
      const threshold = ZOOM[inc.type] ?? 0;
      if (zoom <= threshold) return;

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

    // Swap: remove old only after new are already painted
    markersRef.current.forEach(m => { try { map.removeLayer(m); } catch (_) {} });
    markersRef.current = newMarkers;
  }, [map, makePopupHTML]);

  // load: fetch fresh data from TomTom/Overpass and render
  const load = useCallback(async () => {
    if (!enabled) { clearMarkers(); return; }
    if (fetchingRef.current) return;

    const bounds = map.getBounds();

    // Skip fetch if the map hasn't moved significantly since last fetch
    if (!boundsChangedSignificantly(lastFetchedBoundsRef.current, bounds)) return;

    // Skip Overpass fallback entirely when zoomed out too far
    const zoom = map.getZoom();

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

    // (Overpass fallback removed — avoids 429 rate-limit errors.)

    fetchingRef.current = false;
    if (ctrl.signal.aborted) return;
    lastFetchedBoundsRef.current = bounds;
    cacheRef.current = incidents;
    renderMarkers(incidents);
  }, [map, apiKey, enabled, clearMarkers, renderMarkers]);

  // onZoom: re-render cached data immediately with new zoom thresholds applied.
  const onZoom = useCallback(() => {
    if (!enabled) { clearMarkers(); return; }
    if (cacheRef.current.length > 0) {
      renderMarkers(cacheRef.current);
    }
  }, [enabled, clearMarkers, renderMarkers]);

  // moveend debounce at 1800ms — avoids thrashing the TomTom API
  const loadDebounced = useCallback(debounce(load, 1800), [load]);
  const onZoomDebounced = useCallback(debounce(() => { onZoom(); loadDebounced(); }, 200), [onZoom, loadDebounced]);

  // Clear markers immediately and synchronously when disabled (layer switch)
  // This runs BEFORE the load() effect so there is no flash of cached icons
  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      clearMarkers();
      cacheRef.current = [];
      lastFetchedBoundsRef.current = null; // force fresh fetch when re-enabled
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