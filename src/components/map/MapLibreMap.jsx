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

// ── Road shield generator ─────────────────────────────────────────────────────
// Draws a real road sign on an offscreen canvas and returns ImageData.
// Called lazily via map.on('styleimagemissing', ...) — only generates each
// unique ref once, then caches it.

const SHIELD_COLORS = {
  motorway:  { bg: '#cc1111' },  // D roads (D1, D5, D7) — red
  trunk:     { bg: '#3a81fc' },  // MO, R roads, numbered — bright blue (same as highways)
  primary:   { bg: '#3a81fc' },  // 27, 9, 5 — same bright blue
  secondary: { bg: '#3a81fc' },  // 605, 431 — same bright blue
  // local: 5-digit roads like 18005 — light brown
  local:     { bg: '#b89060' },
};

// Detect if a ref is a local road (5+ digits = district/local road)
function getShieldClass(roadClass, ref) {
  // 4+ digit pure numbers (2341, 18512, 00515) = local district roads → brown
  if (ref && ref.length >= 4 && /^\d+$/.test(ref)) return 'local';
  return roadClass;
}

function drawRoadShield(ref, roadClass) {
  const effectiveClass = getShieldClass(roadClass, ref);
  const colors = SHIELD_COLORS[effectiveClass] || SHIELD_COLORS.primary;
  const FONT_SIZE = 9;
  const PADDING_X = 4;
  const PADDING_Y = 2;
  const BORDER    = 1.5;  // outer border width
  const INNER_GAP = 1.5;  // gap between outer border and inner white line
  const RADIUS    = 3;
  const SCALE     = 1;    // no retina scaling — keeps size reasonable

  // Measure text
  const canvas0 = document.createElement('canvas');
  const ctx0    = canvas0.getContext('2d');
  ctx0.font     = `bold ${FONT_SIZE}px Arial, sans-serif`;
  const tw      = ctx0.measureText(ref).width;

  const W = Math.ceil(tw + PADDING_X * 2 + (BORDER + INNER_GAP) * 2);
  const H = FONT_SIZE + PADDING_Y * 2 + (BORDER + INNER_GAP) * 2;

  const canvas = document.createElement('canvas');
  canvas.width  = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // 1. Outer colored border
  ctx.fillStyle = colors.bg;
  roundRect(0, 0, W, H, RADIUS);
  ctx.fill();

  // 2. White inner border line
  ctx.fillStyle = '#ffffff';
  roundRect(BORDER, BORDER, W - BORDER * 2, H - BORDER * 2, RADIUS - 1);
  ctx.fill();

  // 3. Colored fill inside white border
  ctx.fillStyle = colors.bg;
  roundRect(BORDER + INNER_GAP, BORDER + INNER_GAP,
    W - (BORDER + INNER_GAP) * 2, H - (BORDER + INNER_GAP) * 2, RADIUS - 2);
  ctx.fill();

  // 4. White bold text centered
  ctx.fillStyle   = '#ffffff';
  ctx.font        = `bold ${FONT_SIZE}px Arial, sans-serif`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ref, W / 2, H / 2);

  return { data: ctx.getImageData(0, 0, W * SCALE, H * SCALE).data, width: W * SCALE, height: H * SCALE };
}

function addShieldImage(map, imageId) {
  try {
    // Parse "shield-{class}-{shield_text}" e.g. "shield-motorway-D1", "shield-trunk-MO"
    const withoutPrefix = imageId.slice('shield-'.length);
    const classEnd = withoutPrefix.indexOf('-');
    if (classEnd < 0) return;
    const roadClass  = withoutPrefix.slice(0, classEnd);
    const shieldText = withoutPrefix.slice(classEnd + 1);
    if (!shieldText || shieldText === 'undefined') return;

    const { data, width, height } = drawRoadShield(shieldText, roadClass);
    map.addImage(imageId, { width, height, data });
  } catch (e) {
    // Silently skip
  }
}


const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '';

// ── E-route shield markers ────────────────────────────────────────────────────
// Data inlined — no fetch needed, works offline, no 404 risk

