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

const EROUTES_GEOJSON = {"type":"FeatureCollection","features":[{"type":"Feature","properties":{"ref":"E17"},"geometry":{"type":"LineString","coordinates":[[4.8839,47.0385],[4.1533,48.3915],[3.3333,49.7846],[4.1727,48.6593],[5.1895,47.482]]}},{"type":"Feature","properties":{"ref":"E21"},"geometry":{"type":"LineString","coordinates":[[6.2284,46.1817],[4.8265,46.8077],[5.6441,48.0996],[4.8258,46.8053]]}},{"type":"Feature","properties":{"ref":"E22"},"geometry":{"type":"LineString","coordinates":[[7.2273,53.1805],[5.6569,53.0222],[7.2047,53.1768],[13.5882,54.4844],[7.2274,53.1804],[8.7973,53.0227],[10.2799,53.6434],[11.8257,53.937],[13.3157,54.3668],[11.8674,53.9592],[10.3067,53.6714],[8.8475,53.025],[7.2853,53.1675]]}},{"type":"Feature","properties":{"ref":"E23"},"geometry":{"type":"LineString","coordinates":[[6.2661,47.6868],[6.1753,49.1971]]}},{"type":"Feature","properties":{"ref":"E232"},"geometry":{"type":"LineString","coordinates":[[6.5712,53.2047],[5.4414,52.2081]]}},{"type":"Feature","properties":{"ref":"E233"},"geometry":{"type":"LineString","coordinates":[[7.0641,52.7225],[8.7099,53.0064]]}},{"type":"Feature","properties":{"ref":"E25"},"geometry":{"type":"LineString","coordinates":[[5.6967,50.7552],[5.0441,52.0709],[5.7281,50.7764],[4.1984,51.9686],[7.6019,48.7698],[6.1781,49.3447],[7.5988,48.7693],[7.8344,45.524],[7.5608,47.5765],[6.1215,49.4725],[8.6626,44.6325],[6.2145,46.4006]]}},{"type":"Feature","properties":{"ref":"E251"},"geometry":{"type":"LineString","coordinates":[[13.2022,52.7048],[13.1204,54.2528]]}},{"type":"Feature","properties":{"ref":"E26"},"geometry":{"type":"LineString","coordinates":[[10.1669,53.5612],[11.7847,53.351],[13.2292,52.676],[11.7848,53.3512],[10.1712,53.5617]]}},{"type":"Feature","properties":{"ref":"E261"},"geometry":{"type":"LineString","coordinates":[[16.9723,51.0491],[17.4187,52.4813],[18.6091,53.459],[17.4127,52.4762]]}},{"type":"Feature","properties":{"ref":"E262"},"geometry":{"type":"LineString","coordinates":[[26.4639,55.9556],[28.3707,57.3366],[24.2833,55.0665],[25.8344,55.5935],[24.2473,55.0508],[25.6087,55.4825],[27.3542,56.5447],[24.3171,55.0845],[26.898,56.172],[25.6082,55.4827]]}},{"type":"Feature","properties":{"ref":"E27"},"geometry":{"type":"LineString","coordinates":[[7.1372,46.0781],[6.9833,47.4954],[7.3852,45.7391],[6.8616,47.5842],[7.1355,46.0781]]}},{"type":"Feature","properties":{"ref":"E272"},"geometry":{"type":"LineString","coordinates":[[22.2762,56.0055],[24.3357,55.6734],[22.3147,56.0046],[24.2676,55.7342],[21.1853,55.7311],[23.2792,55.9439],[21.878,55.9372]]}},{"type":"Feature","properties":{"ref":"E28"},"geometry":{"type":"LineString","coordinates":[[16.8353,54.4088],[15.3691,53.8733],[16.8302,54.4066],[18.4902,54.4564],[23.3632,54.5552],[20.5272,54.6446],[14.4186,53.3372],[25.6686,54.5551],[27.174,53.9223],[13.5633,52.6212],[24.0159,54.6056],[25.7246,54.5355],[21.3929,54.643],[23.0063,54.6369],[21.3088,54.6492],[25.7132,54.5408],[24.2891,54.5787],[27.4092,53.9113],[20.2269,54.5111],[24.934,54.633],[20.0599,54.4177],[23.3286,54.564],[17.6762,54.514]]}},{"type":"Feature","properties":{"ref":"E29"},"geometry":{"type":"LineString","coordinates":[[7.0312,49.0459],[6.6772,50.454]]}},{"type":"Feature","properties":{"ref":"E30"},"geometry":{"type":"LineString","coordinates":[[30.9926,54.6909],[29.3941,54.3907],[27.8926,53.8553],[26.3794,53.3028],[24.9848,52.4971],[26.3783,53.3021],[27.89,53.8538],[29.3942,54.3906],[30.9891,54.6908],[23.6561,52.0729],[7.0434,52.3137],[5.432,52.1739],[2.916,51.9485],[1.3219,51.9247],[4.2958,52.0112],[5.9091,52.1829],[4.2393,51.989],[8.2575,52.2156],[18.6221,52.1382],[17.0173,52.344],[15.3985,52.3191],[17.0146,52.3442],[18.6201,52.1384],[10.9661,52.2685],[9.3932,52.3254],[14.5777,52.3156],[12.9359,52.2946],[14.5222,52.3188],[18.6215,52.1382],[20.1842,52.0679],[18.6268,52.1371],[23.1039,52.0485],[21.0191,52.1396],[23.6153,52.0591],[21.64,52.2157]]}},{"type":"Feature","properties":{"ref":"E31"},"geometry":{"type":"LineString","coordinates":[[8.5551,49.3332],[7.3816,50.3819],[6.3878,51.5858],[7.371,50.3895],[8.549,49.3326],[6.0346,51.6748]]}},{"type":"Feature","properties":{"ref":"E312"},"geometry":{"type":"LineString","coordinates":[[5.4092,51.484],[3.8113,51.4836]]}},{"type":"Feature","properties":{"ref":"E331"},"geometry":{"type":"LineString","coordinates":[[10.1122,51.0145],[8.6272,51.59],[10.1107,51.0132]]}},{"type":"Feature","properties":{"ref":"E34"},"geometry":{"type":"LineString","coordinates":[[6.2163,51.384],[7.8039,51.6209],[6.2653,51.3871],[8.8465,52.2069],[7.3932,51.5839],[5.9455,51.3778],[4.4027,51.1923]]}},{"type":"Feature","properties":{"ref":"E35"},"geometry":{"type":"LineString","coordinates":[[6.1657,51.8987],[8.2457,47.0998],[7.7157,50.5061],[6.1629,51.9011],[7.6022,47.5861],[8.6341,49.4145],[11.2617,44.4819],[9.9394,44.9482]]}},{"type":"Feature","properties":{"ref":"E36"},"geometry":{"type":"LineString","coordinates":[[13.5545,52.3187],[14.8979,51.6218],[13.5551,52.3153]]}},{"type":"Feature","properties":{"ref":"E37"},"geometry":{"type":"LineString","coordinates":[[8.6995,53.0051],[7.5461,51.9587],[8.6919,53.004]]}},{"type":"Feature","properties":{"ref":"E371"},"geometry":{"type":"LineString","coordinates":[[21.3983,50.8023],[21.2553,48.9488],[21.202,51.3622],[21.9757,50.1084],[21.081,51.5326],[21.9416,50.1683],[21.1802,51.3823],[21.847,49.6708]]}},{"type":"Feature","properties":{"ref":"E372"},"geometry":{"type":"LineString","coordinates":[[23.9813,50.0687],[22.9452,51.0991],[23.992,50.0519],[22.8573,51.1378],[24.0628,49.878],[22.857,51.1465],[21.521,52.0145],[22.8577,51.1466],[21.2502,52.2224],[22.5577,51.3002]]}},{"type":"Feature","properties":{"ref":"E373"},"geometry":{"type":"LineString","coordinates":[[23.4719,51.1433],[30.362,50.5157],[23.5022,51.143],[26.6221,51.3167],[24.979,51.2167],[29.9178,50.6404],[26.6235,51.3172],[28.2739,51.0772],[29.8693,50.661],[23.4711,51.1434],[26.6231,51.3169]]}},{"type":"Feature","properties":{"ref":"E40"},"geometry":{"type":"LineString","coordinates":[[15.0087,51.1808],[13.3978,51.0588],[14.9951,51.1851],[5.7981,50.6342],[2.5624,51.057],[4.1531,50.8843],[5.7457,50.6359],[4.1258,50.8908],[36.0873,49.9572],[37.2806,49.1548],[38.6366,48.4055],[37.152,49.4585],[31.0178,50.3226],[32.6228,50.1451],[34.115,49.5815],[32.617,50.1464],[30.9737,50.339],[29.3487,50.363],[27.769,50.5667],[26.1501,50.5862],[24.6791,49.985],[34.4904,49.5627],[39.9103,48.2913],[38.4969,48.3616],[33.0726,49.9574],[24.1608,49.9201],[25.6165,50.2968],[37.4813,48.9666],[26.1529,50.585],[30.4962,50.3509],[28.8949,50.288],[30.5241,50.341],[23.1211,49.9564],[38.0728,48.603],[36.4353,49.9369],[26.3408,50.6069],[27.9631,50.5043],[34.542,49.5557],[26.2046,50.5621],[34.8804,49.6215],[24.4506,49.9769],[25.7906,50.4462],[38.913,48.4947],[15.0087,51.1807],[16.5845,51.0457],[18.0909,50.4783],[19.642,50.0928],[21.2441,50.1011],[22.8248,49.9102],[19.3895,50.1523],[17.8412,50.5779],[16.3377,51.1284],[19.3912,50.1524],[23.1149,49.9566],[21.5332,50.0983],[19.9157,49.9923],[10.0975,51.0062],[11.695,50.8761],[10.102,51.0089],[8.1277,50.7859],[6.5575,50.8568],[7.9616,50.8733],[10.0974,51.0063],[8.5403,50.5802]]}},{"type":"Feature","properties":{"ref":"E41"},"geometry":{"type":"LineString","coordinates":[[8.6203,46.9542],[7.3675,51.5861],[8.5668,50.5487],[9.5628,49.498],[8.6056,48.2002],[7.3669,51.5863],[8.5661,50.5493],[9.5626,49.4977],[8.6055,48.2003]]}},{"type":"Feature","properties":{"ref":"E411"},"geometry":{"type":"LineString","coordinates":[[5.8069,49.5502],[4.6458,50.6631],[5.8143,49.5776]]}},{"type":"Feature","properties":{"ref":"E42"},"geometry":{"type":"LineString","coordinates":[[7.1635,49.8539],[9.0209,49.9907],[7.4215,49.9585],[9.0195,49.9911],[7.1638,49.8541],[5.8122,50.6347],[4.1938,50.5011],[5.8045,50.6344]]}},{"type":"Feature","properties":{"ref":"E43"},"geometry":{"type":"LineString","coordinates":[[9.649,47.4519],[10.1749,48.8683],[9.649,47.4519],[10.1734,48.8694]]}},{"type":"Feature","properties":{"ref":"E44"},"geometry":{"type":"LineString","coordinates":[[5.8421,49.5536],[8.6518,50.6077],[7.0784,50.2381],[8.5999,50.5652],[7.0305,50.2378],[5.749,49.5177],[4.0709,49.9385],[5.7517,49.5183],[3.2693,49.8495],[5.7145,49.5099],[4.0954,49.905],[2.5126,49.854],[0.9104,49.6598],[2.5183,49.8539],[5.1487,49.6461]]}},{"type":"Feature","properties":{"ref":"E442"},"geometry":{"type":"LineString","coordinates":[[13.7703,50.546],[16.1994,49.9093],[17.694,49.5468],[14.0879,50.6648],[16.0618,49.9691],[17.6751,49.5457],[13.234,50.4032],[15.7198,50.2868],[17.9288,49.5091],[15.2434,50.5258],[18.2527,49.4371],[13.2346,50.4032],[15.3351,50.444],[17.7154,49.5523],[12.8827,50.2384]]}},{"type":"Feature","properties":{"ref":"E45"},"geometry":{"type":"LineString","coordinates":[[10.0155,53.3747],[10.0144,51.7594],[10.0266,53.3714],[9.3284,54.8058],[10.074,56.1968],[11.6331,57.6013],[10.093,57.1404],[9.6439,55.7711],[11.5075,47.0033],[11.5249,48.6285],[10.5466,49.7627],[9.5463,50.7956],[11.4229,48.9604],[9.5421,50.8131],[10.5225,49.7637],[11.5111,48.6624],[9.9337,53.5297],[11.5072,47.0032],[10.8977,45.6684],[11.501,46.995]]}},{"type":"Feature","properties":{"ref":"E46"},"geometry":{"type":"LineString","coordinates":[[5.0631,49.7623],[3.7013,49.3082],[-1.5974,49.5993],[-0.0769,49.2293],[-1.5694,49.6533],[1.1094,49.3677],[2.7379,49.4025],[5.0631,49.7624],[3.077,49.3963]]}},{"type":"Feature","properties":{"ref":"E462"},"geometry":{"type":"LineString","coordinates":[[16.6028,49.1596],[19.0249,50.1296]]}},{"type":"Feature","properties":{"ref":"E47"},"geometry":{"type":"LineString","coordinates":[[11.3508,54.6543],[12.4552,55.7204],[10.6019,53.8538],[12.5637,56.0193],[11.3516,54.655],[12.4557,55.7222]]}},{"type":"Feature","properties":{"ref":"E471"},"geometry":{"type":"LineString","coordinates":[[22.7085,48.4582],[23.9482,49.4316],[22.7157,48.46]]}},{"type":"Feature","properties":{"ref":"E48"},"geometry":{"type":"LineString","coordinates":[[13.5294,50.1582],[10.0821,50.0008],[11.686,50.0318],[13.6581,50.1675]]}},{"type":"Feature","properties":{"ref":"E49"},"geometry":{"type":"LineString","coordinates":[[13.3477,49.7754],[11.5454,52.1687],[11.8203,50.6675],[11.5436,52.1512],[11.8084,50.5512],[13.3466,49.7762],[14.76,49.0091],[16.4079,48.1871],[14.941,48.8367],[16.3996,48.2423],[14.4524,49.004]]}},{"type":"Feature","properties":{"ref":"E50"},"geometry":{"type":"LineString","coordinates":[[12.522,49.6425],[10.9601,49.3051],[9.3519,49.1601],[7.8598,49.4612],[9.3505,49.16],[10.9604,49.305],[12.5197,49.6414],[21.9254,48.745],[17.8965,48.9518],[19.4739,49.088],[21.0842,49.0003],[19.4824,49.09],[18.0824,48.927],[12.5221,49.6424],[14.0715,49.9582],[15.557,49.4786],[14.0737,49.9588],[12.5253,49.6436],[17.8965,48.9518],[6.9577,49.2037],[5.3543,49.1094],[3.7709,49.2058],[2.2464,48.7006],[0.7181,48.1584],[-0.8925,48.0827],[-2.4424,48.4187],[-4.0425,48.5184],[-2.4427,48.4187],[-0.8924,48.0826],[0.7143,48.1565],[2.2369,48.6963],[3.7667,49.2035],[5.3493,49.1086],[6.9489,49.202],[24.611,49.3978],[35.6951,48.5649],[26.8867,49.4022],[22.7157,48.46],[30.9608,48.6454],[22.4443,48.5417],[23.8351,49.2363],[33.7446,48.421],[26.8872,49.402],[28.848,48.9499],[27.3504,49.3887],[23.0939,48.7552],[38.0313,48.2173],[33.7527,48.4159],[35.322,48.5893],[37.2011,48.258],[35.689,48.5662],[38.1545,48.2347],[39.7564,47.8467],[28.8211,48.977],[39.2555,48.0195],[22.333,48.5798],[39.3293,47.991],[37.0796,48.3047],[34.947,48.4331],[28.7011,49.1086],[25.6085,49.5297],[28.0211,49.3601],[25.5393,49.5455],[24.0982,49.3837],[28.5706,49.2578],[29.9189,48.7909],[31.333,48.5706],[35.8568,48.5263],[37.2204,48.194],[39.6139,47.8782]]}},{"type":"Feature","properties":{"ref":"E51"},"geometry":{"type":"LineString","coordinates":[[11.2346,49.4485],[11.843,50.9018],[12.7648,52.1437],[11.7901,50.3289],[12.302,51.8152],[11.7985,50.3163]]}},{"type":"Feature","properties":{"ref":"E52"},"geometry":{"type":"LineString","coordinates":[[13.0015,47.7613],[8.522,48.9373],[12.1519,47.805],[8.5221,48.9374],[10.0416,48.4541]]}},{"type":"Feature","properties":{"ref":"E53"},"geometry":{"type":"LineString","coordinates":[[13.3085,49.3815],[11.5423,48.232],[12.9781,48.9437],[11.5327,48.2487],[12.9821,49.0133]]}},{"type":"Feature","properties":{"ref":"E54"},"geometry":{"type":"LineString","coordinates":[[8.4568,47.6765],[9.9903,47.8119],[11.5338,48.1106],[8.7445,47.738],[10.2073,47.9986],[7.7867,47.5898],[2.4118,48.8145],[5.3261,47.8717],[2.4646,48.7898],[5.2891,47.9367],[2.3931,48.8221],[3.8601,48.2731],[5.289,47.9368],[3.7092,48.2695],[6.1678,47.6296]]}},{"type":"Feature","properties":{"ref":"E55"},"geometry":{"type":"LineString","coordinates":[[13.8985,50.7831],[13.5941,52.2306],[12.457,53.186],[13.7641,52.4748],[12.4556,53.1978],[13.5553,52.3125],[12.1023,54.1418],[13.5551,52.3118],[13.8937,50.9047],[12.6915,56.0433],[11.918,54.7051],[12.5632,56.0192],[14.6605,49.5667],[13.8984,50.783],[14.6606,49.5666],[14.2653,48.2059],[13.6096,46.9415],[14.5049,48.5255],[13.1058,47.8524],[13.6414,46.5343],[12.4098,45.6139],[13.5031,46.5028],[12.191,45.4343],[12.5715,44.0338],[13.8417,43.0883],[14.953,42.0091],[16.321,41.2505],[17.8303,40.6859],[16.3157,41.2511],[14.9504,42.0097],[13.843,43.0871],[12.5723,44.0333],[17.9646,40.6408],[12.165,44.4338]]}},{"type":"Feature","properties":{"ref":"E56"},"geometry":{"type":"LineString","coordinates":[[14.0378,48.0631],[12.7316,48.9217]]}},{"type":"Feature","properties":{"ref":"E57"},"geometry":{"type":"LineString","coordinates":[[15.6451,46.6908],[14.3442,47.5236]]}},{"type":"Feature","properties":{"ref":"E571"},"geometry":{"type":"LineString","coordinates":[[21.2753,48.7245],[19.7886,48.3608],[21.1791,48.6291],[19.6316,48.3842],[18.1294,48.3015]]}},{"type":"Feature","properties":{"ref":"E573"},"geometry":{"type":"LineString","coordinates":[[22.307,48.5788],[21.2696,47.3754]]}},{"type":"Feature","properties":{"ref":"E574"},"geometry":{"type":"LineString","coordinates":[[25.4973,45.6355],[24.3563,44.4321],[25.7109,45.7136],[26.9172,46.5396],[24.8797,44.9288],[26.1436,45.9985],[24.9001,44.9607],[26.1191,45.9936],[24.8738,44.8195],[26.8687,46.5489],[24.1529,44.3516],[25.6906,45.7011],[26.885,46.5564],[24.8994,44.9603],[26.7688,46.2591]]}},{"type":"Feature","properties":{"ref":"E578"},"geometry":{"type":"LineString","coordinates":[[25.8395,46.3131],[24.481,46.9317],[25.8008,45.869],[24.6637,46.7602]]}},{"type":"Feature","properties":{"ref":"E58"},"geometry":{"type":"LineString","coordinates":[[25.5065,47.5357],[31.9959,47.0158],[26.6758,47.7236],[24.4897,47.1311],[36.6593,46.804],[26.6669,47.7408],[23.5188,47.6532],[26.6685,47.7382],[35.3322,46.8284],[37.5121,47.0994],[32.2417,46.8287],[27.5124,47.1728],[25.5061,47.5355],[23.5222,47.642],[37.8501,47.1085],[22.6479,48.211],[26.1981,47.6498],[32.1304,46.9931],[26.8999,47.4278],[28.601,47.1543],[30.1963,46.64],[27.5124,47.1729],[23.5224,47.642],[35.2964,46.8268],[32.7947,46.6146],[34.1877,46.7877],[37.3132,47.056],[26.2797,47.6721],[32.1316,46.9924],[26.6684,47.738],[31.8884,46.9821],[25.512,47.5353],[28.741,47.0685],[30.6248,46.5224],[26.2262,47.6496],[24.4899,47.131],[23.1213,47.8633],[27.5325,47.2397],[24.5171,47.15],[28.8565,47.1117],[30.7847,46.5825],[32.5207,46.6922],[27.5748,47.1586],[35.2963,46.8264],[17.0728,48.0711],[21.9254,48.745],[20.3819,48.5194],[18.8687,48.5834],[17.3314,48.2176],[19.2389,48.5668],[17.6697,48.2968]]}},{"type":"Feature","properties":{"ref":"E59"},"geometry":{"type":"LineString","coordinates":[[16.0485,48.7188],[16.0417,47.2733],[15.8475,45.7917],[16.0469,48.8602]]}},{"type":"Feature","properties":{"ref":"E60"},"geometry":{"type":"LineString","coordinates":[[9.6451,47.4594],[11.6734,47.3263],[10.0772,47.1302],[11.6371,47.313],[10.0073,47.1248],[14.4689,48.2031],[12.9274,47.7676],[14.4299,48.2099],[21.7917,47.1191],[20.2661,47.2148],[18.6953,47.5081],[17.1661,47.901],[20.4523,47.1891],[17.1109,47.9245],[18.6418,47.5109],[20.2022,47.2266],[1.8402,48.0358],[3.4265,47.8845],[4.8122,47.0585],[6.3844,47.3745],[4.8122,47.0586],[3.4254,47.8851],[7.5656,47.574],[9.1426,47.4526],[7.5667,47.5735],[25.5818,45.7491],[23.2783,46.797],[28.6092,44.108],[21.9917,47.0318],[28.5947,44.1733],[26.1877,44.5129],[28.614,44.1571],[25.6561,45.6296],[22.4166,47.0533],[26.0465,44.8848],[21.8864,47.05],[25.9404,44.9779],[28.5982,44.2208],[25.9645,44.9638],[21.8887,47.0826],[28.6243,44.1449],[25.9919,44.9109],[28.6177,44.1316],[26.1399,44.5362],[25.5241,45.9028],[21.9966,47.0366],[24.5177,46.5113],[26.2521,44.5258],[23.1755,46.8174],[25.5835,45.6932],[28.597,44.1658],[26.0766,44.6678],[28.4765,44.3479],[26.1758,44.5203],[21.902,47.0688],[26.1403,44.5362],[23.1433,46.8269],[28.5963,44.1793],[26.0765,44.6679],[28.6399,44.0825],[27.076,44.5882],[24.7722,46.2241],[21.7913,47.1186],[28.6059,44.1986],[24.5155,46.5138],[26.084,44.5378],[21.8554,47.0994],[28.6208,44.138],[22.3734,47.0588],[26.2697,44.5214],[14.4687,48.203],[16.0464,48.0813]]}},{"type":"Feature","properties":{"ref":"E62"},"geometry":{"type":"LineString","coordinates":[[7.7517,46.3064],[6.3243,46.461],[4.8341,46.2711],[8.9021,44.4102],[8.1516,46.1965]]}},{"type":"Feature","properties":{"ref":"E64"},"geometry":{"type":"LineString","coordinates":[[10.2384,45.5049],[8.6415,45.469],[10.2254,45.5071]]}},{"type":"Feature","properties":{"ref":"E65"},"geometry":{"type":"LineString","coordinates":[[17.529,42.9538],[16.1471,43.6781],[15.1688,44.9188],[16.0737,43.6824],[14.7868,45.1283],[16.7009,46.412],[15.4241,45.4755],[17.6535,42.8875],[15.0736,44.9669],[16.2753,45.9137],[13.0775,55.5603],[14.2569,53.8997],[13.8352,55.2595],[16.701,46.4119],[17.1689,47.9339],[16.4012,49.2204],[14.8953,49.8065],[16.2256,49.2755],[15.3105,50.7419],[17.1757,48.013],[15.5481,51.9386],[14.71,53.1565],[15.5478,51.9421],[14.2738,53.9013],[15.4255,50.8063],[14.7746,53.7401],[15.8,50.9067],[14.2562,53.8979]]}},{"type":"Feature","properties":{"ref":"E66"},"geometry":{"type":"LineString","coordinates":[[19.8007,47.1817],[18.3341,47.2068],[16.8658,47.0902],[15.2876,46.9812],[13.7644,46.6479],[17.1324,47.1168],[15.4922,47.0214],[14.0142,46.6214],[12.5411,46.7596]]}},{"type":"Feature","properties":{"ref":"E661"},"geometry":{"type":"LineString","coordinates":[[17.3972,44.1438],[17.2228,45.5879]]}},{"type":"Feature","properties":{"ref":"E67"},"geometry":{"type":"LineString","coordinates":[[23.0945,53.6966],[20.8484,52.1992],[22.2579,53.0011],[20.9773,52.2791],[22.104,53.2481],[14.5979,50.0987],[16.1271,50.405],[17.3919,51.2334],[18.9436,51.5749],[20.3586,51.8429],[16.1975,50.4297],[17.3889,51.2327],[18.9416,51.575],[20.359,51.8429],[24.4093,56.055],[23.7841,54.7846]]}},{"type":"Feature","properties":{"ref":"E671"},"geometry":{"type":"LineString","coordinates":[[21.8863,47.0496],[21.2178,45.7864],[22.8411,47.7839],[21.2179,45.7869],[21.8943,47.1034],[21.2236,45.7692],[21.9191,47.0827],[21.2252,45.7663],[21.902,47.042],[21.1885,45.8296],[21.9188,47.083],[21.1941,45.8116]]}},{"type":"Feature","properties":{"ref":"E68"},"geometry":{"type":"LineString","coordinates":[[25.5953,45.66],[23.9449,45.7885],[22.365,46.0137],[20.8881,46.2094]]}},{"type":"Feature","properties":{"ref":"E70"},"geometry":{"type":"LineString","coordinates":[[21.2871,45.1325],[19.7323,44.9792],[21.2886,45.1282],[19.8542,44.9476],[22.792,44.6156],[21.2279,45.7598],[23.6933,44.4294],[21.1861,45.7055],[23.8401,44.336],[21.2258,45.7633],[24.3049,44.1156],[22.6911,44.625],[21.1685,45.6833],[23.9061,44.2608],[22.2402,45.3678],[23.8319,44.2991],[21.2621,45.7664],[22.4114,44.7402],[21.216,45.7522],[23.8377,44.3135],[21.8708,45.7274],[23.0343,44.5897],[21.1711,45.6728],[22.4111,44.7403],[21.203,45.726],[19.1034,45.0478],[17.5001,45.2197],[16.0127,45.7503],[17.4967,45.2206],[19.0997,45.048],[13.8355,45.6997],[12.2713,45.592],[13.8315,45.6989],[12.2806,45.5903],[13.8354,45.7001],[11.9457,45.4198],[10.3341,45.4797],[11.9165,45.4303],[13.8355,45.6997],[15.3497,45.9064],[13.8376,45.701],[3.51,45.861],[4.9038,45.6432],[6.6876,45.1401]]}},{"type":"Feature","properties":{"ref":"E71"},"geometry":{"type":"LineString","coordinates":[[21.272,48.645],[20.1429,47.7066],[18.7189,47.2873],[17.2527,46.6044],[15.9536,45.7509],[15.4404,44.1966],[15.8105,45.688],[17.0958,46.4851],[18.5274,47.203],[19.9755,47.7286],[21.2227,48.5041],[15.8894,45.7538],[21.2689,48.6455]]}},{"type":"Feature","properties":{"ref":"E712"},"geometry":{"type":"LineString","coordinates":[[5.7509,44.5205],[6.1889,46.1903],[5.693,44.6803],[5.3754,43.3065],[5.6089,44.8278]]}},{"type":"Feature","properties":{"ref":"E73"},"geometry":{"type":"LineString","coordinates":[[17.9861,44.386],[18.5587,45.9031],[18.8656,47.2971]]}},{"type":"Feature","properties":{"ref":"E75"},"geometry":{"type":"LineString","coordinates":[[17.1757,48.013],[18.3352,49.0608],[17.1176,48.0738],[18.7991,49.437],[21.7034,42.237],[21.4353,43.7694],[20.2933,44.7569],[19.7934,46.1037],[20.2952,44.7557],[21.4357,43.7674],[18.6835,54.4025],[18.8158,52.8075],[19.608,51.4983],[19.1453,50.1574],[18.5936,54.2743],[19.1538,50.1636],[19.5928,51.5818],[18.778,52.853],[18.6253,49.7644],[18.6378,54.2739],[18.8585,52.7412],[18.6298,54.235],[18.9646,52.6213],[18.6521,54.1734],[19.9791,46.1759],[19.0339,47.3796],[17.4725,47.7153],[19.0341,47.3794],[19.9799,46.1768],[18.766,49.4953]]}},{"type":"Feature","properties":{"ref":"E77"},"geometry":{"type":"LineString","coordinates":[[23.5873,56.2442],[24.8227,57.1381],[26.418,57.4644],[21.3088,54.6492],[22.684,55.4674],[20.2064,54.7003],[24.8631,57.1466],[28.4167,57.7949],[23.6232,56.2589],[21.911,55.0874],[23.8661,56.7341],[28.4159,57.795],[24.8449,57.1428],[27.3803,57.6433],[20.5553,54.7678],[22.3073,55.265],[23.7545,56.6297],[19.8948,54.6439],[20.9212,52.3144],[20.0366,53.6448],[18.6376,54.3006],[20.0384,53.6435],[20.9289,52.308],[19.5361,49.3147],[21.0746,51.5351],[20.04,50.3196],[21.0156,51.3442],[19.3034,47.5061]]}},{"type":"Feature","properties":{"ref":"E79"},"geometry":{"type":"LineString","coordinates":[[21.9677,47.0104],[23.7594,44.3448],[21.902,47.0688],[23.2708,45.0421],[21.902,47.0688],[22.9087,45.8837],[23.6931,44.4295],[22.3588,46.6653],[23.7997,44.2866],[21.9866,46.9824],[22.9087,45.8839],[23.7941,44.3212],[22.9551,45.8559],[21.8887,47.0823],[23.3883,45.264],[21.7917,47.1191]]}},{"type":"Feature","properties":{"ref":"E81"},"geometry":{"type":"LineString","coordinates":[[23.4258,46.8133],[24.8379,44.8969],[22.8827,47.7294],[24.3642,45.1321],[23.0719,47.1681],[24.2829,45.5113],[22.9016,47.799],[28.5464,44.1447],[26.9706,44.4229],[28.5352,44.1435],[24.3693,45.1216],[22.8838,47.7893],[24.3643,45.1319],[25.8241,44.4671],[22.8852,47.7893],[26.0665,44.4368],[23.0554,47.2007],[24.8377,44.8971],[22.8836,47.7775],[23.6147,46.1135],[22.6479,48.211],[23.4254,46.8129],[24.3646,45.1321],[23.0619,47.1888]]}},{"type":"Feature","properties":{"ref":"E85"},"geometry":{"type":"LineString","coordinates":[[25.3131,54.6054],[23.7809,55.107],[22.2245,55.559],[23.7879,55.1033],[25.3756,54.2765],[24.3127,51.8266],[25.4684,52.7361],[24.3001,51.8288],[25.3325,53.0826],[25.6508,49.5666],[24.3215,51.8212],[26.0612,47.988],[25.6085,49.5297],[26.0593,47.9901],[25.742,50.4276],[25.8225,48.3541],[25.7622,50.4075],[26.0115,48.0436],[25.6158,49.4952],[25.0172,51.0876]]}}]};

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
        // Add shield layer using same styleimagemissing mechanism as road shields
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
              'symbol-spacing': 300,
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