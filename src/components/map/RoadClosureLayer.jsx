import { useEffect, useRef, useState, useCallback } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// ── No-entry sign as an inline SVG ───────────────────────────────────────────
// Matches the standard EU/Czech "zákaz vjezdu" road sign.
const NO_ENTRY_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="36" height="36">
    <!-- White border ring -->
    <circle cx="50" cy="50" r="49" fill="white"/>
    <!-- Red disc -->
    <circle cx="50" cy="50" r="44" fill="#CC1111"/>
    <!-- White horizontal bar -->
    <rect x="16" y="38" width="68" height="24" rx="4" fill="white"/>
  </svg>
`.trim();

const NO_ENTRY_ICON = L.divIcon({
  html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.45));line-height:0">${NO_ENTRY_SVG}</div>`,
  className: '',
  iconSize:   [36, 36],
  iconAnchor: [18, 18],
  popupAnchor:[0, -20],
});

// ── Debounce helper ───────────────────────────────────────────────────────────
function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

// ── Incident fetcher ──────────────────────────────────────────────────────────
async function fetchClosures(bounds, apiKey) {
  // TomTom Traffic Incidents API v5
  // https://developer.tomtom.com/traffic-api/documentation/traffic-incidents/incident-details
  const { _southWest: sw, _northEast: ne } = bounds;
  const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
  const url = [
    'https://api.tomtom.com/traffic/services/5/incidentDetails',
    `?bbox=${bbox}`,
    '&fields={incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,startTime,endTime,from,to,length,delay,roadNumbers,description,causeOfAccident,events{description,code,iconCategory}}}}',
    '&language=en-GB',
    '&timeValidityFilter=present',
    `&key=${apiKey}`,
  ].join('');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`TomTom incidents ${res.status}`);
  const data = await res.json();
  return (data.incidents || []).filter(inc => {
    // iconCategory 13 = road closed, also catch delay category 0 (undefined/closure)
    const cat = inc.properties?.iconCategory;
    return cat === 13 || cat === 'ROAD_CLOSED';
  });
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RoadClosureLayer({ apiKey, enabled }) {
  const map           = useMap();
  const [closures, setClosures] = useState([]);
  const abortRef      = useRef(null);

  const load = useCallback(async () => {
    if (!apiKey || !enabled) { setClosures([]); return; }
    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const bounds = map.getBounds();
      const results = await fetchClosures(bounds, apiKey);
      setClosures(results);
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('Road closure fetch failed:', err.message);
    }
  }, [map, apiKey, enabled]);

  const loadDebounced = useDebounce(load, 600);

  // Load on mount and whenever the map stops moving
  useEffect(() => { load(); }, [load]);
  useMapEvents({ moveend: loadDebounced, zoomend: loadDebounced });

  if (!apiKey || !enabled || closures.length === 0) return null;

  return closures.map(inc => {
    const coords = inc.geometry?.coordinates;
    if (!coords) return null;

    // Geometry can be a Point [lng, lat] or LineString [[lng,lat],...]
    // For LineString use the midpoint; for Point use directly.
    let lat, lng;
    if (inc.geometry.type === 'Point') {
      [lng, lat] = coords;
    } else {
      // midpoint of the line
      const mid = Math.floor(coords.length / 2);
      [lng, lat] = coords[mid];
    }

    const props  = inc.properties || {};
    const from   = props.from   || '';
    const to     = props.to     || '';
    const roads  = (props.roadNumbers || []).join(', ');
    const desc   = props.events?.[0]?.description || props.description || 'Road closed';

    return (
      <Marker
        key={props.id || `${lat}-${lng}`}
        position={[lat, lng]}
        icon={NO_ENTRY_ICON}
      >
        <Popup>
          <div style={{ minWidth: 160, fontSize: 13 }}>
            <strong style={{ color: '#CC1111' }}>⛔ Road Closed</strong>
            {roads && <div style={{ marginTop: 4 }}>🛣️ {roads}</div>}
            {from  && <div style={{ marginTop: 2 }}>From: {from}</div>}
            {to    && <div style={{ marginTop: 2 }}>To: {to}</div>}
            <div style={{ marginTop: 4, color: '#555', fontSize: 12 }}>{desc}</div>
          </div>
        </Popup>
      </Marker>
    );
  });
}