const EROUTES_DATA = [{"r":"E441","lat":50.5852,"lng":12.329},{"r":"E43","lat":47.9968,"lng":9.6508},{"r":"E70","lat":45.7977,"lng":4.6039},{"r":"E37","lat":52.0,"lng":7.7941},{"r":"E36","lat":51.8214,"lng":14.6046},{"r":"E49","lat":50.1779,"lng":13.9871},{"r":"E41","lat":49.2356,"lng":8.5915},{"r":"E77","lat":56.2316,"lng":24.1558},{"r":"E262","lat":56.1323,"lng":26.1715},{"r":"E28","lat":53.6637,"lng":20.4746},{"r":"E81","lat":46.2917,"lng":25.5837},{"r":"E68","lat":45.9843,"lng":22.8177},{"r":"E574","lat":45.4346,"lng":25.3557},{"r":"E576","lat":46.9621,"lng":23.7528},{"r":"E58","lat":47.5708,"lng":30.2509},{"r":"E671","lat":46.7722,"lng":22.0306},{"r":"E66","lat":46.9166,"lng":15.7269},{"r":"E578","lat":46.4223,"lng":25.1722},{"r":"E71","lat":46.1257,"lng":18.1858},{"r":"E73","lat":45.2583,"lng":18.2268},{"r":"E653","lat":46.5265,"lng":16.2161},{"r":"E661","lat":45.3995,"lng":17.5406},{"r":"E575","lat":47.894,"lng":17.4561},{"r":"E26","lat":53.0513,"lng":11.739},{"r":"E462","lat":49.6832,"lng":17.8861},{"r":"E234","lat":53.3104,"lng":9.1232},{"r":"E251","lat":53.6142,"lng":13.3568},{"r":"E331","lat":51.3051,"lng":8.7986},{"r":"E712","lat":44.7523,"lng":5.84},{"r":"E48","lat":50.0788,"lng":12.1868},{"r":"E21","lat":47.6275,"lng":5.5252},{"r":"E23","lat":47.8569,"lng":6.2908},{"r":"E532","lat":47.648,"lng":10.6082},{"r":"E27","lat":46.6622,"lng":7.1781},{"r":"E47","lat":54.9485,"lng":11.6463},{"r":"E51","lat":50.9733,"lng":12.2532},{"r":"E261","lat":52.2606,"lng":17.5612},{"r":"E533","lat":47.681,"lng":11.309},{"r":"E422","lat":49.5347,"lng":6.8888},{"r":"E451","lat":50.0799,"lng":8.6882},{"r":"E64","lat":45.3741,"lng":8.8959},{"r":"E612","lat":45.2798,"lng":7.7755},{"r":"E53","lat":48.9898,"lng":12.4534},{"r":"E77","lat":52.9278,"lng":19.7345},{"r":"E30","lat":53.3816,"lng":27.3226},{"r":"E59","lat":47.6209,"lng":15.9269},{"r":"E371","lat":50.2394,"lng":21.53},{"r":"E272","lat":55.3401,"lng":23.1543},{"r":"E60","lat":47.3111,"lng":10.6429},{"r":"E60","lat":47.7815,"lng":13.0711},{"r":"E461","lat":48.9898,"lng":16.5655},{"r":"E551","lat":49.2609,"lng":14.9299},{"r":"E442","lat":50.015,"lng":15.807},{"r":"E611","lat":45.9282,"lng":5.1109},{"r":"E713","lat":45.1034,"lng":5.2924},{"r":"E67","lat":53.2537,"lng":21.9994},{"r":"E61","lat":45.9752,"lng":14.1338},{"r":"E30","lat":52.0621,"lng":4.147},{"r":"E30","lat":52.2804,"lng":7.6505},{"r":"E751","lat":45.2146,"lng":13.9735},{"r":"E30","lat":52.2641,"lng":16.5999},{"r":"E75","lat":48.7541,"lng":17.9713},{"r":"E75","lat":44.2065,"lng":20.9094},{"r":"E75","lat":52.0837,"lng":19.1224},{"r":"E75","lat":53.5121,"lng":18.7824},{"r":"E75","lat":47.0944,"lng":18.6044},{"r":"E75","lat":49.6293,"lng":18.6485},{"r":"E77","lat":48.7326,"lng":19.2638},{"r":"E571","lat":48.4583,"lng":19.2473},{"r":"E572","lat":48.7186,"lng":18.397},{"r":"E35","lat":52.1619,"lng":5.5185},{"r":"E35","lat":47.3429,"lng":7.9223},{"r":"E35","lat":46.2682,"lng":8.8006},{"r":"E35","lat":46.8986,"lng":8.4575},{"r":"E35","lat":50.7774,"lng":7.3583},{"r":"E35","lat":51.4741,"lng":6.5829},{"r":"E35","lat":48.0671,"lng":7.7347},{"r":"E35","lat":49.7218,"lng":8.5559},{"r":"E35","lat":50.2674,"lng":8.0907},{"r":"E35","lat":48.9814,"lng":8.2939},{"r":"E35","lat":45.1617,"lng":10.1361},{"r":"E52","lat":47.8001,"lng":12.5767},{"r":"E52","lat":48.7831,"lng":9.0196},{"r":"E52","lat":48.11,"lng":11.5078},{"r":"E52","lat":48.753,"lng":8.1275},{"r":"E52","lat":48.5167,"lng":10.1907},{"r":"E60","lat":47.5216,"lng":19.4513},{"r":"E662","lat":45.812,"lng":19.1446},{"r":"E70","lat":45.0304,"lng":20.2016},{"r":"E70","lat":44.958,"lng":22.7431},{"r":"E70","lat":45.4445,"lng":17.3996},{"r":"E70","lat":45.6584,"lng":12.8906},{"r":"E70","lat":45.2761,"lng":10.533},{"r":"E70","lat":45.8647,"lng":14.7657},{"r":"E70","lat":45.6668,"lng":4.4908},{"r":"E70","lat":45.3729,"lng":6.0795},{"r":"E60","lat":47.5739,"lng":4.7015},{"r":"E60","lat":47.4909,"lng":8.6093},{"r":"E60","lat":45.5972,"lng":25.2195},{"r":"E60","lat":48.0681,"lng":15.7898},{"r":"E50","lat":49.3994,"lng":9.7399},{"r":"E50","lat":48.941,"lng":20.0809},{"r":"E50","lat":49.5015,"lng":15.2093},{"r":"E50","lat":48.6253,"lng":1.2553},{"r":"E65","lat":44.4503,"lng":16.4513},{"r":"E65","lat":54.7298,"lng":13.6806},{"r":"E65","lat":47.2124,"lng":16.9466},{"r":"E65","lat":49.7462,"lng":15.7321},{"r":"E65","lat":48.3495,"lng":17.0814},{"r":"E65","lat":52.3606,"lng":15.2446},{"r":"E58","lat":48.1094,"lng":16.7406},{"r":"E58","lat":48.418,"lng":19.669},{"r":"E79","lat":45.554,"lng":22.7967},{"r":"E79","lat":47.5897,"lng":21.3098},{"r":"E25","lat":51.4179,"lng":5.0123},{"r":"E25","lat":49.1164,"lng":6.8539},{"r":"E25","lat":45.6854,"lng":7.3779},{"r":"E25","lat":47.2606,"lng":7.6047},{"r":"E22","lat":52.7774,"lng":6.0332},{"r":"E22","lat":53.757,"lng":10.4078},{"r":"E55","lat":52.4678,"lng":13.0265},{"r":"E55","lat":55.098,"lng":12.2712},{"r":"E55","lat":49.7138,"lng":14.3187},{"r":"E55","lat":47.5894,"lng":13.7495},{"r":"E55","lat":43.5746,"lng":15.0485},{"r":"E40","lat":51.0162,"lng":13.6824},{"r":"E40","lat":50.9137,"lng":4.3415},{"r":"E40","lat":49.4523,"lng":31.5126},{"r":"E40","lat":50.6194,"lng":19.0618},{"r":"E45","lat":52.0939,"lng":9.8303},{"r":"E45","lat":56.2539,"lng":10.6346},{"r":"E45","lat":47.3041,"lng":11.792},{"r":"E25","lat":48.1738,"lng":7.5499},{"r":"E25","lat":49.5557,"lng":6.0181},{"r":"E25","lat":50.1965,"lng":5.6998},{"r":"E25","lat":45.0782,"lng":8.249},{"r":"E25","lat":46.6823,"lng":6.7938},{"r":"E25","lat":46.1237,"lng":6.4984},{"r":"E30","lat":52.2167,"lng":11.6116},{"r":"E30","lat":52.3498,"lng":10.1797},{"r":"E30","lat":52.2515,"lng":8.8254},{"r":"E30","lat":52.299,"lng":13.4173},{"r":"E30","lat":52.0445,"lng":19.8602},{"r":"E30","lat":52.1122,"lng":22.3358},{"r":"E372","lat":51.0483,"lng":22.6939},{"r":"E373","lat":50.8871,"lng":26.612},{"r":"E57","lat":46.3535,"lng":15.129},{"r":"E57","lat":47.3769,"lng":14.843},{"r":"E62","lat":46.2218,"lng":7.5868},{"r":"E62","lat":46.3786,"lng":6.798},{"r":"E62","lat":46.3572,"lng":6.3247},{"r":"E62","lat":46.2273,"lng":5.3635},{"r":"E62","lat":44.9702,"lng":8.9862},{"r":"E62","lat":45.8688,"lng":8.6069},{"r":"E67","lat":50.2642,"lng":15.3977},{"r":"E512","lat":47.8891,"lng":6.9289},{"r":"E711","lat":45.4446,"lng":5.3035},{"r":"E40","lat":50.9289,"lng":11.2268},{"r":"E40","lat":50.8543,"lng":7.1241},{"r":"E40","lat":50.7853,"lng":9.1126},{"r":"E573","lat":47.9507,"lng":21.7008},{"r":"E579","lat":47.9791,"lng":21.9073},{"r":"E471","lat":49.11,"lng":23.3506},{"r":"E54","lat":47.8421,"lng":9.595},{"r":"E54","lat":48.2061,"lng":4.9589},{"r":"E531","lat":48.2311,"lng":8.2523},{"r":"E45","lat":49.2092,"lng":10.8686},{"r":"E45","lat":54.0903,"lng":9.6718},{"r":"E67","lat":51.2962,"lng":18.5558},{"r":"E77","lat":50.4714,"lng":20.3719},{"r":"E56","lat":48.7606,"lng":12.6413},{"r":"E651","lat":47.4766,"lng":13.8469},{"r":"E652","lat":46.472,"lng":14.2684},{"r":"E673","lat":45.8044,"lng":22.2892},{"r":"E552","lat":48.2366,"lng":12.9935},{"r":"E641","lat":47.6249,"lng":12.4971},{"r":"E45","lat":45.8376,"lng":11.2142},{"r":"E50","lat":48.6977,"lng":31.0108},{"r":"E77","lat":47.7811,"lng":19.1356},{"r":"E31","lat":50.5029,"lng":7.2947},{"r":"E31","lat":51.7926,"lng":5.3185},{"r":"E34","lat":51.7934,"lng":7.5318},{"r":"E34","lat":51.3714,"lng":5.7127},{"r":"E34","lat":51.2635,"lng":4.2475},{"r":"E233","lat":52.7212,"lng":6.7545},{"r":"E233","lat":52.8416,"lng":7.8872},{"r":"E314","lat":50.9345,"lng":5.1977},{"r":"E314","lat":50.8108,"lng":6.1021},{"r":"E314","lat":50.8931,"lng":5.8897},{"r":"E85","lat":55.0028,"lng":23.2918},{"r":"E85","lat":53.0497,"lng":24.8469},{"r":"E85","lat":49.9073,"lng":25.187},{"r":"E67","lat":55.2916,"lng":23.7953},{"r":"E17","lat":48.9015,"lng":4.0641},{"r":"E42","lat":50.045,"lng":7.6011},{"r":"E42","lat":50.4631,"lng":4.728},{"r":"E46","lat":50.1865,"lng":5.3083},{"r":"E46","lat":49.4647,"lng":1.7326},{"r":"E411","lat":50.1827,"lng":5.1157},{"r":"E411","lat":49.4183,"lng":5.9612},{"r":"E44","lat":49.5526,"lng":5.8244},{"r":"E44","lat":49.6424,"lng":6.1695},{"r":"E44","lat":50.1695,"lng":7.5771},{"r":"E44","lat":49.6496,"lng":3.0112},{"r":"E421","lat":50.4392,"lng":6.0762},{"r":"E421","lat":49.9027,"lng":6.119},{"r":"E29","lat":49.0946,"lng":7.0316},{"r":"E29","lat":49.3195,"lng":6.7032},{"r":"E29","lat":50.2942,"lng":6.6053},{"r":"E29","lat":49.645,"lng":6.2756},{"r":"E312","lat":51.5002,"lng":4.5026},{"r":"E311","lat":51.8107,"lng":4.9833},{"r":"E232","lat":52.6867,"lng":6.0179},{"r":"E231","lat":52.2604,"lng":5.1992},{"r":"E313","lat":50.9412,"lng":5.0155}];

