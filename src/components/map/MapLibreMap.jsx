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
  motorway:  { bg: '#cc1111' },
  trunk:     { bg: '#3a81fc' },
  primary:   { bg: '#3a81fc' },
  secondary: { bg: '#3a81fc' },
  local:     { bg: '#b89060' },
  euro:      { bg: '#2e7d32' },  // E50, E55 — green
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

const EROUTES_GEOJSON = {"type":"FeatureCollection","features":[{"type":"Feature","properties":{"ref":"E17"},"geometry":{"type":"Point","coordinates":[4.884,47.038]}},{"type":"Feature","properties":{"ref":"E17"},"geometry":{"type":"Point","coordinates":[5.055,47.248]}},{"type":"Feature","properties":{"ref":"E17"},"geometry":{"type":"Point","coordinates":[5.104,48.01]}},{"type":"Feature","properties":{"ref":"E17"},"geometry":{"type":"Point","coordinates":[4.846,48.089]}},{"type":"Feature","properties":{"ref":"E17"},"geometry":{"type":"Point","coordinates":[4.19,49.163]}},{"type":"Feature","properties":{"ref":"E17"},"geometry":{"type":"Point","coordinates":[3.976,49.33]}},{"type":"Feature","properties":{"ref":"E17"},"geometry":{"type":"Point","coordinates":[3.176,50.006]}},{"type":"Feature","properties":{"ref":"E21"},"geometry":{"type":"Point","coordinates":[6.228,46.182]}},{"type":"Feature","properties":{"ref":"E21"},"geometry":{"type":"Point","coordinates":[5.971,46.099]}},{"type":"Feature","properties":{"ref":"E21"},"geometry":{"type":"Point","coordinates":[4.955,46.283]}},{"type":"Feature","properties":{"ref":"E21"},"geometry":{"type":"Point","coordinates":[4.915,47.064]}},{"type":"Feature","properties":{"ref":"E21"},"geometry":{"type":"Point","coordinates":[5.111,47.25]}},{"type":"Feature","properties":{"ref":"E21"},"geometry":{"type":"Point","coordinates":[5.644,48.1]}},{"type":"Feature","properties":{"ref":"E21"},"geometry":{"type":"Point","coordinates":[6.12,48.698]}},{"type":"Feature","properties":{"ref":"E22"},"geometry":{"type":"Point","coordinates":[7.227,53.181]}},{"type":"Feature","properties":{"ref":"E22"},"geometry":{"type":"Point","coordinates":[6.957,53.189]}},{"type":"Feature","properties":{"ref":"E22"},"geometry":{"type":"Point","coordinates":[5.924,52.978]}},{"type":"Feature","properties":{"ref":"E22"},"geometry":{"type":"Point","coordinates":[5.657,53.022]}},{"type":"Feature","properties":{"ref":"E22"},"geometry":{"type":"Point","coordinates":[4.891,52.492]}},{"type":"Feature","properties":{"ref":"E22"},"geometry":{"type":"Point","coordinates":[13.588,54.484]}},{"type":"Feature","properties":{"ref":"E22"},"geometry":{"type":"Point","coordinates":[8.024,53.24]}},{"type":"Feature","properties":{"ref":"E22"},"geometry":{"type":"Point","coordinates":[9.068,53.056]}},{"type":"Feature","properties":{"ref":"E22"},"geometry":{"type":"Point","coordinates":[10.045,53.509]}},{"type":"Feature","properties":{"ref":"E22"},"geometry":{"type":"Point","coordinates":[11.022,53.831]}},{"type":"Feature","properties":{"ref":"E22"},"geometry":{"type":"Point","coordinates":[12.09,54.02]}},{"type":"Feature","properties":{"ref":"E23"},"geometry":{"type":"Point","coordinates":[6.266,47.687]}},{"type":"Feature","properties":{"ref":"E23"},"geometry":{"type":"Point","coordinates":[6.603,46.517]}},{"type":"Feature","properties":{"ref":"E23"},"geometry":{"type":"Point","coordinates":[6.175,49.197]}},{"type":"Feature","properties":{"ref":"E23"},"geometry":{"type":"Point","coordinates":[6.112,48.934]}},{"type":"Feature","properties":{"ref":"E231"},"geometry":{"type":"Point","coordinates":[5.444,52.168]}},{"type":"Feature","properties":{"ref":"E232"},"geometry":{"type":"Point","coordinates":[6.571,53.205]}},{"type":"Feature","properties":{"ref":"E232"},"geometry":{"type":"Point","coordinates":[6.537,52.937]}},{"type":"Feature","properties":{"ref":"E232"},"geometry":{"type":"Point","coordinates":[5.934,52.429]}},{"type":"Feature","properties":{"ref":"E233"},"geometry":{"type":"Point","coordinates":[7.064,52.722]}},{"type":"Feature","properties":{"ref":"E233"},"geometry":{"type":"Point","coordinates":[6.791,52.727]}},{"type":"Feature","properties":{"ref":"E233"},"geometry":{"type":"Point","coordinates":[8.71,53.006]}},{"type":"Feature","properties":{"ref":"E233"},"geometry":{"type":"Point","coordinates":[8.453,52.916]}},{"type":"Feature","properties":{"ref":"E234"},"geometry":{"type":"Point","coordinates":[8.733,53.84]}},{"type":"Feature","properties":{"ref":"E234"},"geometry":{"type":"Point","coordinates":[9.059,53.02]}},{"type":"Feature","properties":{"ref":"E234"},"geometry":{"type":"Point","coordinates":[9.314,52.928]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[5.697,50.755]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[5.795,51.007]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[5.044,52.071]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[4.764,52.067]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[4.521,51.949]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[7.602,48.77]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[6.884,49.079]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[7.834,45.524]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[6.952,45.818]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[7.561,47.577]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[5.908,49.638]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[8.663,44.633]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[8.485,45.145]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[6.215,46.401]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"Point","coordinates":[7.099,46.908]}},{"type":"Feature","properties":{"ref":"E251"},"geometry":{"type":"Point","coordinates":[13.202,52.705]}},{"type":"Feature","properties":{"ref":"E251"},"geometry":{"type":"Point","coordinates":[13.164,53.006]}},{"type":"Feature","properties":{"ref":"E251"},"geometry":{"type":"Point","coordinates":[13.275,54.031]}},{"type":"Feature","properties":{"ref":"E26"},"geometry":{"type":"Point","coordinates":[10.167,53.561]}},{"type":"Feature","properties":{"ref":"E26"},"geometry":{"type":"Point","coordinates":[11.26,53.488]}},{"type":"Feature","properties":{"ref":"E26"},"geometry":{"type":"Point","coordinates":[12.048,53.292]}},{"type":"Feature","properties":{"ref":"E26"},"geometry":{"type":"Point","coordinates":[12.752,52.889]}},{"type":"Feature","properties":{"ref":"E26"},"geometry":{"type":"Point","coordinates":[13.229,52.676]}},{"type":"Feature","properties":{"ref":"E261"},"geometry":{"type":"Point","coordinates":[16.972,51.049]}},{"type":"Feature","properties":{"ref":"E261"},"geometry":{"type":"Point","coordinates":[17.038,51.312]}},{"type":"Feature","properties":{"ref":"E261"},"geometry":{"type":"Point","coordinates":[16.7,52.183]}},{"type":"Feature","properties":{"ref":"E261"},"geometry":{"type":"Point","coordinates":[17.181,52.351]}},{"type":"Feature","properties":{"ref":"E261"},"geometry":{"type":"Point","coordinates":[17.883,53.12]}},{"type":"Feature","properties":{"ref":"E261"},"geometry":{"type":"Point","coordinates":[18.132,53.224]}},{"type":"Feature","properties":{"ref":"E262"},"geometry":{"type":"Point","coordinates":[26.464,55.956]}},{"type":"Feature","properties":{"ref":"E262"},"geometry":{"type":"Point","coordinates":[27.331,56.507]}},{"type":"Feature","properties":{"ref":"E262"},"geometry":{"type":"Point","coordinates":[28.371,57.337]}},{"type":"Feature","properties":{"ref":"E262"},"geometry":{"type":"Point","coordinates":[24.283,55.066]}},{"type":"Feature","properties":{"ref":"E262"},"geometry":{"type":"Point","coordinates":[25.834,55.593]}},{"type":"Feature","properties":{"ref":"E262"},"geometry":{"type":"Point","coordinates":[23.998,54.94]}},{"type":"Feature","properties":{"ref":"E262"},"geometry":{"type":"Point","coordinates":[26.898,56.172]}},{"type":"Feature","properties":{"ref":"E27"},"geometry":{"type":"Point","coordinates":[7.137,46.078]}},{"type":"Feature","properties":{"ref":"E27"},"geometry":{"type":"Point","coordinates":[6.983,47.495]}},{"type":"Feature","properties":{"ref":"E27"},"geometry":{"type":"Point","coordinates":[7.207,47.344]}},{"type":"Feature","properties":{"ref":"E27"},"geometry":{"type":"Point","coordinates":[7.385,45.739]}},{"type":"Feature","properties":{"ref":"E27"},"geometry":{"type":"Point","coordinates":[6.886,46.483]}},{"type":"Feature","properties":{"ref":"E272"},"geometry":{"type":"Point","coordinates":[22.276,56.005]}},{"type":"Feature","properties":{"ref":"E272"},"geometry":{"type":"Point","coordinates":[21.21,55.701]}},{"type":"Feature","properties":{"ref":"E272"},"geometry":{"type":"Point","coordinates":[24.336,55.673]}},{"type":"Feature","properties":{"ref":"E272"},"geometry":{"type":"Point","coordinates":[25.053,54.892]}},{"type":"Feature","properties":{"ref":"E272"},"geometry":{"type":"Point","coordinates":[23.808,55.757]}},{"type":"Feature","properties":{"ref":"E272"},"geometry":{"type":"Point","coordinates":[22.99,55.998]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[16.835,54.409]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[15.779,54.18]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[15.369,53.873]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[14.906,53.612]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[17.146,54.469]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[18.222,54.492]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[19.244,54.165]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[23.363,54.555]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[24.013,54.607]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[20.527,54.645]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[21.373,54.646]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[13.914,53.164]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[13.78,52.927]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[25.669,54.555]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[26.184,54.35]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[27.174,53.922]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"Point","coordinates":[22.204,54.616]}},{"type":"Feature","properties":{"ref":"E29"},"geometry":{"type":"Point","coordinates":[7.031,49.046]}},{"type":"Feature","properties":{"ref":"E29"},"geometry":{"type":"Point","coordinates":[6.365,49.478]}},{"type":"Feature","properties":{"ref":"E29"},"geometry":{"type":"Point","coordinates":[6.677,50.454]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[30.993,54.691]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[29.931,54.479]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[28.863,54.291]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[28.124,53.995]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[27.893,53.855]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[26.863,53.53]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[25.887,53.083]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[25.68,52.908]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[24.985,52.497]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[23.967,52.139]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[7.043,52.314]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[6.772,52.288]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[5.972,52.173]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[4.904,52.072]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[4.112,51.978]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[2.916,51.949]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[1.86,51.81]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[8.258,52.216]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[18.622,52.138]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[17.822,52.254]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[16.744,52.351]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[15.938,52.331]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[14.855,52.33]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[10.966,52.269]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[11.228,52.201]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[12.031,52.234]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[9.891,52.398]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[13.752,52.323]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[19.131,51.958]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[20.184,52.068]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[22.836,52.011]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"Point","coordinates":[21.019,52.14]}},{"type":"Feature","properties":{"ref":"E31"},"geometry":{"type":"Point","coordinates":[8.555,49.333]}},{"type":"Feature","properties":{"ref":"E31"},"geometry":{"type":"Point","coordinates":[7.975,49.855]}},{"type":"Feature","properties":{"ref":"E31"},"geometry":{"type":"Point","coordinates":[7.581,50.2]}},{"type":"Feature","properties":{"ref":"E31"},"geometry":{"type":"Point","coordinates":[6.917,50.678]}},{"type":"Feature","properties":{"ref":"E31"},"geometry":{"type":"Point","coordinates":[6.714,51.175]}},{"type":"Feature","properties":{"ref":"E31"},"geometry":{"type":"Point","coordinates":[5.795,51.799]}},{"type":"Feature","properties":{"ref":"E31"},"geometry":{"type":"Point","coordinates":[4.741,51.833]}},{"type":"Feature","properties":{"ref":"E311"},"geometry":{"type":"Point","coordinates":[5.147,52.067]}},{"type":"Feature","properties":{"ref":"E311"},"geometry":{"type":"Point","coordinates":[4.962,51.869]}},{"type":"Feature","properties":{"ref":"E312"},"geometry":{"type":"Point","coordinates":[5.409,51.484]}},{"type":"Feature","properties":{"ref":"E312"},"geometry":{"type":"Point","coordinates":[4.875,51.559]}},{"type":"Feature","properties":{"ref":"E312"},"geometry":{"type":"Point","coordinates":[3.811,51.484]}},{"type":"Feature","properties":{"ref":"E313"},"geometry":{"type":"Point","coordinates":[5.568,50.666]}},{"type":"Feature","properties":{"ref":"E313"},"geometry":{"type":"Point","coordinates":[5.188,51.04]}},{"type":"Feature","properties":{"ref":"E313"},"geometry":{"type":"Point","coordinates":[4.933,51.132]}},{"type":"Feature","properties":{"ref":"E314"},"geometry":{"type":"Point","coordinates":[5.755,50.959]}},{"type":"Feature","properties":{"ref":"E314"},"geometry":{"type":"Point","coordinates":[4.948,50.956]}},{"type":"Feature","properties":{"ref":"E314"},"geometry":{"type":"Point","coordinates":[6.18,50.805]}},{"type":"Feature","properties":{"ref":"E331"},"geometry":{"type":"Point","coordinates":[10.112,51.014]}},{"type":"Feature","properties":{"ref":"E331"},"geometry":{"type":"Point","coordinates":[9.882,51.155]}},{"type":"Feature","properties":{"ref":"E331"},"geometry":{"type":"Point","coordinates":[8.893,51.534]}},{"type":"Feature","properties":{"ref":"E331"},"geometry":{"type":"Point","coordinates":[7.814,51.53]}},{"type":"Feature","properties":{"ref":"E34"},"geometry":{"type":"Point","coordinates":[6.216,51.384]}},{"type":"Feature","properties":{"ref":"E34"},"geometry":{"type":"Point","coordinates":[7.266,51.597]}},{"type":"Feature","properties":{"ref":"E34"},"geometry":{"type":"Point","coordinates":[8.025,51.778]}},{"type":"Feature","properties":{"ref":"E34"},"geometry":{"type":"Point","coordinates":[8.736,52.126]}},{"type":"Feature","properties":{"ref":"E34"},"geometry":{"type":"Point","coordinates":[5.946,51.378]}},{"type":"Feature","properties":{"ref":"E34"},"geometry":{"type":"Point","coordinates":[4.933,51.298]}},{"type":"Feature","properties":{"ref":"E34"},"geometry":{"type":"Point","coordinates":[3.867,51.187]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[6.166,51.899]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[5.922,52.016]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[4.955,52.278]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[8.246,47.1]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[7.997,47.207]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[8.597,46.697]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[7.716,50.506]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[7.78,48.022]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[8.634,49.414]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[8.466,50.029]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[8.38,48.955]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[11.262,44.482]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[10.743,44.703]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[9.939,44.948]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"Point","coordinates":[9.708,45.091]}},{"type":"Feature","properties":{"ref":"E36"},"geometry":{"type":"Point","coordinates":[13.555,52.319]}},{"type":"Feature","properties":{"ref":"E36"},"geometry":{"type":"Point","coordinates":[13.856,51.885]}},{"type":"Feature","properties":{"ref":"E36"},"geometry":{"type":"Point","coordinates":[14.1,51.769]}},{"type":"Feature","properties":{"ref":"E36"},"geometry":{"type":"Point","coordinates":[15.153,51.533]}},{"type":"Feature","properties":{"ref":"E37"},"geometry":{"type":"Point","coordinates":[8.7,53.005]}},{"type":"Feature","properties":{"ref":"E37"},"geometry":{"type":"Point","coordinates":[8.443,52.915]}},{"type":"Feature","properties":{"ref":"E37"},"geometry":{"type":"Point","coordinates":[7.954,52.316]}},{"type":"Feature","properties":{"ref":"E37"},"geometry":{"type":"Point","coordinates":[7.546,51.959]}},{"type":"Feature","properties":{"ref":"E37"},"geometry":{"type":"Point","coordinates":[6.907,51.005]}},{"type":"Feature","properties":{"ref":"E371"},"geometry":{"type":"Point","coordinates":[21.398,50.802]}},{"type":"Feature","properties":{"ref":"E371"},"geometry":{"type":"Point","coordinates":[21.872,49.935]}},{"type":"Feature","properties":{"ref":"E371"},"geometry":{"type":"Point","coordinates":[21.255,48.949]}},{"type":"Feature","properties":{"ref":"E371"},"geometry":{"type":"Point","coordinates":[21.202,51.362]}},{"type":"Feature","properties":{"ref":"E372"},"geometry":{"type":"Point","coordinates":[23.981,50.069]}},{"type":"Feature","properties":{"ref":"E372"},"geometry":{"type":"Point","coordinates":[22.945,51.099]}},{"type":"Feature","properties":{"ref":"E372"},"geometry":{"type":"Point","coordinates":[24.063,49.878]}},{"type":"Feature","properties":{"ref":"E372"},"geometry":{"type":"Point","coordinates":[21.919,51.644]}},{"type":"Feature","properties":{"ref":"E372"},"geometry":{"type":"Point","coordinates":[21.521,52.014]}},{"type":"Feature","properties":{"ref":"E373"},"geometry":{"type":"Point","coordinates":[23.472,51.143]}},{"type":"Feature","properties":{"ref":"E373"},"geometry":{"type":"Point","coordinates":[30.362,50.516]}},{"type":"Feature","properties":{"ref":"E373"},"geometry":{"type":"Point","coordinates":[22.858,51.147]}},{"type":"Feature","properties":{"ref":"E373"},"geometry":{"type":"Point","coordinates":[24.22,51.211]}},{"type":"Feature","properties":{"ref":"E373"},"geometry":{"type":"Point","coordinates":[26.622,51.317]}},{"type":"Feature","properties":{"ref":"E373"},"geometry":{"type":"Point","coordinates":[25.805,51.249]}},{"type":"Feature","properties":{"ref":"E373"},"geometry":{"type":"Point","coordinates":[29.918,50.64]}},{"type":"Feature","properties":{"ref":"E373"},"geometry":{"type":"Point","coordinates":[27.183,51.237]}},{"type":"Feature","properties":{"ref":"E373"},"geometry":{"type":"Point","coordinates":[28.003,51.082]}},{"type":"Feature","properties":{"ref":"E373"},"geometry":{"type":"Point","coordinates":[28.81,50.94]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[15.009,51.181]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[14.738,51.207]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[13.927,51.162]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[13.136,50.993]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[12.89,50.87]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[5.798,50.634]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[2.562,51.057]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[3.087,51.192]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[3.891,50.95]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[4.153,50.884]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[6.015,50.658]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[36.087,49.957]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[36.33,50.078]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[37.193,49.412]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[37.478,48.969]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[38.167,48.525]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[39.163,48.551]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[31.018,50.323]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[32.103,50.229]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[33.113,49.916]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[34.115,49.581]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[30.974,50.339]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[29.887,50.422]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[28.814,50.286]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[27.769,50.567]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[26.96,50.599]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[25.901,50.481]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[24.95,49.965]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[35.029,49.65]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[23.121,49.956]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[16.055,51.176]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[17.109,50.937]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[18.091,50.478]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[19.116,50.218]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[19.893,49.99]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[20.163,50.008]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[21.244,50.101]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[22.055,50.094]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[22.825,49.91]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[10.098,51.006]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[10.617,50.907]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[11.154,50.936]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[8.128,50.786]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[7.895,50.924]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"Point","coordinates":[9.852,50.892]}},{"type":"Feature","properties":{"ref":"E41"},"geometry":{"type":"Point","coordinates":[8.62,46.954]}},{"type":"Feature","properties":{"ref":"E41"},"geometry":{"type":"Point","coordinates":[8.726,47.741]}},{"type":"Feature","properties":{"ref":"E41"},"geometry":{"type":"Point","coordinates":[7.367,51.586]}},{"type":"Feature","properties":{"ref":"E41"},"geometry":{"type":"Point","coordinates":[7.865,50.949]}},{"type":"Feature","properties":{"ref":"E41"},"geometry":{"type":"Point","coordinates":[8.098,50.812]}},{"type":"Feature","properties":{"ref":"E41"},"geometry":{"type":"Point","coordinates":[9.006,50.238]}},{"type":"Feature","properties":{"ref":"E41"},"geometry":{"type":"Point","coordinates":[9.125,49.996]}},{"type":"Feature","properties":{"ref":"E41"},"geometry":{"type":"Point","coordinates":[9.102,48.839]}},{"type":"Feature","properties":{"ref":"E41"},"geometry":{"type":"Point","coordinates":[8.922,48.637]}},{"type":"Feature","properties":{"ref":"E411"},"geometry":{"type":"Point","coordinates":[5.807,49.55]}},{"type":"Feature","properties":{"ref":"E411"},"geometry":{"type":"Point","coordinates":[5.177,50.076]}},{"type":"Feature","properties":{"ref":"E411"},"geometry":{"type":"Point","coordinates":[4.88,50.526]}},{"type":"Feature","properties":{"ref":"E411"},"geometry":{"type":"Point","coordinates":[6.173,49.285]}},{"type":"Feature","properties":{"ref":"E42"},"geometry":{"type":"Point","coordinates":[7.163,49.854]}},{"type":"Feature","properties":{"ref":"E42"},"geometry":{"type":"Point","coordinates":[6.91,49.948]}},{"type":"Feature","properties":{"ref":"E42"},"geometry":{"type":"Point","coordinates":[6.65,50.021]}},{"type":"Feature","properties":{"ref":"E42"},"geometry":{"type":"Point","coordinates":[9.021,49.991]}},{"type":"Feature","properties":{"ref":"E42"},"geometry":{"type":"Point","coordinates":[8.759,50.066]}},{"type":"Feature","properties":{"ref":"E42"},"geometry":{"type":"Point","coordinates":[8.229,49.966]}},{"type":"Feature","properties":{"ref":"E42"},"geometry":{"type":"Point","coordinates":[5.812,50.635]}},{"type":"Feature","properties":{"ref":"E42"},"geometry":{"type":"Point","coordinates":[4.734,50.496]}},{"type":"Feature","properties":{"ref":"E42"},"geometry":{"type":"Point","coordinates":[3.926,50.461]}},{"type":"Feature","properties":{"ref":"E421"},"geometry":{"type":"Point","coordinates":[6.052,50.156]}},{"type":"Feature","properties":{"ref":"E421"},"geometry":{"type":"Point","coordinates":[6.186,49.649]}},{"type":"Feature","properties":{"ref":"E422"},"geometry":{"type":"Point","coordinates":[6.958,49.26]}},{"type":"Feature","properties":{"ref":"E422"},"geometry":{"type":"Point","coordinates":[7.019,49.356]}},{"type":"Feature","properties":{"ref":"E43"},"geometry":{"type":"Point","coordinates":[9.649,47.452]}},{"type":"Feature","properties":{"ref":"E43"},"geometry":{"type":"Point","coordinates":[9.548,46.957]}},{"type":"Feature","properties":{"ref":"E43"},"geometry":{"type":"Point","coordinates":[10.137,48.085]}},{"type":"Feature","properties":{"ref":"E43"},"geometry":{"type":"Point","coordinates":[10.257,49.126]}},{"type":"Feature","properties":{"ref":"E43"},"geometry":{"type":"Point","coordinates":[9.898,49.752]}},{"type":"Feature","properties":{"ref":"E44"},"geometry":{"type":"Point","coordinates":[5.842,49.554]}},{"type":"Feature","properties":{"ref":"E44"},"geometry":{"type":"Point","coordinates":[6.497,49.731]}},{"type":"Feature","properties":{"ref":"E44"},"geometry":{"type":"Point","coordinates":[8.652,50.608]}},{"type":"Feature","properties":{"ref":"E44"},"geometry":{"type":"Point","coordinates":[7.859,50.452]}},{"type":"Feature","properties":{"ref":"E44"},"geometry":{"type":"Point","coordinates":[6.934,50.009]}},{"type":"Feature","properties":{"ref":"E44"},"geometry":{"type":"Point","coordinates":[4.071,49.938]}},{"type":"Feature","properties":{"ref":"E44"},"geometry":{"type":"Point","coordinates":[3.65,49.906]}},{"type":"Feature","properties":{"ref":"E44"},"geometry":{"type":"Point","coordinates":[2.783,49.858]}},{"type":"Feature","properties":{"ref":"E44"},"geometry":{"type":"Point","coordinates":[1.972,49.81]}},{"type":"Feature","properties":{"ref":"E44"},"geometry":{"type":"Point","coordinates":[0.91,49.66]}},{"type":"Feature","properties":{"ref":"E441"},"geometry":{"type":"Point","coordinates":[12.845,50.843]}},{"type":"Feature","properties":{"ref":"E441"},"geometry":{"type":"Point","coordinates":[11.89,50.369]}},{"type":"Feature","properties":{"ref":"E442"},"geometry":{"type":"Point","coordinates":[13.77,50.546]}},{"type":"Feature","properties":{"ref":"E442"},"geometry":{"type":"Point","coordinates":[15.155,50.58]}},{"type":"Feature","properties":{"ref":"E442"},"geometry":{"type":"Point","coordinates":[16.199,49.909]}},{"type":"Feature","properties":{"ref":"E442"},"geometry":{"type":"Point","coordinates":[17.694,49.547]}},{"type":"Feature","properties":{"ref":"E442"},"geometry":{"type":"Point","coordinates":[18.732,49.23]}},{"type":"Feature","properties":{"ref":"E442"},"geometry":{"type":"Point","coordinates":[14.088,50.665]}},{"type":"Feature","properties":{"ref":"E442"},"geometry":{"type":"Point","coordinates":[12.883,50.238]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[10.015,53.375]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[9.981,53.106]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[9.793,52.908]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[10.155,51.99]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[9.879,51.526]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[9.559,50.919]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[9.328,54.806]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[9.368,55.073]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[9.879,56.009]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[10.074,56.197]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[9.957,57.075]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[10.2,57.194]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[11.633,57.601]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[11.508,47.003]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[12.001,47.481]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[11.756,48.149]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[11.286,49.096]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[10.815,49.732]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[9.994,49.861]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[11.638,46.767]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[11.03,45.906]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[10.898,45.668]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"Point","coordinates":[10.851,44.859]}},{"type":"Feature","properties":{"ref":"E451"},"geometry":{"type":"Point","coordinates":[8.559,49.548]}},{"type":"Feature","properties":{"ref":"E451"},"geometry":{"type":"Point","coordinates":[8.618,50.087]}},{"type":"Feature","properties":{"ref":"E46"},"geometry":{"type":"Point","coordinates":[5.063,49.762]}},{"type":"Feature","properties":{"ref":"E46"},"geometry":{"type":"Point","coordinates":[5.469,50.103]}},{"type":"Feature","properties":{"ref":"E46"},"geometry":{"type":"Point","coordinates":[3.701,49.308]}},{"type":"Feature","properties":{"ref":"E46"},"geometry":{"type":"Point","coordinates":[-1.597,49.599]}},{"type":"Feature","properties":{"ref":"E46"},"geometry":{"type":"Point","coordinates":[-0.87,49.324]}},{"type":"Feature","properties":{"ref":"E46"},"geometry":{"type":"Point","coordinates":[1.229,49.462]}},{"type":"Feature","properties":{"ref":"E46"},"geometry":{"type":"Point","coordinates":[2.198,49.412]}},{"type":"Feature","properties":{"ref":"E46"},"geometry":{"type":"Point","coordinates":[4.792,49.737]}},{"type":"Feature","properties":{"ref":"E461"},"geometry":{"type":"Point","coordinates":[16.656,48.734]}},{"type":"Feature","properties":{"ref":"E461"},"geometry":{"type":"Point","coordinates":[16.577,49.547]}},{"type":"Feature","properties":{"ref":"E462"},"geometry":{"type":"Point","coordinates":[16.603,49.16]}},{"type":"Feature","properties":{"ref":"E462"},"geometry":{"type":"Point","coordinates":[17.087,49.36]}},{"type":"Feature","properties":{"ref":"E462"},"geometry":{"type":"Point","coordinates":[19.025,50.13]}},{"type":"Feature","properties":{"ref":"E462"},"geometry":{"type":"Point","coordinates":[19.023,49.859]}},{"type":"Feature","properties":{"ref":"E462"},"geometry":{"type":"Point","coordinates":[18.763,49.788]}},{"type":"Feature","properties":{"ref":"E462"},"geometry":{"type":"Point","coordinates":[18.945,50.051]}},{"type":"Feature","properties":{"ref":"E47"},"geometry":{"type":"Point","coordinates":[11.351,54.654]}},{"type":"Feature","properties":{"ref":"E47"},"geometry":{"type":"Point","coordinates":[11.936,55.115]}},{"type":"Feature","properties":{"ref":"E47"},"geometry":{"type":"Point","coordinates":[12.068,55.351]}},{"type":"Feature","properties":{"ref":"E47"},"geometry":{"type":"Point","coordinates":[10.602,53.854]}},{"type":"Feature","properties":{"ref":"E47"},"geometry":{"type":"Point","coordinates":[10.759,54.074]}},{"type":"Feature","properties":{"ref":"E47"},"geometry":{"type":"Point","coordinates":[12.564,56.019]}},{"type":"Feature","properties":{"ref":"E471"},"geometry":{"type":"Point","coordinates":[22.709,48.458]}},{"type":"Feature","properties":{"ref":"E471"},"geometry":{"type":"Point","coordinates":[23.081,48.803]}},{"type":"Feature","properties":{"ref":"E471"},"geometry":{"type":"Point","coordinates":[23.555,49.064]}},{"type":"Feature","properties":{"ref":"E471"},"geometry":{"type":"Point","coordinates":[24.01,49.695]}},{"type":"Feature","properties":{"ref":"E48"},"geometry":{"type":"Point","coordinates":[13.529,50.158]}},{"type":"Feature","properties":{"ref":"E48"},"geometry":{"type":"Point","coordinates":[12.232,50.085]}},{"type":"Feature","properties":{"ref":"E48"},"geometry":{"type":"Point","coordinates":[10.082,50.001]}},{"type":"Feature","properties":{"ref":"E48"},"geometry":{"type":"Point","coordinates":[10.621,49.978]}},{"type":"Feature","properties":{"ref":"E48"},"geometry":{"type":"Point","coordinates":[11.148,49.991]}},{"type":"Feature","properties":{"ref":"E48"},"geometry":{"type":"Point","coordinates":[11.416,50.022]}},{"type":"Feature","properties":{"ref":"E48"},"geometry":{"type":"Point","coordinates":[14.193,50.095]}},{"type":"Feature","properties":{"ref":"E49"},"geometry":{"type":"Point","coordinates":[13.348,49.775]}},{"type":"Feature","properties":{"ref":"E49"},"geometry":{"type":"Point","coordinates":[14.036,49.351]}},{"type":"Feature","properties":{"ref":"E49"},"geometry":{"type":"Point","coordinates":[11.545,52.169]}},{"type":"Feature","properties":{"ref":"E49"},"geometry":{"type":"Point","coordinates":[11.693,51.942]}},{"type":"Feature","properties":{"ref":"E49"},"geometry":{"type":"Point","coordinates":[12.007,51.553]}},{"type":"Feature","properties":{"ref":"E49"},"geometry":{"type":"Point","coordinates":[11.835,50.938]}},{"type":"Feature","properties":{"ref":"E49"},"geometry":{"type":"Point","coordinates":[12.063,50.543]}},{"type":"Feature","properties":{"ref":"E49"},"geometry":{"type":"Point","coordinates":[14.49,48.996]}},{"type":"Feature","properties":{"ref":"E49"},"geometry":{"type":"Point","coordinates":[16.408,48.187]}},{"type":"Feature","properties":{"ref":"E49"},"geometry":{"type":"Point","coordinates":[15.969,48.484]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[12.522,49.642]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[11.756,49.411]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[10.96,49.305]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[9.886,49.176]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[8.819,49.259]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[7.86,49.461]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[21.925,48.745]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[22.196,48.741]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[17.896,48.952]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[18.183,48.981]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[18.42,49.11]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[19.206,49.121]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[20.013,49.07]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[21.084,49.0]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[20.908,48.996]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[13.04,49.707]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[14.072,49.958]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[14.334,50.02]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[15.073,49.71]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[16.076,49.328]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[17.634,49.017]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[6.958,49.204]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[5.889,49.197]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[4.812,49.077]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[3.771,49.206]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[3.009,48.924]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[2.754,48.83]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[1.74,48.509]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[0.981,48.227]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[-1.163,48.072]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[-2.205,48.288]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[-3.239,48.568]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[-4.043,48.518]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[24.611,49.398]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[35.695,48.565]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[26.887,49.402]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[25.818,49.54]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[30.961,48.645]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[31.237,48.572]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[32.044,48.517]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[23.594,49.109]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[23.369,48.96]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[33.745,48.421]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[27.158,49.395]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[28.848,48.95]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[28.673,49.156]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[38.031,48.217]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[37.783,48.106]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[34.015,48.347]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[39.756,47.847]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[39.249,48.024]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[36.816,48.364]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"Point","coordinates":[29.112,48.874]}},{"type":"Feature","properties":{"ref":"E51"},"geometry":{"type":"Point","coordinates":[11.235,49.449]}},{"type":"Feature","properties":{"ref":"E51"},"geometry":{"type":"Point","coordinates":[11.702,50.103]}},{"type":"Feature","properties":{"ref":"E51"},"geometry":{"type":"Point","coordinates":[11.973,51.142]}},{"type":"Feature","properties":{"ref":"E51"},"geometry":{"type":"Point","coordinates":[12.171,51.325]}},{"type":"Feature","properties":{"ref":"E51"},"geometry":{"type":"Point","coordinates":[12.765,52.144]}},{"type":"Feature","properties":{"ref":"E51"},"geometry":{"type":"Point","coordinates":[13.214,52.452]}},{"type":"Feature","properties":{"ref":"E512"},"geometry":{"type":"Point","coordinates":[6.999,47.888]}},{"type":"Feature","properties":{"ref":"E512"},"geometry":{"type":"Point","coordinates":[7.087,47.816]}},{"type":"Feature","properties":{"ref":"E52"},"geometry":{"type":"Point","coordinates":[13.002,47.761]}},{"type":"Feature","properties":{"ref":"E52"},"geometry":{"type":"Point","coordinates":[12.741,47.831]}},{"type":"Feature","properties":{"ref":"E52"},"geometry":{"type":"Point","coordinates":[8.522,48.937]}},{"type":"Feature","properties":{"ref":"E52"},"geometry":{"type":"Point","coordinates":[9.03,48.768]}},{"type":"Feature","properties":{"ref":"E52"},"geometry":{"type":"Point","coordinates":[11.881,47.834]}},{"type":"Feature","properties":{"ref":"E52"},"geometry":{"type":"Point","coordinates":[11.671,48.005]}},{"type":"Feature","properties":{"ref":"E52"},"geometry":{"type":"Point","coordinates":[10.987,48.402]}},{"type":"Feature","properties":{"ref":"E52"},"geometry":{"type":"Point","coordinates":[7.819,48.576]}},{"type":"Feature","properties":{"ref":"E53"},"geometry":{"type":"Point","coordinates":[13.309,49.382]}},{"type":"Feature","properties":{"ref":"E53"},"geometry":{"type":"Point","coordinates":[11.542,48.232]}},{"type":"Feature","properties":{"ref":"E53"},"geometry":{"type":"Point","coordinates":[12.009,48.501]}},{"type":"Feature","properties":{"ref":"E53"},"geometry":{"type":"Point","coordinates":[12.982,49.013]}},{"type":"Feature","properties":{"ref":"E531"},"geometry":{"type":"Point","coordinates":[7.909,48.471]}},{"type":"Feature","properties":{"ref":"E531"},"geometry":{"type":"Point","coordinates":[8.097,48.278]}},{"type":"Feature","properties":{"ref":"E531"},"geometry":{"type":"Point","coordinates":[8.557,47.997]}},{"type":"Feature","properties":{"ref":"E532"},"geometry":{"type":"Point","coordinates":[10.148,48.003]}},{"type":"Feature","properties":{"ref":"E532"},"geometry":{"type":"Point","coordinates":[10.32,47.795]}},{"type":"Feature","properties":{"ref":"E533"},"geometry":{"type":"Point","coordinates":[11.517,48.11]}},{"type":"Feature","properties":{"ref":"E533"},"geometry":{"type":"Point","coordinates":[11.394,47.87]}},{"type":"Feature","properties":{"ref":"E54"},"geometry":{"type":"Point","coordinates":[8.457,47.676]}},{"type":"Feature","properties":{"ref":"E54"},"geometry":{"type":"Point","coordinates":[7.931,47.555]}},{"type":"Feature","properties":{"ref":"E54"},"geometry":{"type":"Point","coordinates":[9.239,47.739]}},{"type":"Feature","properties":{"ref":"E54"},"geometry":{"type":"Point","coordinates":[10.188,47.999]}},{"type":"Feature","properties":{"ref":"E54"},"geometry":{"type":"Point","coordinates":[10.457,48.032]}},{"type":"Feature","properties":{"ref":"E54"},"geometry":{"type":"Point","coordinates":[11.264,48.092]}},{"type":"Feature","properties":{"ref":"E54"},"geometry":{"type":"Point","coordinates":[6.998,47.681]}},{"type":"Feature","properties":{"ref":"E54"},"geometry":{"type":"Point","coordinates":[2.412,48.815]}},{"type":"Feature","properties":{"ref":"E54"},"geometry":{"type":"Point","coordinates":[5.326,47.872]}},{"type":"Feature","properties":{"ref":"E54"},"geometry":{"type":"Point","coordinates":[3.075,48.372]}},{"type":"Feature","properties":{"ref":"E54"},"geometry":{"type":"Point","coordinates":[4.126,48.222]}},{"type":"Feature","properties":{"ref":"E54"},"geometry":{"type":"Point","coordinates":[5.039,48.041]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[13.899,50.783]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[13.743,51.004]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[13.594,52.231]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[12.964,52.553]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[12.457,53.186]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[12.102,54.142]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[12.691,56.043]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[11.918,54.705]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[11.989,55.006]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[12.009,55.276]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[14.661,49.567]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[14.496,50.028]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[14.454,48.776]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[13.777,47.985]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[12.989,47.8]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[13.61,46.941]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[13.892,48.003]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[13.187,45.857]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[12.92,45.806]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[12.228,44.94]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[12.816,43.917]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[13.063,43.806]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[13.91,42.826]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[14.061,42.602]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[15.206,41.909]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[16.048,41.242]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[17.105,41.046]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"Point","coordinates":[17.331,40.894]}},{"type":"Feature","properties":{"ref":"E551"},"geometry":{"type":"Point","coordinates":[14.51,49.006]}},{"type":"Feature","properties":{"ref":"E551"},"geometry":{"type":"Point","coordinates":[15.35,49.525]}},{"type":"Feature","properties":{"ref":"E552"},"geometry":{"type":"Point","coordinates":[13.037,48.24]}},{"type":"Feature","properties":{"ref":"E552"},"geometry":{"type":"Point","coordinates":[12.767,48.251]}},{"type":"Feature","properties":{"ref":"E552"},"geometry":{"type":"Point","coordinates":[11.957,48.219]}},{"type":"Feature","properties":{"ref":"E552"},"geometry":{"type":"Point","coordinates":[14.229,48.192]}},{"type":"Feature","properties":{"ref":"E56"},"geometry":{"type":"Point","coordinates":[14.038,48.063]}},{"type":"Feature","properties":{"ref":"E56"},"geometry":{"type":"Point","coordinates":[13.796,48.183]}},{"type":"Feature","properties":{"ref":"E56"},"geometry":{"type":"Point","coordinates":[12.976,48.806]}},{"type":"Feature","properties":{"ref":"E56"},"geometry":{"type":"Point","coordinates":[11.93,49.045]}},{"type":"Feature","properties":{"ref":"E57"},"geometry":{"type":"Point","coordinates":[15.645,46.691]}},{"type":"Feature","properties":{"ref":"E57"},"geometry":{"type":"Point","coordinates":[14.872,46.188]}},{"type":"Feature","properties":{"ref":"E57"},"geometry":{"type":"Point","coordinates":[15.35,47.14]}},{"type":"Feature","properties":{"ref":"E57"},"geometry":{"type":"Point","coordinates":[14.868,47.392]}},{"type":"Feature","properties":{"ref":"E571"},"geometry":{"type":"Point","coordinates":[21.275,48.724]}},{"type":"Feature","properties":{"ref":"E571"},"geometry":{"type":"Point","coordinates":[20.759,48.601]}},{"type":"Feature","properties":{"ref":"E571"},"geometry":{"type":"Point","coordinates":[19.789,48.361]}},{"type":"Feature","properties":{"ref":"E571"},"geometry":{"type":"Point","coordinates":[18.869,48.583]}},{"type":"Feature","properties":{"ref":"E571"},"geometry":{"type":"Point","coordinates":[17.858,48.285]}},{"type":"Feature","properties":{"ref":"E572"},"geometry":{"type":"Point","coordinates":[18.84,48.578]}},{"type":"Feature","properties":{"ref":"E572"},"geometry":{"type":"Point","coordinates":[17.969,48.853]}},{"type":"Feature","properties":{"ref":"E573"},"geometry":{"type":"Point","coordinates":[22.307,48.579]}},{"type":"Feature","properties":{"ref":"E573"},"geometry":{"type":"Point","coordinates":[21.819,47.94]}},{"type":"Feature","properties":{"ref":"E574"},"geometry":{"type":"Point","coordinates":[25.497,45.636]}},{"type":"Feature","properties":{"ref":"E574"},"geometry":{"type":"Point","coordinates":[24.955,45.009]}},{"type":"Feature","properties":{"ref":"E574"},"geometry":{"type":"Point","coordinates":[24.356,44.432]}},{"type":"Feature","properties":{"ref":"E574"},"geometry":{"type":"Point","coordinates":[26.772,46.253]}},{"type":"Feature","properties":{"ref":"E574"},"geometry":{"type":"Point","coordinates":[26.119,45.994]}},{"type":"Feature","properties":{"ref":"E574"},"geometry":{"type":"Point","coordinates":[23.795,44.321]}},{"type":"Feature","properties":{"ref":"E575"},"geometry":{"type":"Point","coordinates":[17.713,47.648]}},{"type":"Feature","properties":{"ref":"E575"},"geometry":{"type":"Point","coordinates":[17.47,48.009]}},{"type":"Feature","properties":{"ref":"E576"},"geometry":{"type":"Point","coordinates":[23.689,46.781]}},{"type":"Feature","properties":{"ref":"E576"},"geometry":{"type":"Point","coordinates":[23.84,47.005]}},{"type":"Feature","properties":{"ref":"E578"},"geometry":{"type":"Point","coordinates":[25.84,46.313]}},{"type":"Feature","properties":{"ref":"E578"},"geometry":{"type":"Point","coordinates":[24.713,46.791]}},{"type":"Feature","properties":{"ref":"E578"},"geometry":{"type":"Point","coordinates":[25.803,45.862]}},{"type":"Feature","properties":{"ref":"E579"},"geometry":{"type":"Point","coordinates":[22.573,48.165]}},{"type":"Feature","properties":{"ref":"E579"},"geometry":{"type":"Point","coordinates":[22.099,47.94]}},{"type":"Feature","properties":{"ref":"E579"},"geometry":{"type":"Point","coordinates":[21.831,47.904]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[25.506,47.536]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[24.456,47.109]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[31.996,47.016]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[26.676,47.724]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[36.659,46.804]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[35.8,46.722]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[23.519,47.653]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[37.512,47.099]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[32.242,46.829]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[27.512,47.173]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[38.092,47.128]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[22.648,48.211]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[28.601,47.154]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[29.179,47.004]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[29.441,46.924]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[30.196,46.64]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[33.069,46.696]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[34.188,46.788]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[31.888,46.982]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[17.073,48.071]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[16.804,48.038]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[21.925,48.745]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[20.909,48.606]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[19.88,48.373]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"Point","coordinates":[18.869,48.583]}},{"type":"Feature","properties":{"ref":"E59"},"geometry":{"type":"Point","coordinates":[16.049,48.719]}},{"type":"Feature","properties":{"ref":"E59"},"geometry":{"type":"Point","coordinates":[16.205,47.788]}},{"type":"Feature","properties":{"ref":"E59"},"geometry":{"type":"Point","coordinates":[15.842,47.09]}},{"type":"Feature","properties":{"ref":"E59"},"geometry":{"type":"Point","coordinates":[15.573,46.792]}},{"type":"Feature","properties":{"ref":"E59"},"geometry":{"type":"Point","coordinates":[15.848,45.792]}},{"type":"Feature","properties":{"ref":"E59"},"geometry":{"type":"Point","coordinates":[15.586,49.375]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[9.645,47.459]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[11.673,47.326]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[10.874,47.26]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[14.469,48.203]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[13.975,48.031]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[13.717,47.952]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[12.927,47.768]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[21.792,47.119]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[20.866,47.27]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[19.995,47.221]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[18.952,47.418]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[17.906,47.681]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[1.84,48.036]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[2.104,48.094]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[3.179,47.992]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[4.132,47.492]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[5.081,47.031]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[6.119,47.326]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[7.103,47.71]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[8.098,47.481]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[25.582,45.749]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[23.278,46.797]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[28.609,44.108]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[26.188,44.513]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[22.417,47.053]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[22.673,46.97]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[25.94,44.978]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[27.387,44.57]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[24.638,46.462]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[25.023,46.124]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[15.257,48.199]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"Point","coordinates":[16.046,48.081]}},{"type":"Feature","properties":{"ref":"E61"},"geometry":{"type":"Point","coordinates":[13.901,45.624]}},{"type":"Feature","properties":{"ref":"E61"},"geometry":{"type":"Point","coordinates":[14.132,45.765]}},{"type":"Feature","properties":{"ref":"E61"},"geometry":{"type":"Point","coordinates":[14.486,46.173]}},{"type":"Feature","properties":{"ref":"E61"},"geometry":{"type":"Point","coordinates":[13.996,46.45]}},{"type":"Feature","properties":{"ref":"E611"},"geometry":{"type":"Point","coordinates":[4.893,45.783]}},{"type":"Feature","properties":{"ref":"E611"},"geometry":{"type":"Point","coordinates":[5.152,45.863]}},{"type":"Feature","properties":{"ref":"E612"},"geometry":{"type":"Point","coordinates":[7.708,45.133]}},{"type":"Feature","properties":{"ref":"E62"},"geometry":{"type":"Point","coordinates":[7.752,46.306]}},{"type":"Feature","properties":{"ref":"E62"},"geometry":{"type":"Point","coordinates":[6.574,46.564]}},{"type":"Feature","properties":{"ref":"E62"},"geometry":{"type":"Point","coordinates":[5.832,46.091]}},{"type":"Feature","properties":{"ref":"E62"},"geometry":{"type":"Point","coordinates":[4.834,46.271]}},{"type":"Feature","properties":{"ref":"E62"},"geometry":{"type":"Point","coordinates":[8.902,44.41]}},{"type":"Feature","properties":{"ref":"E62"},"geometry":{"type":"Point","coordinates":[9.005,45.176]}},{"type":"Feature","properties":{"ref":"E62"},"geometry":{"type":"Point","coordinates":[8.152,46.197]}},{"type":"Feature","properties":{"ref":"E62"},"geometry":{"type":"Point","coordinates":[8.327,45.991]}},{"type":"Feature","properties":{"ref":"E64"},"geometry":{"type":"Point","coordinates":[10.238,45.505]}},{"type":"Feature","properties":{"ref":"E64"},"geometry":{"type":"Point","coordinates":[9.968,45.592]}},{"type":"Feature","properties":{"ref":"E64"},"geometry":{"type":"Point","coordinates":[8.91,45.498]}},{"type":"Feature","properties":{"ref":"E64"},"geometry":{"type":"Point","coordinates":[7.893,45.211]}},{"type":"Feature","properties":{"ref":"E641"},"geometry":{"type":"Point","coordinates":[12.056,47.492]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[17.529,42.954]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[17.389,43.186]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[16.914,43.444]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[15.913,43.814]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[15.455,44.108]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[14.787,45.128]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[16.701,46.412]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[16.145,45.847]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[15.89,45.755]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[18.134,42.638]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[13.078,55.56]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[14.257,53.9]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[14.209,54.174]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[13.93,54.99]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[16.62,47.194]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[17.099,47.449]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[17.176,48.013]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[16.987,48.686]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[16.65,49.113]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[15.887,49.396]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[14.895,49.806]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[15.152,50.603]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[14.944,50.431]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[15.548,51.939]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[16.161,51.419]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[15.562,52.208]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[14.909,52.972]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"Point","coordinates":[16.151,50.911]}},{"type":"Feature","properties":{"ref":"E651"},"geometry":{"type":"Point","coordinates":[14.259,47.56]}},{"type":"Feature","properties":{"ref":"E651"},"geometry":{"type":"Point","coordinates":[13.999,47.487]}},{"type":"Feature","properties":{"ref":"E652"},"geometry":{"type":"Point","coordinates":[14.23,46.63]}},{"type":"Feature","properties":{"ref":"E653"},"geometry":{"type":"Point","coordinates":[15.69,46.589]}},{"type":"Feature","properties":{"ref":"E653"},"geometry":{"type":"Point","coordinates":[16.224,46.638]}},{"type":"Feature","properties":{"ref":"E66"},"geometry":{"type":"Point","coordinates":[19.801,47.182]}},{"type":"Feature","properties":{"ref":"E66"},"geometry":{"type":"Point","coordinates":[19.667,46.947]}},{"type":"Feature","properties":{"ref":"E66"},"geometry":{"type":"Point","coordinates":[18.842,47.025]}},{"type":"Feature","properties":{"ref":"E66"},"geometry":{"type":"Point","coordinates":[17.801,47.12]}},{"type":"Feature","properties":{"ref":"E66"},"geometry":{"type":"Point","coordinates":[16.866,47.09]}},{"type":"Feature","properties":{"ref":"E66"},"geometry":{"type":"Point","coordinates":[16.337,46.975]}},{"type":"Feature","properties":{"ref":"E66"},"geometry":{"type":"Point","coordinates":[15.815,47.099]}},{"type":"Feature","properties":{"ref":"E66"},"geometry":{"type":"Point","coordinates":[15.288,46.981]}},{"type":"Feature","properties":{"ref":"E66"},"geometry":{"type":"Point","coordinates":[14.813,46.787]}},{"type":"Feature","properties":{"ref":"E66"},"geometry":{"type":"Point","coordinates":[13.764,46.648]}},{"type":"Feature","properties":{"ref":"E66"},"geometry":{"type":"Point","coordinates":[12.994,46.747]}},{"type":"Feature","properties":{"ref":"E66"},"geometry":{"type":"Point","coordinates":[11.739,46.815]}},{"type":"Feature","properties":{"ref":"E661"},"geometry":{"type":"Point","coordinates":[17.397,44.144]}},{"type":"Feature","properties":{"ref":"E661"},"geometry":{"type":"Point","coordinates":[17.217,45.038]}},{"type":"Feature","properties":{"ref":"E661"},"geometry":{"type":"Point","coordinates":[17.443,46.096]}},{"type":"Feature","properties":{"ref":"E662"},"geometry":{"type":"Point","coordinates":[18.686,45.749]}},{"type":"Feature","properties":{"ref":"E662"},"geometry":{"type":"Point","coordinates":[19.665,46.04]}},{"type":"Feature","properties":{"ref":"E662"},"geometry":{"type":"Point","coordinates":[19.123,45.798]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[23.095,53.697]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[22.887,53.87]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[22.947,54.133]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[21.901,52.972]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[23.008,54.187]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[21.948,53.035]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[22.212,52.98]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[20.848,52.199]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[14.598,50.099]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[15.137,50.117]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[16.127,50.405]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[17.122,51.203]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[18.196,51.306]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[19.213,51.591]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[20.161,51.659]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[24.409,56.055]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[24.279,55.69]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"Point","coordinates":[23.833,55.05]}},{"type":"Feature","properties":{"ref":"E671"},"geometry":{"type":"Point","coordinates":[21.886,47.05]}},{"type":"Feature","properties":{"ref":"E671"},"geometry":{"type":"Point","coordinates":[22.353,47.599]}},{"type":"Feature","properties":{"ref":"E671"},"geometry":{"type":"Point","coordinates":[21.351,46.21]}},{"type":"Feature","properties":{"ref":"E671"},"geometry":{"type":"Point","coordinates":[21.218,45.786]}},{"type":"Feature","properties":{"ref":"E673"},"geometry":{"type":"Point","coordinates":[22.511,45.914]}},{"type":"Feature","properties":{"ref":"E673"},"geometry":{"type":"Point","coordinates":[21.906,45.686]}},{"type":"Feature","properties":{"ref":"E68"},"geometry":{"type":"Point","coordinates":[25.595,45.66]}},{"type":"Feature","properties":{"ref":"E68"},"geometry":{"type":"Point","coordinates":[24.747,45.8]}},{"type":"Feature","properties":{"ref":"E68"},"geometry":{"type":"Point","coordinates":[23.945,45.788]}},{"type":"Feature","properties":{"ref":"E68"},"geometry":{"type":"Point","coordinates":[22.915,45.909]}},{"type":"Feature","properties":{"ref":"E68"},"geometry":{"type":"Point","coordinates":[22.365,46.014]}},{"type":"Feature","properties":{"ref":"E68"},"geometry":{"type":"Point","coordinates":[21.836,46.112]}},{"type":"Feature","properties":{"ref":"E68"},"geometry":{"type":"Point","coordinates":[20.888,46.209]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[21.287,45.133]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[20.764,44.974]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[19.994,44.908]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[19.466,45.031]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[22.792,44.616]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[23.693,44.429]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[22.24,45.369]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[24.305,44.116]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[18.833,45.05]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[17.764,45.151]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[16.973,45.32]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[15.75,45.821]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[13.835,45.7]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[12.786,45.784]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[11.946,45.42]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[10.871,45.414]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[9.96,45.069]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[14.099,45.761]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[14.557,46.013]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[3.51,45.861]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[4.052,45.856]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[5.174,45.626]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"Point","coordinates":[6.688,45.14]}},{"type":"Feature","properties":{"ref":"E71"},"geometry":{"type":"Point","coordinates":[21.272,48.645]}},{"type":"Feature","properties":{"ref":"E71"},"geometry":{"type":"Point","coordinates":[20.949,48.23]}},{"type":"Feature","properties":{"ref":"E71"},"geometry":{"type":"Point","coordinates":[20.895,47.964]}},{"type":"Feature","properties":{"ref":"E71"},"geometry":{"type":"Point","coordinates":[19.872,47.726]}},{"type":"Feature","properties":{"ref":"E71"},"geometry":{"type":"Point","coordinates":[18.964,47.408]}},{"type":"Feature","properties":{"ref":"E71"},"geometry":{"type":"Point","coordinates":[18.015,46.884]}},{"type":"Feature","properties":{"ref":"E71"},"geometry":{"type":"Point","coordinates":[17.76,46.794]}},{"type":"Feature","properties":{"ref":"E71"},"geometry":{"type":"Point","coordinates":[16.751,46.416]}},{"type":"Feature","properties":{"ref":"E71"},"geometry":{"type":"Point","coordinates":[16.201,45.873]}},{"type":"Feature","properties":{"ref":"E71"},"geometry":{"type":"Point","coordinates":[15.954,45.751]}},{"type":"Feature","properties":{"ref":"E71"},"geometry":{"type":"Point","coordinates":[15.303,44.807]}},{"type":"Feature","properties":{"ref":"E71"},"geometry":{"type":"Point","coordinates":[15.621,43.992]}},{"type":"Feature","properties":{"ref":"E71"},"geometry":{"type":"Point","coordinates":[16.066,43.683]}},{"type":"Feature","properties":{"ref":"E711"},"geometry":{"type":"Point","coordinates":[5.702,45.161]}},{"type":"Feature","properties":{"ref":"E712"},"geometry":{"type":"Point","coordinates":[5.751,44.52]}},{"type":"Feature","properties":{"ref":"E712"},"geometry":{"type":"Point","coordinates":[6.189,46.19]}},{"type":"Feature","properties":{"ref":"E712"},"geometry":{"type":"Point","coordinates":[6.113,45.931]}},{"type":"Feature","properties":{"ref":"E712"},"geometry":{"type":"Point","coordinates":[5.924,45.738]}},{"type":"Feature","properties":{"ref":"E712"},"geometry":{"type":"Point","coordinates":[5.375,43.306]}},{"type":"Feature","properties":{"ref":"E713"},"geometry":{"type":"Point","coordinates":[4.882,44.905]}},{"type":"Feature","properties":{"ref":"E713"},"geometry":{"type":"Point","coordinates":[5.121,45.032]}},{"type":"Feature","properties":{"ref":"E73"},"geometry":{"type":"Point","coordinates":[17.986,44.386]}},{"type":"Feature","properties":{"ref":"E73"},"geometry":{"type":"Point","coordinates":[18.083,44.134]}},{"type":"Feature","properties":{"ref":"E73"},"geometry":{"type":"Point","coordinates":[18.272,43.94]}},{"type":"Feature","properties":{"ref":"E73"},"geometry":{"type":"Point","coordinates":[17.481,43.153]}},{"type":"Feature","properties":{"ref":"E73"},"geometry":{"type":"Point","coordinates":[18.324,45.178]}},{"type":"Feature","properties":{"ref":"E73"},"geometry":{"type":"Point","coordinates":[18.651,46.157]}},{"type":"Feature","properties":{"ref":"E73"},"geometry":{"type":"Point","coordinates":[18.812,47.189]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[17.176,48.013]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[18.094,48.939]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[18.335,49.061]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[21.703,42.237]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[22.052,42.631]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[21.908,43.131]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[21.109,44.2]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[20.796,44.58]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[20.199,45.011]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[19.79,45.321]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[19.793,46.104]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[18.683,54.403]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[18.631,53.863]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[18.816,52.807]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[19.217,52.454]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[19.598,51.769]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[19.124,50.875]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[19.02,49.847]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[19.499,47.119]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[18.79,47.5]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"Point","coordinates":[17.737,47.659]}},{"type":"Feature","properties":{"ref":"E751"},"geometry":{"type":"Point","coordinates":[13.889,44.893]}},{"type":"Feature","properties":{"ref":"E751"},"geometry":{"type":"Point","coordinates":[13.886,45.163]}},{"type":"Feature","properties":{"ref":"E751"},"geometry":{"type":"Point","coordinates":[14.084,45.347]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[23.587,56.244]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[24.108,56.819]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[24.823,57.138]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[25.087,57.194]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[26.144,57.43]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[27.221,57.599]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[21.309,54.649]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[20.769,54.692]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[22.684,55.467]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[23.094,55.817]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[28.417,57.795]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[21.911,55.087]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[19.895,54.644]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[20.921,52.314]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[20.36,53.047]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[19.804,53.783]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[18.906,54.264]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[20.901,51.768]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[21.054,51.545]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[19.536,49.315]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[19.186,48.864]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[18.872,48.148]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[20.591,50.911]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"Point","coordinates":[19.303,47.506]}},{"type":"Feature","properties":{"ref":"E79"},"geometry":{"type":"Point","coordinates":[21.968,47.01]}},{"type":"Feature","properties":{"ref":"E79"},"geometry":{"type":"Point","coordinates":[23.759,44.345]}},{"type":"Feature","properties":{"ref":"E79"},"geometry":{"type":"Point","coordinates":[22.526,46.305]}},{"type":"Feature","properties":{"ref":"E79"},"geometry":{"type":"Point","coordinates":[23.271,45.042]}},{"type":"Feature","properties":{"ref":"E79"},"geometry":{"type":"Point","coordinates":[22.948,44.002]}},{"type":"Feature","properties":{"ref":"E79"},"geometry":{"type":"Point","coordinates":[22.909,45.884]}},{"type":"Feature","properties":{"ref":"E79"},"geometry":{"type":"Point","coordinates":[22.974,44.0]}},{"type":"Feature","properties":{"ref":"E79"},"geometry":{"type":"Point","coordinates":[21.987,46.982]}},{"type":"Feature","properties":{"ref":"E79"},"geometry":{"type":"Point","coordinates":[20.884,47.883]}},{"type":"Feature","properties":{"ref":"E81"},"geometry":{"type":"Point","coordinates":[23.426,46.813]}},{"type":"Feature","properties":{"ref":"E81"},"geometry":{"type":"Point","coordinates":[23.27,47.035]}},{"type":"Feature","properties":{"ref":"E81"},"geometry":{"type":"Point","coordinates":[24.838,44.897]}},{"type":"Feature","properties":{"ref":"E81"},"geometry":{"type":"Point","coordinates":[24.589,45.001]}},{"type":"Feature","properties":{"ref":"E81"},"geometry":{"type":"Point","coordinates":[22.883,47.729]}},{"type":"Feature","properties":{"ref":"E81"},"geometry":{"type":"Point","coordinates":[28.546,44.145]}},{"type":"Feature","properties":{"ref":"E81"},"geometry":{"type":"Point","coordinates":[27.782,44.412]}},{"type":"Feature","properties":{"ref":"E81"},"geometry":{"type":"Point","coordinates":[26.971,44.423]}},{"type":"Feature","properties":{"ref":"E81"},"geometry":{"type":"Point","coordinates":[22.689,48.436]}},{"type":"Feature","properties":{"ref":"E81"},"geometry":{"type":"Point","coordinates":[25.07,44.758]}},{"type":"Feature","properties":{"ref":"E81"},"geometry":{"type":"Point","coordinates":[23.729,45.916]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[25.313,54.605]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[24.788,54.779]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[23.988,54.932]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[23.781,55.107]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[22.75,55.431]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[21.963,55.63]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[25.26,53.872]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[24.313,51.827]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[24.278,52.097]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[25.218,52.634]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[25.651,49.567]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[25.401,50.746]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[26.015,48.3]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[26.061,47.988]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[25.823,48.353]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"Point","coordinates":[25.017,51.088]}}]};

