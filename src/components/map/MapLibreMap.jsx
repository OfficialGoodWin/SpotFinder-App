/**
 * MapLibreMap.jsx
 * Replaces: MapContainer, TileLayer, OfflineTileLayer, SpotMarker,
 *           UserLocationMarker, AmbientPOILayer, POILayer,
 *           RoadClosureLayer, RouteOverlay, MapController, MapClickHandler
 *
 * Online:  OpenFreeMap vector tiles — styled to match Mapy.cz
 * Offline: local PMTiles file read from OPFS via pmtiles library
 * Dark:    full dark variant, switches instantly via setStyle()
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { lightStyle, darkStyle } from '../../lib/mapStyle.js';
import { COUNTRIES, isPointInCountry, getDownloadedCountryAt, vtKey } from '../../lib/vectorTileDownloader.js';
import { getAllMeta, getPOIs, getTile } from '../../lib/offlineStorage.js';

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '';
const TOMTOM_KEY   = import.meta.env.VITE_TOMTOM_API_KEY || '';

// Register protocols once globally
let protocolsRegistered = false;
function ensureProtocols() {
  if (protocolsRegistered) return;
  // PMTiles protocol — used for online streaming
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol));

  // Offline vector tile protocol — serves from IndexedDB
  // URL format: offline-vt://z/x/y
  maplibregl.addProtocol('offline-vt', async (params, abortController) => {
    try {
      const parts = params.url.replace('offline-vt://', '').split('/');
      const [z, x, y] = parts.map(Number);
      const key = vtKey(z, x, y);
      const buf = await getTile(key);
      if (buf) return { data: buf };
    } catch (_) {}
    // Not cached — return empty tile
    return { data: new ArrayBuffer(0) };
  });

  protocolsRegistered = true;
}

// ── Ambient POI categories ────────────────────────────────────────────────────
const AMBIENT_CATS = [
  { key:'train',       minZoom:13, icon:'🚆', color:'#34495E', geo:'public_transport.train' },
  { key:'fuel',        minZoom:13, icon:'⛽', color:'#E74C3C', geo:'service.vehicle.fuel' },
  { key:'charging',    minZoom:13, icon:'🔌', color:'#27AE60', geo:'service.vehicle.charging_station' },
  { key:'hotel',       minZoom:13, icon:'🏨', color:'#2980B9', geo:'accommodation.hotel' },
  { key:'museum',      minZoom:13, icon:'🏛️', color:'#34495E', geo:'entertainment.museum' },
  { key:'heritage',    minZoom:13, icon:'🏰', color:'#95A5A6', geo:'heritage' },
  { key:'hospital',    minZoom:13, icon:'🏥', color:'#C0392B', geo:'healthcare.hospital' },
  { key:'restaurant',  minZoom:15, icon:'🍽️', color:'#E74C3C', geo:'catering.restaurant' },
  { key:'cafe',        minZoom:15, icon:'☕', color:'#8B4513', geo:'catering.cafe' },
  { key:'bar',         minZoom:15, icon:'🍺', color:'#D68910', geo:'catering.bar' },
  { key:'pharmacy',    minZoom:15, icon:'💊', color:'#E67E22', geo:'healthcare.pharmacy' },
  { key:'bank',        minZoom:15, icon:'🏦', color:'#F39C12', geo:'service.financial.bank' },
  { key:'supermarket', minZoom:15, icon:'🏪', color:'#27AE60', geo:'commercial.supermarket' },
  { key:'atm',         minZoom:16, icon:'💳', color:'#16A085', geo:'service.financial.atm' },
  { key:'bakery',      minZoom:16, icon:'🥖', color:'#D4A574', geo:'commercial.food_and_drink' },
  { key:'parking',     minZoom:16, icon:'🅿️', color:'#3498DB', geo:'parking' },
];
const GEO_LOOKUP = new Map(AMBIENT_CATS.map(c => [c.geo, c]));

function detectCat(feat) {
  const cats = [...(feat.properties?.categories || [])].sort((a, b) => b.length - a.length);
  for (const c of cats) { if (GEO_LOOKUP.has(c)) return GEO_LOOKUP.get(c); }
  return null;
}

// ── Marker DOM element helpers ────────────────────────────────────────────────
function makeDot(emoji, color, size = 28) {
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};
    border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;
    font-size:${Math.round(size*0.5)}px;line-height:1;cursor:pointer;user-select:none;`;
  el.textContent = emoji;
  return el;
}

function makeSpotDom(type) {
  const cfg = { parking:{c:'#3B82F6',i:'🅿️'}, food:{c:'#22C55E',i:'🍽️'}, toilet:{c:'#F97316',i:'🚽'} };
  const { c, i } = cfg[type] || cfg.parking;
  const el = document.createElement('div');
  el.style.cssText = 'width:36px;height:36px;cursor:pointer;';
  el.innerHTML = `<div style="width:36px;height:36px;background:${c};border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
    box-shadow:0 2px 6px rgba(0,0,0,0.35);border:2px solid white;">
    <span style="transform:rotate(45deg);font-size:16px;line-height:1">${i}</span></div>`;
  return el;
}

// ── In-memory POI cache ───────────────────────────────────────────────────────
const poiCache = new Map();
const POI_TTL  = 10 * 60 * 1000;

async function fetchAmbientPOIs(south, west, north, east, zoom, signal) {
  const visible = AMBIENT_CATS.filter(c => zoom >= c.minZoom);
  if (!visible.length || !GEOAPIFY_KEY) return [];
  const tiers = [{z:13,lim:30},{z:15,lim:60},{z:16,lim:100}];
  const feats = [];
  for (const tier of tiers) {
    if (zoom < tier.z) continue;
    const cats = visible.filter(c => c.minZoom === tier.z).map(c => c.geo).join(',');
    if (!cats) continue;
    const url = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(cats)}&filter=rect:${west},${south},${east},${north}&limit=${tier.lim}&apiKey=${GEOAPIFY_KEY}`;
    try {
      const res = await fetch(url, { signal });
      if (res.ok) { const d = await res.json(); feats.push(...(d.features || [])); }
    } catch(e) { if (e.name === 'AbortError') throw e; }
  }
  return feats;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MapLibreMap({
  center, flyTo, fitBoundsData, zoomToArea, setMapRef,
  addMode, onMapClick,
  spots, showSpots, onSelectSpot,
  userPos, userAccuracy,
  selectedPOICategory, onSelectPOI, onPOIsLoaded, onLoadingChange,
  navTarget, navRouteData,
  isDark, mapLayer,
}) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markers      = useRef({ spots: new Map(), ambient: new Map(), pois: new Map(), user: null });
  const routeAdded   = useRef(false);
  const poiAbort     = useRef(null);
  const poiTimer     = useRef(null);
  const [offlineActive, setOfflineActive] = useState(false);
  const [offlineCountry, setOfflineCountry] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensureProtocols();

    const map = new maplibregl.Map({
      container:          containerRef.current,
      style:              isDark ? darkStyle : lightStyle,
      center:             [center.lng, center.lat],
      zoom:               13,
      minZoom:            3,
      maxZoom:            22,
      attributionControl: false,
      pitchWithRotate:    false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('click', e => { if (addMode) onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }); });

    mapRef.current = map;
    setMapRef?.(map);

    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Offline vector tile switcher ─────────────────────────────────────────
  // When offline and the country has downloaded tiles, switch to offline-vt:// source
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    async function checkOffline() {
      if (isOnline) {
        if (offlineActive) {
          map.setStyle(isDark ? darkStyle : lightStyle);
          setOfflineActive(false);
          setOfflineCountry('');
        }
        return;
      }

      // Check if this location has downloaded vector tiles
      const c    = map.getCenter();
      const meta = await getAllMeta();
      let found  = null;
      for (const code of Object.keys(meta)) {
        const country = COUNTRIES.find(x => x.code === code);
        if (country && meta[code]?.type === 'vector' && isPointInCountry(c.lat, c.lng, country)) {
          found = country; break;
        }
      }

      if (found) {
        // Switch to offline-vt:// source — served from IndexedDB
        const offlineStyle = {
          ...(isDark ? darkStyle : lightStyle),
          sources: {
            v: {
              type:        'vector',
              // Custom TileJSON pointing at our IndexedDB protocol
              tiles:       ['offline-vt://{z}/{x}/{y}'],
              minzoom:     0,
              maxzoom:     14,
              attribution: '© OpenStreetMap contributors',
            },
          },
        };
        map.setStyle(offlineStyle);
        setOfflineActive(true);
        setOfflineCountry(found.name);
      }
    }

    checkOffline();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isDark]);

  // ── Dark mode ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || offlineActive) return;
    // Wait for any in-progress style load before switching
    if (!map.isStyleLoaded()) {
      map.once('idle', () => map.setStyle(isDark ? darkStyle : lightStyle));
    } else {
      map.setStyle(isDark ? darkStyle : lightStyle);
    }
  }, [isDark, offlineActive]);

  // ── Cursor ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    mapRef.current?.getCanvas() && (mapRef.current.getCanvas().style.cursor = addMode ? 'crosshair' : '');
  }, [addMode]);

  // ── flyTo ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!flyTo || !mapRef.current) return;
    mapRef.current.flyTo({ center: [flyTo[1], flyTo[0]], zoom: 15, duration: 1000 });
  }, [flyTo]);

  // ── fitBounds ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!fitBoundsData?.length || !mapRef.current) return;
    const lngs = fitBoundsData.map(c => c[1] ?? c.lng ?? c[0]);
    const lats  = fitBoundsData.map(c => c[0] ?? c.lat ?? c[1]);
    mapRef.current.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 60, duration: 1200 }
    );
  }, [fitBoundsData]);

  // ── zoomToArea ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!zoomToArea || !mapRef.current) return;
    if (zoomToArea.center) mapRef.current.flyTo({ center: [zoomToArea.center.lng, zoomToArea.center.lat], zoom: 9, duration: 1200 });
    else mapRef.current.setZoom(9);
  }, [zoomToArea]);

  // ── Spot markers ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const m = markers.current.spots;
    if (!showSpots) { m.forEach(x => x.remove()); m.clear(); return; }
    const ids = new Set(spots.map(s => s.id));
    m.forEach((x, id) => { if (!ids.has(id)) { x.remove(); m.delete(id); } });
    for (const spot of spots) {
      if (m.has(spot.id)) continue;
      const el = makeSpotDom(spot.spot_type);
      const mk = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([spot.lng, spot.lat]).addTo(map);
      el.addEventListener('click', e => { e.stopPropagation(); onSelectSpot?.(spot); });
      m.set(spot.id, mk);
    }
  }, [spots, showSpots]);

  // ── User location ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.user?.remove();
    ['user-acc-fill','user-acc-stroke'].forEach(id => { try { if(map.getLayer(id)) map.removeLayer(id); } catch(_){} });
    try { if (map.getSource('user-acc')) map.removeSource('user-acc'); } catch(_){}
    if (!userPos) return;

    if (userAccuracy && map.isStyleLoaded()) {
      try {
        map.addSource('user-acc', { type:'geojson', data:{ type:'FeatureCollection', features:[{ type:'Feature', geometry:{ type:'Point', coordinates:[userPos[1],userPos[0]] } }] } });
        map.addLayer({ id:'user-acc-fill',   type:'circle', source:'user-acc', paint:{ 'circle-radius':{ stops:[[0,0],[20,userAccuracy/0.075]], base:2 }, 'circle-color':'#3B82F6','circle-opacity':0.08,'circle-pitch-alignment':'map' } });
        map.addLayer({ id:'user-acc-stroke', type:'circle', source:'user-acc', paint:{ 'circle-radius':{ stops:[[0,0],[20,userAccuracy/0.075]], base:2 }, 'circle-color':'transparent','circle-stroke-color':'#3B82F6','circle-stroke-width':1,'circle-pitch-alignment':'map' } });
      } catch(_){}
    }
    const el = document.createElement('div');
    el.style.cssText = 'width:22px;height:22px;';
    el.innerHTML = '<div style="width:22px;height:22px;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.25);"><div style="width:12px;height:12px;background:#3B82F6;border-radius:50%;"></div></div>';
    markers.current.user = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([userPos[1], userPos[0]]).addTo(map);
  }, [userPos, userAccuracy]);

  // ── Ambient POIs ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const m = markers.current.ambient;
    const clear = () => { m.forEach(x => x.remove()); m.clear(); };

    if (selectedPOICategory) { clear(); return; }

    const load = async () => {
      const zoom = map.getZoom();
      if (zoom < 13) { clear(); return; }
      const b = map.getBounds();
      const s = b.getSouth(), n = b.getNorth(), w = b.getWest(), e = b.getEast();
      const cLat = (s+n)/2, cLon = (w+e)/2;
      const key  = `${s.toFixed(2)}_${w.toFixed(2)}_${zoom.toFixed(0)}`;

      poiAbort.current?.abort();
      poiAbort.current = new AbortController();

      let pois = [];

      // Try offline POIs first
      const metaMap = await getAllMeta();
      const country = COUNTRIES.find(c => {
        const [cw,cs,ce,cn] = c.bbox;
        return cLat>=cs&&cLat<=cn&&cLon>=cw&&cLon<=ce && metaMap[c.code]?.hasPOIs;
      });
      if (country) {
        const offline = await getPOIs(country.code);
        if (offline?.length) {
          pois = offline.filter(p => p.lat>=s&&p.lat<=n&&p.lon>=w&&p.lon<=e)
            .map(p => {
              const cat = detectCat({ properties: { categories: p.categories||[], name: p.name } });
              if (!cat || zoom < cat.minZoom) return null;
              return { ...p, _cat: cat };
            }).filter(Boolean);
        }
      }

      // Online Geoapify fallback
      if (!pois.length && navigator.onLine) {
        const cached = poiCache.get(key);
        if (cached && Date.now() - cached.ts < POI_TTL) {
          pois = cached.data;
        } else {
          try {
            const feats = await fetchAmbientPOIs(s, w, n, e, zoom, poiAbort.current.signal);
            pois = feats.map(feat => {
              const [lon, lat] = feat.geometry?.coordinates || [];
              if (!lat || !lon) return null;
              const cat = detectCat(feat);
              if (!cat) return null;
              const p = feat.properties || {};
              return { id: p.place_id||`${lat}-${lon}`, lat, lon, name:p.name||'', address:p.address_line2||'', tags:{ phone:p.contact?.phone, website:p.website }, _cat:cat };
            }).filter(Boolean);
            poiCache.set(key, { data: pois, ts: Date.now() });
          } catch(e) { if (e.name === 'AbortError') return; }
        }
      }

      clear();
      for (const poi of pois) {
        const size = zoom>=16 ? 32 : zoom>=14 ? 28 : 24;
        const el   = makeDot(poi._cat.icon, poi._cat.color, size);
        const mk   = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([poi.lon, poi.lat]).addTo(map);
        el.addEventListener('click', e => { e.stopPropagation(); onSelectPOI?.(poi, poi._cat); });
        m.set(poi.id, mk);
      }
    };

    clearTimeout(poiTimer.current);
    poiTimer.current = setTimeout(load, 800);
    const onMove = () => { clearTimeout(poiTimer.current); poiTimer.current = setTimeout(load, 1200); };
    map.on('moveend', onMove); map.on('zoomend', onMove);
    return () => { map.off('moveend', onMove); map.off('zoomend', onMove); clearTimeout(poiTimer.current); poiAbort.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPOICategory]);

  // ── Category POIs ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const m = markers.current.pois;
    const clear = () => { m.forEach(x => x.remove()); m.clear(); };
    if (!selectedPOICategory) { clear(); onPOIsLoaded?.([]); return; }

    const load = async () => {
      const zoom = map.getZoom();
      const b = map.getBounds();
      const s=b.getSouth(),n=b.getNorth(),w=b.getWest(),e=b.getEast();
      const limit = zoom>=16 ? 200 : zoom>=14 ? 100 : 50;
      onLoadingChange?.(true);
      try {
        if (!GEOAPIFY_KEY) { onLoadingChange?.(false); return; }
        const cat = selectedPOICategory.geoapifyCategory || 'leisure';
        const res = await fetch(`https://api.geoapify.com/v2/places?categories=${encodeURIComponent(cat)}&filter=rect:${w},${s},${e},${n}&limit=${limit}&apiKey=${GEOAPIFY_KEY}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        clear();
        const pois = [];
        for (const feat of data.features || []) {
          const [lon, lat] = feat.geometry?.coordinates || [];
          if (!lat || !lon) continue;
          const p = feat.properties || {};
          const poi = { id: p.place_id||`${lat}-${lon}`, lat, lon, name:p.name||selectedPOICategory.name, address:p.address_line2||'', tags:{} };
          pois.push(poi);
          const size = zoom>=16 ? 36 : zoom>=14 ? 30 : 26;
          const el = makeDot(selectedPOICategory.icon, selectedPOICategory.color, size);
          const mk = new maplibregl.Marker({ element:el, anchor:'bottom' }).setLngLat([lon,lat]).addTo(map);
          el.addEventListener('click', e => { e.stopPropagation(); onSelectPOI?.(poi); });
          m.set(poi.id, mk);
        }
        onPOIsLoaded?.(pois);
      } catch(e) { console.warn('Category POI error:', e.message); }
      onLoadingChange?.(false);
    };

    clearTimeout(poiTimer.current);
    poiTimer.current = setTimeout(load, 300);
    const onMove = () => { clearTimeout(poiTimer.current); poiTimer.current = setTimeout(load, 500); };
    map.on('moveend', onMove); map.on('zoomend', onMove);
    return () => { map.off('moveend', onMove); map.off('zoomend', onMove); };
  }, [selectedPOICategory]);

  // ── Route overlay ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const removeRoute = () => {
      if (!routeAdded.current) return;
      ['route-outline','route-line'].forEach(id => { try { if(map.getLayer(id)) map.removeLayer(id); } catch(_){} });
      try { if(map.getSource('route')) map.removeSource('route'); } catch(_){}
      routeAdded.current = false;
    };

    if (!navTarget || !navRouteData?.coordinates?.length) { removeRoute(); return; }

    const coords = navRouteData.coordinates.map(c => [c[1]??c.lng, c[0]??c.lat]);
    const addRoute = () => {
      removeRoute();
      try {
        map.addSource('route', { type:'geojson', data:{ type:'Feature', geometry:{ type:'LineString', coordinates:coords } } });
        map.addLayer({ id:'route-outline', type:'line', source:'route', layout:{ 'line-join':'round','line-cap':'round' }, paint:{ 'line-color':'#1d4ed8','line-width':8,'line-opacity':0.5 } });
        map.addLayer({ id:'route-line',    type:'line', source:'route', layout:{ 'line-join':'round','line-cap':'round' }, paint:{ 'line-color':'#3b82f6','line-width':5,'line-opacity':0.9 } });
        routeAdded.current = true;
      } catch(_){}
    };
    if (map.isStyleLoaded()) addRoute(); else map.once('styledata', addRoute);
  }, [navTarget, navRouteData]);

  // ── Traffic overlay (TomTom raster on top) ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !TOMTOM_KEY) return;

    const remove = () => {
      try { if(map.getLayer('traffic')) map.removeLayer('traffic'); } catch(_){}
      try { if(map.getSource('traffic')) map.removeSource('traffic'); } catch(_){}
    };

    if (mapLayer !== 'traffic') { remove(); return; }

    const add = () => {
      remove();
      try {
        map.addSource('traffic', {
          type: 'raster',
          tiles: [`https://a.api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`],
          tileSize: 256,
        });
        map.addLayer({ id:'traffic', type:'raster', source:'traffic', paint:{ 'raster-opacity':0.65 } });
      } catch(_){}
    };

    // Add once when style is ready — don't listen to styledata (causes infinite loop)
    if (map.isStyleLoaded()) {
      add();
    } else {
      map.once('idle', add);
    }
  }, [mapLayer, isDark]);

  // ── Aerial layer (Mapy.cz satellite) ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const remove = () => { try { if(map.getLayer('aerial')) map.removeLayer('aerial'); if(map.getSource('aerial')) map.removeSource('aerial'); } catch(_){} };
    if (mapLayer !== 'aerial') { remove(); return; }
    const add = () => {
      remove();
      try {
        map.addSource('aerial', { type:'raster', tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize:256, maxzoom:19, attribution:'© Esri © OpenStreetMap' });
        // Insert BEFORE road labels so labels still show
        const firstSymbol = map.getStyle().layers.find(l => l.type === 'symbol')?.id;
        map.addLayer({ id:'aerial', type:'raster', source:'aerial', paint:{ 'raster-opacity':1 } }, firstSymbol);
      } catch(_){}
    };
    if (map.isStyleLoaded()) add(); else map.once('styledata', add);
  }, [mapLayer]);

  return (
    <div style={{ width:'100%', height:'100%', position:'relative' }}>
      <div ref={containerRef} style={{ width:'100%', height:'100%' }} />
      {!isOnline && (
        <div style={{ position:'absolute', top:8, right:8, zIndex:10, pointerEvents:'none' }}>
          <span style={{ fontSize:11, padding:'3px 8px', borderRadius:12, background:'#2563eb',
            color:'#fff', fontWeight:600, boxShadow:'0 2px 8px rgba(0,0,0,0.3)', opacity:0.9 }}>
            📴 {offlineActive ? `Offline · ${offlineCountry}` : 'Offline'}
          </span>
        </div>
      )}
    </div>
  );
}