function loadERoutes() {
  return Promise.resolve(EROUTES_DATA);
}

function drawERouteShield(ref) {
  const FONT_SIZE = 10;
  const PADDING_X = 6;
  const PADDING_Y = 3;
  const BORDER    = 2;
  const INNER_GAP = 2;
  const RADIUS    = 4;
  const SCALE     = 2;

  const canvas0 = document.createElement('canvas');
  const ctx0    = canvas0.getContext('2d');
  ctx0.font     = `bold ${FONT_SIZE}px Arial, sans-serif`;
  const tw      = ctx0.measureText(ref).width;

  const W = Math.ceil(tw + PADDING_X * 2 + (BORDER + INNER_GAP) * 2);
  const H = FONT_SIZE + PADDING_Y * 2 + (BORDER + INNER_GAP) * 2;

  const canvas = document.createElement('canvas');
  canvas.width  = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
    ctx.arcTo(x+w, y, x+w, y+r, r); ctx.lineTo(x+w, y+h-r);
    ctx.arcTo(x+w, y+h, x+w-r, y+h, r); ctx.lineTo(x+r, y+h);
    ctx.arcTo(x, y+h, x, y+h-r, r); ctx.lineTo(x, y+r);
    ctx.arcTo(x, y, x+r, y, r); ctx.closePath();
  }

  ctx.fillStyle = '#2e7d32'; rr(0,0,W,H,RADIUS); ctx.fill();
  ctx.fillStyle = '#fff'; rr(BORDER,BORDER,W-BORDER*2,H-BORDER*2,RADIUS-1); ctx.fill();
  ctx.fillStyle = '#2e7d32'; rr(BORDER+INNER_GAP,BORDER+INNER_GAP,W-(BORDER+INNER_GAP)*2,H-(BORDER+INNER_GAP)*2,RADIUS-2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `bold ${FONT_SIZE}px Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ref, W/2, H/2);

  // Return as HTMLElement for use as a MapLibre marker
  const img = document.createElement('img');
  img.src    = canvas.toDataURL();
  img.width  = W;
  img.height = H;
  img.style.cssText = 'display:block;pointer-events:none;';
  return img;
}
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


function registerShieldListener(map) {
  map.on('styleimagemissing', (e) => {
    if (e.id && e.id.startsWith('shield-')) {
      addShieldImage(map, e.id);
    }
  });
}

function reRegisterShieldListener(map) {
  // styleimagemissing survives setStyle in MapLibre — no need to re-add
  // BUT we need to clear the image cache so shields get redrawn after style reload
  // (setStyle wipes all images including our shields)
  map.on('style.load', () => {
    // Shields are gone after style reload — they'll be re-requested via styleimagemissing
    // No action needed, the listener persists
  });
}

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
  const eRouteMarkersRef = useRef([]);
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

    // Register shield image listener — generates signs on demand via styleimagemissing
    registerShieldListener(map);
    // Also call once after style loads to handle any already-queued requests
    map.once('load', () => {
      // Force re-request of any shields that may have been missed
      map.triggerRepaint();
    });

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

  // ── E-route shields ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function clearERoutes() {
      eRouteMarkersRef.current.forEach(m => m.remove());
      eRouteMarkersRef.current = [];
    }

    function renderERoutes() {
      clearERoutes();
      if (!isOnline) return;
      const zoom = map.getZoom();
      if (zoom < 7) return; // don't show at very low zoom
      const bounds = map.getBounds();
      const pad = 3;

      loadERoutes().then(routes => {
        if (!mapRef.current) return;
        routes.forEach(({ r, lat, lng }) => {
          const el     = drawERouteShield(r);
          const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lng, lat])
            .addTo(map);
          eRouteMarkersRef.current.push(marker);
        });
      });
    }

    // Fire once map is fully ready
    map.once('idle', renderERoutes);
    map.on('moveend', renderERoutes);
    map.on('zoomend', renderERoutes);
    return () => {
      map.off('moveend', renderERoutes);
      map.off('zoomend', renderERoutes);
      clearERoutes();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // ── Dark mode ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || offlineActive) return;
    const doSwitch = () => {
      map.setStyle(isDark ? darkStyle : lightStyle);
      // After style loads, trigger repaint so shields get re-requested via styleimagemissing
      map.once('style.load', () => map.triggerRepaint());
    };
    if (!map.isStyleLoaded()) map.once('idle', doSwitch);
    else doSwitch();
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