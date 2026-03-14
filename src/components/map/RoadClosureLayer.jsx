import { useEffect, useRef, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// No-entry SVG icon (road closed)
const NO_ENTRY_HTML = `<div style="filter:drop-shadow(0 2px 6px rgba(0,0,0,.55));line-height:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="44" height="44"><circle cx="50" cy="50" r="49" fill="white"/><circle cx="50" cy="50" r="44" fill="#CC1111"/><rect x="16" y="38" width="68" height="24" rx="4" fill="white"/></svg></div>`;

// Warning triangle with cars (traffic jam)
const JAM_HTML = `<div style="filter:drop-shadow(0 2px 6px rgba(0,0,0,.55));line-height:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 90" width="46" height="42"><polygon points="50,5 97,85 3,85" fill="#FFD600" stroke="#CC6600" stroke-width="5" stroke-linejoin="round"/><text x="50" y="75" font-size="40" text-anchor="middle" fill="#333">🚗</text></svg></div>`;

const makeIcon = (html, size) => L.divIcon({
  html,
  className: '',
  iconSize: size,
  iconAnchor: [size[0] / 2, size[1] / 2],
  popupAnchor: [0, -size[1] / 2 - 4],
});

const CLOSED_ICON = makeIcon(NO_ENTRY_HTML, [44, 44]);
const JAM_ICON    = makeIcon(JAM_HTML,    [46, 42]);

// TomTom incident category helpers
const isClosure = cat => [8, 14].includes(cat);
const isJam     = cat => [1, 6, 7, 9, 13].includes(cat);

function midpoint(geometry) {
  const c = geometry.coordinates;
  if (geometry.type === 'Point') return [c[1], c[0]];
  const m = c[Math.floor(c.length / 2)];
  return [m[1], m[0]];
}

async function fetchTomTomIncidents(bounds, apiKey) {
  const { _southWest: sw, _northEast: ne } = bounds;
  const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
  const fields = encodeURIComponent('{incidents{type,geometry{type,coordinates},properties{id,iconCategory,from,to,roadNumbers,events{description,iconCategory}}}}');
  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=${bbox}&fields=${fields}&language=en-GB&timeValidityFilter=present&key=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`TomTom ${res.status}`);
  const data = await res.json();
  return (data.incidents || []).filter(i => {
    const cat = i.properties?.iconCategory;
    return isClosure(cat) || isJam(cat);
  });
}

// Overpass fallback – permanent OSM road closures (no key needed)
async function fetchOverpassClosures(bounds) {
  const { _southWest: sw, _northEast: ne } = bounds;
  const bbox = `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
  const query = `[out:json][timeout:10];(way["access"="no"]["highway"](${bbox});way["motor_vehicle"="no"]["highway"](${bbox}););out center;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error('Overpass API error');
  const data = await res.json();
  return (data.elements || []).slice(0, 20).map(el => ({
    _type: 'closure',
    lat: el.center?.lat || el.lat,
    lng: el.center?.lon || el.lon,
    label: el.tags?.name || el.tags?.ref || 'Road Closed',
    road: el.tags?.ref || '',
  })).filter(e => e.lat && e.lng);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RoadClosureLayer({ apiKey, enabled }) {
  const map = useMap();
  const markersRef = useRef([]);
  const timerRef   = useRef(null);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
  }, [map]);

  const load = useCallback(async () => {
    if (!enabled) { clearMarkers(); return; }
    clearMarkers();

    const bounds = map.getBounds();
    let incidents = [];

    if (apiKey) {
      try {
        const raw = await fetchTomTomIncidents(bounds, apiKey);
        incidents = raw.map(inc => {
          if (!inc.geometry) return null;
          const [lat, lng] = midpoint(inc.geometry);
          const p = inc.properties || {};
          const closed = isClosure(p.iconCategory);
          return {
            lat, lng,
            icon: closed ? CLOSED_ICON : JAM_ICON,
            title: closed ? '⛔ Road Closed' : '🚦 Traffic Jam',
            road: (p.roadNumbers || []).join(', '),
            from: p.from || '',
            to: p.to || '',
            desc: p.events?.[0]?.description || '',
          };
        }).filter(Boolean);
      } catch (err) {
        console.warn('[RoadClosureLayer] TomTom failed, trying Overpass fallback:', err.message);
      }
    }

    // If no TomTom key (or it failed), use Overpass
    if (incidents.length === 0) {
      try {
        const overpass = await fetchOverpassClosures(bounds);
        incidents = overpass.map(o => ({
          lat: o.lat, lng: o.lng,
          icon: CLOSED_ICON,
          title: '⛔ Road Closed',
          road: o.road,
          from: '', to: '',
          desc: o.label,
        }));
      } catch (err) {
        console.warn('[RoadClosureLayer] Overpass fallback also failed:', err.message);
      }
    }

    // Create Leaflet markers imperatively (avoids React-Leaflet rendering issues)
    incidents.forEach(inc => {
      const popup = L.popup({ maxWidth: 220 }).setContent(
        `<div style="font-size:14px;line-height:1.4">
          <strong style="color:#CC1111;font-size:15px">${inc.title}</strong>
          ${inc.road ? `<div style="margin-top:6px">🛣️ ${inc.road}</div>` : ''}
          ${inc.from  ? `<div style="margin-top:3px">From: ${inc.from}</div>` : ''}
          ${inc.to    ? `<div style="margin-top:3px">To: ${inc.to}</div>` : ''}
          ${inc.desc  ? `<div style="margin-top:6px;color:#555;font-size:13px">${inc.desc}</div>` : ''}
        </div>`
      );
      const marker = L.marker([inc.lat, inc.lng], { icon: inc.icon, zIndexOffset: 5000 })
        .bindPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    });
  }, [map, apiKey, enabled, clearMarkers]);

  const scheduleLoad = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(load, 700);
  }, [load]);

  useEffect(() => { load(); return () => clearMarkers(); }, [load]);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  useMapEvents({ moveend: scheduleLoad, zoomend: scheduleLoad });

  return null; // Markers added imperatively to map
}