// E-routes are added as a GeoJSON source+layer in initERoutes()


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

  // ── E-route shields — GeoJSON line source + symbol layer ─────────────────
  // Works exactly like regular road shields: placed along the line,
  // repeats at intervals, scales with zoom, rotates with road direction.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function initERoutes() {
      try {
        // Add GeoJSON source with all E-route LineStrings
        if (!map.getSource('eroutes')) {
          map.addSource('eroutes', { type: 'geojson', data: EROUTES_GEOJSON });
        }
        // Add shield layer — placed along the line, offset to sit beside road plate
        if (!map.getLayer('shield-euro')) {
          map.addLayer({
            id: 'shield-euro',
            type: 'symbol',
            source: 'eroutes',
            layout: {
              'icon-image': ['concat', 'shield-euro-', ['get', 'ref']],
              'icon-allow-overlap': false,
              'icon-rotation-alignment': 'viewport',
              'symbol-placement': 'line',
              'symbol-spacing': 320,  // match road shield spacing
              'icon-offset': [22, 0], // offset right in screen space (beside road plate)
              'text-field': '',
            },
            paint: { 'icon-opacity': 1 },
          });
        }
      } catch(_) {}
    }

    if (map.isStyleLoaded()) initERoutes();
    else map.once('idle', initERoutes);

    // Re-add after style reload (dark mode switch wipes sources)
    map.on('style.load', initERoutes);
    return () => map.off('style.load', initERoutes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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