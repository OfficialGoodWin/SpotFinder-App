/**
 * OSRM (Open Source Routing Machine) Client
 * Stable, fast routing service. No API key needed.
 * Usage: const routeData = await getOSRMRoute(from, to, profile);
 */

const BASE_URL = 'https://router.project-osrm.org/route/v1';

export async function getOSRMRoute(from, to, profile = 'driving') {
  const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const osrmProfiles = {
    'driving-car': 'driving',
    'cycling-regular': 'cycling',
    'foot-hiking': 'foot'
  };
  const osrmProfile = osrmProfiles[profile] || 'driving';
  const url = `${BASE_URL}/${osrmProfile}/${coordinates}?overview=full&steps=true&geometries=polyline&annotations=true`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OSRM API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return normalizeOSRMResponse(data);
  } catch (err) {
    console.error('OSRM API error:', err);
    throw err;
  }
}

function normalizeOSRMResponse(osrmResponse) {
  const route = osrmResponse.routes[0];
  if (!route) throw new Error('No routes found');

  const geometry = decodePolyline(route.geometry);
  const rawSteps = extractStepsFromRoute(route);
  
  return {
    geometry,
    distance: route.distance,
    duration: route.duration,
    steps: rawSteps
  };
}

function extractStepsFromRoute(route) {
  const steps = route.legs[0].steps
    .map(step => {
      const maneuver = step.maneuver;
      const bearingBefore = maneuver.bearing_before ?? 0;
      const bearingAfter  = maneuver.bearing_after  ?? 0;
      const angleDiff     = bearingDiff(bearingBefore, bearingAfter);

      // If OSRM calls this a continuation/name-change but the road actually
      // bends significantly, promote it to a real turn instruction.
      let modifier     = maneuver.modifier || 'straight';
      let maneuverType = maneuver.type     || 'turn';

      const FORCE_TURN_THRESHOLD = 25; // degrees — sharper than this = real turn
      if (
        Math.abs(angleDiff) >= FORCE_TURN_THRESHOLD &&
        (maneuverType === 'new name'     ||
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
        distance: step.distance,
        lat: maneuver.location[1],
        lng: maneuver.location[0],
        name:         step.name         || '',
        ref:          step.ref          || '',   // e.g. "D5", "E50 D5"
        destinations: step.destinations || '',   // e.g. "Praha;Plzeň"
        exits:        step.exits        || '',
        exit:         maneuver.exit     || null, // roundabout exit number
        intersections: step.intersections,
      };

      // Build the human-readable instruction from all available data
      normalizedStep.instruction = buildInstruction(normalizedStep);

      return normalizedStep;
    })
    .filter(step => step.distance > 5);

  return steps;
}

// ─── Bearing helpers ─────────────────────────────────────────────────────────

/** Signed angle difference in degrees: negative = left, positive = right */
function bearingDiff(before, after) {
  let diff = after - before;
  while (diff >  180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

/** Map a signed angle to an OSRM-style modifier string */
function modifierFromAngle(diff) {
  const abs = Math.abs(diff);
  const dir = diff < 0 ? 'left' : 'right';
  if (abs < 15)  return 'straight';
  if (abs < 35)  return `slight ${dir}`;
  if (abs < 115) return dir;
  return `sharp ${dir}`;
}

// ─── Map OSRM modifier → internal turn type (used by NavigationPanel) ────────

export function mapOSRMModifier(modifier) {
  const map = {
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
    'use lane':         'straight'
  };
  return map[modifier] || 'straight';
}

// ─── Rich instruction builder ─────────────────────────────────────────────────

/**
 * Builds a full navigation instruction string from OSRM step data.
 *
 * Examples output:
 *   "Turn right onto Plzeňská"
 *   "Turn right onto D5 E50 direction Praha"
 *   "Turn right onto Strakonická (D5) direction Praha / Brno"
 *   "Take the 3rd exit at the roundabout onto Evropská"
 *   "Merge onto D0 direction Brno"
 *   "Head northeast on Václavské náměstí"
 *   "You have arrived at your destination"
 */
function buildInstruction(step) {
  const { maneuverType, modifier, exit, name, ref, destinations, exits } = step;

  const roadLabel = buildRoadLabel(name, ref);
  const destLabel = buildDestLabel(destinations);
  const turnVerb  = buildTurnVerb(modifier);

  switch (maneuverType) {
    case 'depart':
      return buildDepartInstruction(step, roadLabel, destLabel);

    case 'arrive':
      return 'You have arrived at your destination';

    case 'turn':
    case 'new name':
    case 'end of road':
      return assembleTurn(turnVerb, roadLabel, destLabel);

    case 'continue':
      if (roadLabel) return `Continue on ${roadLabel}`;
      return 'Continue straight';

    case 'merge':
      if (roadLabel) return `Merge onto ${roadLabel}${destLabel ? ` direction ${destLabel}` : ''}`;
      return `Merge ${modifier || 'ahead'}`;

    case 'on ramp':
      return assembleTurn(turnVerb, roadLabel, destLabel, 'ramp');

    case 'off ramp': {
      const exitStr = exits ? ` exit ${exits}` : '';
      if (roadLabel) return `Take${exitStr} the exit onto ${roadLabel}${destLabel ? ` direction ${destLabel}` : ''}`;
      return `Take${exitStr} the exit`;
    }

    case 'fork':
      return `Keep ${modifier?.includes('left') ? 'left' : 'right'} at the fork${destLabel ? ` toward ${destLabel}` : ''}`;

    case 'roundabout':
    case 'rotary': {
      const exitOrdinal = exit ? ordinal(exit) : '';
      const exitPhrase  = exitOrdinal ? `Take the ${exitOrdinal} exit` : 'Take the exit';
      if (roadLabel) return `${exitPhrase} at the roundabout onto ${roadLabel}${destLabel ? ` direction ${destLabel}` : ''}`;
      if (destLabel) return `${exitPhrase} at the roundabout direction ${destLabel}`;
      return `${exitPhrase} at the roundabout`;
    }

    case 'roundabout turn':
      return assembleTurn(turnVerb, roadLabel, destLabel);

    case 'exit roundabout':
    case 'exit rotary':
      if (roadLabel) return `Exit the roundabout onto ${roadLabel}${destLabel ? ` direction ${destLabel}` : ''}`;
      return 'Exit the roundabout';

    case 'notification':
      if (roadLabel) return `Continue onto ${roadLabel}${destLabel ? ` direction ${destLabel}` : ''}`;
      return 'Continue ahead';

    default:
      if (roadLabel) return `${turnVerb || 'Continue'} onto ${roadLabel}${destLabel ? ` direction ${destLabel}` : ''}`;
      return turnVerb || 'Continue ahead';
  }
}

// ─── Instruction sub-builders ─────────────────────────────────────────────────

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

/**
 * Combines a road's name and ref into a single display label.
 * Highways (ref-only or no meaningful name) show the ref.
 * Named roads show name first, with ref in parentheses if different.
 *
 * Examples:
 *   ref="D5 E50", name=""            → "D5 E50"
 *   ref="D5",     name="Strakonická" → "Strakonická (D5)"
 *   ref="",       name="Plzeňská"    → "Plzeňská"
 */
function buildRoadLabel(name, ref) {
  const cleanRef  = (ref  || '').trim();
  const cleanName = (name || '').trim();

  if (!cleanRef && !cleanName) return '';
  if (!cleanName)              return cleanRef;
  if (!cleanRef)               return cleanName;
  if (cleanName === cleanRef)  return cleanRef;

  return `${cleanName} (${cleanRef})`;
}

/**
 * Formats destination signs for speech.
 * "Praha;Plzeň" → "Praha / Plzeň"  (max 2 destinations)
 */
function buildDestLabel(destinations) {
  if (!destinations) return '';
  return destinations
    .split(/[;,]/)
    .map(d => d.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' / ');
}

/** Maps an OSRM modifier to a natural-language turn verb */
function buildTurnVerb(modifier) {
  switch (modifier) {
    case 'sharp left':   return 'Turn sharp left';
    case 'left':         return 'Turn left';
    case 'slight left':  return 'Bear left';
    case 'straight':     return 'Continue straight';
    case 'slight right': return 'Bear right';
    case 'right':        return 'Turn right';
    case 'sharp right':  return 'Turn sharp right';
    case 'u-turn':       return 'Make a U-turn';
    default:             return 'Turn';
  }
}

/** Converts a bearing in degrees to an 8-point cardinal direction */
function bearingToCardinal(bearing) {
  const dirs = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  return dirs[Math.round(((bearing % 360) + 360) % 360 / 45) % 8];
}

/** Returns an ordinal string: 1→"1st", 2→"2nd", 3→"3rd", 4→"4th" … */
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ─── Polyline decoder ─────────────────────────────────────────────────────────

function decodePolyline(encoded) {
  const precision = 5;
  const factor = Math.pow(10, precision);
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
