/**
 * osrmServiceClient.js
 *
 * Routing client with three-tier fallback:
 *   1. Local OSRM server (localhost:5000) — set up via Android native service
 *   2. Public OSRM demo server (router.project-osrm.org) — online only
 *   3. Cached route from IndexedDB — offline fallback for pre-calculated routes
 *
 * Local OSRM setup: see android/app/src/main/java/com/spotfinder/app/OsrmService.java
 * The Android service starts osrm-routed on device boot/app launch and listens on :5000.
 */

import { saveRoute, getCachedRoute } from '@/lib/routeCache';

const LOCAL_OSRM_URL  = 'http://localhost:5000/route/v1';
// Profile-specific public OSRM servers.
// router.project-osrm.org only supports driving.
// routing.openstreetmap.de has separate backends per profile.
const PROFILE_SERVERS = {
  driving: [
    'https://router.project-osrm.org/route/v1/driving',
    'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  ],
  cycling: [
    'https://routing.openstreetmap.de/routed-bike/route/v1/cycling',
  ],
  foot: [
    'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  ],
};
const LOCAL_TIMEOUT_MS = 2000; // if local OSRM doesn't respond in 2s, skip it

// Check if user has Ultra subscription
function hasUltraSubscription() {
  // This is a simplified check - in a real app, this would check the user's subscription status
  // For now, we'll assume the user has Ultra if they're trying to use EV routing
  return true;
}

const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_KEY || import.meta.env.VITE_TOMTOM_API_KEY || '';

// ─── TomTom Routing API for Trucks ──────────────────────────────────────────

async function getTomTomRoute(from, to) {
  if (!TOMTOM_KEY) throw new Error('Missing TomTom API Key for truck routing');
  
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${from.lat},${from.lng}:${to.lat},${to.lng}/json?key=${TOMTOM_KEY}&travelMode=truck&vehicleCommercial=true&instructionsType=text&routeRepresentation=polyline`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TomTom API ${response.status}`);
  const data = await response.json();
  
  const route = data.routes?.[0];
  if (!route) throw new Error('No routes found from TomTom');

  const geometry = route.legs.flatMap(leg => leg.points.map(p => [p.latitude, p.longitude]));
  const distance = route.summary.lengthInMeters;
  const duration = route.summary.travelTimeInSeconds;
  
  const steps = (route.guidance?.instructions || []).map(instr => {
    return {
      _isTomTom: true,
      instruction: instr.message,
      maneuverType: 'turn',
      modifier: 'straight', // simplified
      type: mapTomTomInstruction(instr.maneuver),
      distance: instr.routeOffsetInMeters,
      lat: instr.point.latitude,
      lng: instr.point.longitude,
    };
  });

  return { geometry, distance, duration, steps };
}

function mapTomTomInstruction(maneuver) {
  if (!maneuver) return 'straight';
  if (maneuver.includes('LEFT')) return 'turn-left';
  if (maneuver.includes('RIGHT')) return 'turn-right';
  if (maneuver.includes('ROUNDABOUT')) return 'enter-roundabout';
  if (maneuver.includes('U_TURN')) return 'u-turn';
  if (maneuver.includes('ARRIVE')) return 'arrive';
  if (maneuver.includes('DEPART')) return 'depart';
  return 'straight';
}

// ─── Main exported function ───────────────────────────────────────────────────

export async function getOSRMRoute(from, to, profile = 'driving', options = {}) {
  if (profile === 'truck') {
    return await getTomTomRoute(from, to);
  }

  const osrmProfile = PROFILE_MAP[profile] || 'driving';
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const paramsBase = '?overview=full&steps=true&geometries=polyline&annotations=true';

  // NOTE: Public OSRM instances (router.project-osrm.org, routing.openstreetmap.de)
  // do NOT support custom params like `prefer=...` or `ev=true` and will respond 400.
  // We still accept these options at the UI level, but we must not send them to OSRM.
  const preference = options.preference || 'fastest';
  const vehicleType = options.vehicle_type || 'default';

  if (vehicleType === 'electric' && !hasUltraSubscription()) {
    throw new Error('EV routing requires SpotFinder Ultra subscription');
  }

  const params = paramsBase;

  // 1. Try local OSRM (running natively on Android)
  if (await isLocalOSRMAvailable()) {
    try {
      const url  = `${LOCAL_OSRM_URL}/${osrmProfile}/${coords}${params}`;
      const data = await fetchWithTimeout(url, LOCAL_TIMEOUT_MS);
      const route = normalizeOSRMResponse(data);
      saveRoute(from, to, profile, route).catch(() => {});
      return route;
    } catch (e) {
      console.warn('[OSRM] Local server error:', e.message);
    }
  }

  // 2. Try profile-specific remote OSRM servers
  // Each profile has its own backend — profile is already embedded in the base URL
  const servers = PROFILE_SERVERS[osrmProfile] || PROFILE_SERVERS.driving;
  for (const baseUrl of servers) {
    try {
      const url = `${baseUrl}/${coords}${params}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`OSRM ${response.status}`);
      const data  = await response.json();
      const route = normalizeOSRMResponse(data);
      saveRoute(from, to, profile, route).catch(() => {});
      return route;
    } catch (e) {
      // Provide extra context for debugging "OSRM 400" reports.
      console.warn(`[OSRM] ${baseUrl} failed:`, e.message, { osrmProfile, preference, vehicleType });
    }
  }

  // 3. Serve from route cache (offline / all servers down)
  const cached = await getCachedRoute(from, to, profile);
  if (cached) {
    console.info('[OSRM] Serving cached route');
    return cached;
  }

  // Give a specific, actionable error
  if (!navigator.onLine) {
    throw new Error('No internet connection and no cached route for this destination. Calculate the route while online first.');
  }
  throw new Error('Routing servers unavailable. Check your connection or try again in a moment.');
}

// ─── Local OSRM availability check ───────────────────────────────────────────

let _localAvailableCache = null;
let _localLastCheck      = 0;
const LOCAL_CHECK_TTL    = 10000; // re-check every 10s

async function isLocalOSRMAvailable() {
  const now = Date.now();
  if (now - _localLastCheck < LOCAL_CHECK_TTL) return _localAvailableCache;

  try {
    // Lightweight health check: just fetch the OSRM root, expect any 200
    await fetchWithTimeout('http://localhost:5000/', 1500);
    _localAvailableCache = true;
  } catch (_) {
    _localAvailableCache = false;
  }
  _localLastCheck = now;
  return _localAvailableCache;
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Profile mapping ──────────────────────────────────────────────────────────

const PROFILE_MAP = {
  'driving-car':     'driving',
  'cycling-regular': 'cycling',
  'foot-hiking':     'foot',
  'driving':         'driving',
  'cycling':         'cycling',
  'foot':            'foot',
};

// ─── Response normalizer ──────────────────────────────────────────────────────

function normalizeOSRMResponse(data) {
  const route = data.routes?.[0];
  if (!route) throw new Error('No routes found');

  return {
    geometry:  decodePolyline(route.geometry),
    distance:  route.distance,
    duration:  route.duration,
    steps:     extractStepsFromRoute(route),
  };
}

function extractStepsFromRoute(route) {
  return (route.legs?.[0]?.steps ?? [])
    .map(step => {
      const maneuver     = step.maneuver;
      const bearingBefore = maneuver.bearing_before ?? 0;
      const bearingAfter  = maneuver.bearing_after  ?? 0;
      const angleDiff     = bearingDiff(bearingBefore, bearingAfter);

      let modifier     = maneuver.modifier || 'straight';
      let maneuverType = maneuver.type     || 'turn';

      // Promote subtle OSRM steps to real turns when the angle demands it
      if (
        Math.abs(angleDiff) >= 25 &&
        (maneuverType === 'new name' ||
         maneuverType === 'notification' ||
         (maneuverType === 'continue' && modifier === 'straight'))
      ) {
        maneuverType = 'turn';
        modifier     = modifierFromAngle(angleDiff);
      }

      const normalizedStep = {
        maneuverType,
        modifier,
        bearingBefore,
        bearingAfter,
        angleDiff,
        distance:     step.distance,
        lat:          maneuver.location[1],
        lng:          maneuver.location[0],
        name:         step.name         || '',
        ref:          step.ref          || '',
        destinations: step.destinations || '',
        exits:        step.exits        || '',
        exit:         maneuver.exit     || null,
        intersections: step.intersections,
      };
      normalizedStep.instruction = buildInstruction(normalizedStep);
      return normalizedStep;
    })
    .filter(s => s.distance > 5);
}

// ─── Bearing helpers ──────────────────────────────────────────────────────────

function bearingDiff(before, after) {
  let diff = after - before;
  while (diff >  180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

function modifierFromAngle(diff) {
  const abs = Math.abs(diff);
  const dir = diff < 0 ? 'left' : 'right';
  if (abs < 15)  return 'straight';
  if (abs < 35)  return `slight ${dir}`;
  if (abs < 115) return dir;
  return `sharp ${dir}`;
}

export function mapOSRMModifier(modifier) {
  return {
    'sharp left':       'turn-left',
    'left':             'turn-left',
    'slight left':      'turn-left',
    'straight':         'straight',
    'slight right':     'turn-right',
    'right':            'turn-right',
    'sharp right':      'turn-right',
    'u-turn':           'u-turn',
    'roundabout left':  'enter-roundabout',
    'roundabout right': 'enter-roundabout',
    'exit roundabout':  'exit-roundabout',
    'use lane':         'straight',
  }[modifier] || 'straight';
}

// ─── Instruction builder ──────────────────────────────────────────────────────

function buildInstruction(step) {
  const { maneuverType, modifier, exit, name, ref, destinations, exits } = step;
  const roadLabel = buildRoadLabel(name, ref);
  const destLabel = buildDestLabel(destinations);
  const turnVerb  = buildTurnVerb(modifier);

  switch (maneuverType) {
    case 'depart':     return buildDepartInstruction(step, roadLabel, destLabel);
    case 'arrive':     return 'You have arrived at your destination';
    case 'turn':
    case 'new name':
    case 'end of road': return assembleTurn(turnVerb, roadLabel, destLabel);
    case 'continue':   return roadLabel ? `Continue on ${roadLabel}` : 'Continue straight';
    case 'merge':      return roadLabel ? `Merge onto ${roadLabel}${destLabel ? ` direction ${destLabel}` : ''}` : `Merge ${modifier || 'ahead'}`;
    case 'on ramp':    return assembleTurn(turnVerb, roadLabel, destLabel, 'ramp');
    case 'off ramp': {
      const exitStr = exits ? ` exit ${exits}` : '';
      return roadLabel ? `Take${exitStr} the exit onto ${roadLabel}${destLabel ? ` direction ${destLabel}` : ''}` : `Take${exitStr} the exit`;
    }
    case 'fork': return `Keep ${modifier?.includes('left') ? 'left' : 'right'} at the fork${destLabel ? ` toward ${destLabel}` : ''}`;
    case 'roundabout':
    case 'rotary': {
      const exitPhrase = exit ? `Take the ${ordinal(exit)} exit` : 'Take the exit';
      if (roadLabel) return `${exitPhrase} at the roundabout onto ${roadLabel}${destLabel ? ` direction ${destLabel}` : ''}`;
      if (destLabel) return `${exitPhrase} at the roundabout direction ${destLabel}`;
      return `${exitPhrase} at the roundabout`;
    }
    case 'roundabout turn':  return assembleTurn(turnVerb, roadLabel, destLabel);
    case 'exit roundabout':
    case 'exit rotary':      return roadLabel ? `Exit the roundabout onto ${roadLabel}${destLabel ? ` direction ${destLabel}` : ''}` : 'Exit the roundabout';
    default:                 return roadLabel ? `${turnVerb || 'Continue'} onto ${roadLabel}${destLabel ? ` direction ${destLabel}` : ''}` : turnVerb || 'Continue ahead';
  }
}

function assembleTurn(verb, roadLabel, destLabel, context = '') {
  let action = verb || 'Turn';
  if (context === 'ramp') action = `${action} to take the ramp`;
  const parts = [action];
  if (roadLabel) parts.push(`onto ${roadLabel}`);
  if (destLabel) parts.push(`direction ${destLabel}`);
  return parts.join(' ');
}

function buildDepartInstruction(step, roadLabel, destLabel) {
  const cardinal = bearingToCardinal(step.bearingAfter);
  const parts = [`Head ${cardinal}`];
  if (roadLabel) parts.push(`on ${roadLabel}`);
  if (destLabel) parts.push(`direction ${destLabel}`);
  return parts.join(' ');
}

function filterRef(ref) {
  if (!ref) return '';
  return ref.split(/[\s;,/]+/).map(p => p.trim()).filter(p => p && !/^E\d+$/i.test(p)).join(' ').trim();
}

function cleanName(name) {
  const s = (name || '').trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) return s.length <= 3 ? `Road ${s}` : '';
  return s;
}

function buildRoadLabel(name, ref) {
  const cleanRef  = filterRef(ref);
  const sanitised = cleanName(name);
  if (!cleanRef && !sanitised) return '';
  if (!sanitised) return cleanRef;
  if (!cleanRef)  return sanitised;
  if (sanitised === cleanRef) return cleanRef;
  return `${sanitised} (${cleanRef})`;
}

function buildDestLabel(destinations) {
  if (!destinations) return '';
  return destinations.split(/[;,]/).map(d => d.trim()).filter(Boolean).slice(0, 2).join(' / ');
}

function buildTurnVerb(modifier) {
  return {
    'sharp left':   'Turn sharp left',
    'left':         'Turn left',
    'slight left':  'Bear left',
    'straight':     'Continue straight',
    'slight right': 'Bear right',
    'right':        'Turn right',
    'sharp right':  'Turn sharp right',
    'u-turn':       'Make a U-turn',
  }[modifier] || 'Turn';
}

function bearingToCardinal(bearing) {
  return ['north','northeast','east','southeast','south','southwest','west','northwest'][Math.round(((bearing % 360) + 360) % 360 / 45) % 8];
}

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function decodePolyline(encoded) {
  const factor = 1e5;
  let index = 0, lat = 0, lng = 0;
  const coordinates = [];
  while (index < encoded.length) {
    let result = 0, shift = 0, byte;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0; shift = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}