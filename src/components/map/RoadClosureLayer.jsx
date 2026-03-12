import { useEffect, useRef, useState, useCallback } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
 
// ── Icon: No-entry sign (closed road) ────────────────────────────────────────
const NO_ENTRY_ICON = L.divIcon({
  html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.45));line-height:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="36" height="36"><circle cx="50" cy="50" r="49" fill="white"/><circle cx="50" cy="50" r="44" fill="#CC1111"/><rect x="16" y="38" width="68" height="24" rx="4" fill="white"/></svg></div>`,
  className: '',
  iconSize:    [36, 36],
  iconAnchor:  [18, 18],
  popupAnchor: [0, -20],
});
 
// ── Icon: Traffic-jam warning sign ───────────────────────────────────────────
const JAM_ICON = L.divIcon({
  html: `<div style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.45));line-height:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 98" width="40" height="36"><polygon points="55,4 106,94 4,94" fill="white" stroke="#CC1111" stroke-width="10" stroke-linejoin="round"/><g transform="translate(22,60) scale(0.72)"><rect x="0" y="8" width="28" height="14" rx="2" fill="#111"/><rect x="4" y="2" width="20" height="10" rx="2" fill="#111"/><circle cx="6" cy="23" r="4" fill="#444"/><circle cx="22" cy="23" r="4" fill="#444"/></g><g transform="translate(38,54) scale(0.82)"><rect x="0" y="8" width="30" height="15" rx="2" fill="#111"/><rect x="4" y="2" width="22" height="10" rx="2" fill="#111"/><circle cx="6" cy="24" r="4" fill="#444"/><circle cx="24" cy="24" r="4" fill="#444"/></g><g transform="translate(56,48) scale(0.92)"><rect x="0" y="8" width="32" height="16" rx="2" fill="#111"/><rect x="5" y="2" width="22" height="10" rx="2" fill="#111"/><circle cx="7" cy="25" r="5" fill="#444"/><circle cx="25" cy="25" r="5" fill="#444"/></g></svg></div>`,
  className: '',
  iconSize:    [40, 36],
  iconAnchor:  [20, 18],
  popupAnchor: [0, -20],
});
 
// ── TomTom incident categories ────────────────────────────────────────────────
// 6 = Traffic Jam  |  13 = Road Closed
const isClosure = cat => cat === 13 || cat === 'ROAD_CLOSED';
const isJam     = cat => cat === 6  || cat === 'JAM';
 
// ── Debounce helper ───────────────────────────────────────────────────────────
function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}
 
// ── TomTom Incidents API v5 ───────────────────────────────────────────────────
async function fetchIncidents(bounds, apiKey) {
  const { _southWest: sw, _northEast: ne } = bounds;
  const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
  const fields = '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,from,to,roadNumbers,description,events{description,code,iconCategory}}}}';
  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&fields=${fields}&language=en-GB&timeValidityFilter=present&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TomTom incidents ${res.status}`);
  const data = await res.json();
  return (data.incidents || []).filter(inc => {
    const cat = inc.properties?.iconCategory;
    return isClosure(cat) || isJam(cat);
  });
}
 
function midpoint(geometry) {
  const coords = geometry.coordinates;
  if (geometry.type === 'Point') return { lat: coords[1], lng: coords[0] };
  const mid = coords[Math.floor(coords.length / 2)];
  return { lat: mid[1], lng: mid[0] };
}
 
// ── Component ─────────────────────────────────────────────────────────────────
export default function RoadClosureLayer({ apiKey, enabled }) {
  const map = useMap();
  const [incidents, setIncidents] = useState([]);
  const abortRef = useRef(null);
 
  const load = useCallback(async () => {
    if (!apiKey || !enabled) { setIncidents([]); return; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      setIncidents(await fetchIncidents(map.getBounds(), apiKey));
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('Incident fetch failed:', err.message);
    }
  }, [map, apiKey, enabled]);
 
  const loadDebounced = useDebounce(load, 600);
  useEffect(() => { load(); }, [load]);
  useMapEvents({ moveend: loadDebounced, zoomend: loadDebounced });
 
  if (!apiKey || !enabled || incidents.length === 0) return null;
 
  return incidents.map(inc => {
    if (!inc.geometry) return null;
    const { lat, lng } = midpoint(inc.geometry);
    const props  = inc.properties || {};
    const cat    = props.iconCategory;
    const closed = isClosure(cat);
    const from   = props.from || '';
    const to     = props.to   || '';
    const roads  = (props.roadNumbers || []).join(', ');
    const desc   = props.events?.[0]?.description || props.description || '';
 
    return (
      <Marker
        key={props.id || `${lat}-${lng}`}
        position={[lat, lng]}
        icon={closed ? NO_ENTRY_ICON : JAM_ICON}
        zIndexOffset={2000}
      >
        <Popup>
          <div style={{ minWidth: 160, fontSize: 13 }}>
            <strong style={{ color: '#CC1111' }}>
              {closed ? '⛔ Road Closed' : '🚦 Traffic Jam'}
            </strong>
            {roads && <div style={{ marginTop: 4 }}>🛣️ {roads}</div>}
            {from  && <div style={{ marginTop: 2 }}>From: {from}</div>}
            {to    && <div style={{ marginTop: 2 }}>To: {to}</div>}
            {desc  && <div style={{ marginTop: 4, color: '#555', fontSize: 12 }}>{desc}</div>}
          </div>
        </Popup>
      </Marker>
    );
  });
}
 