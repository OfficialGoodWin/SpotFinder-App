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
  
  // Raw steps with full OSRM data
  const rawSteps = extractStepsFromRoute(route);
  
  return {
    geometry,
    distance: route.distance,
    duration: route.duration,
    steps: rawSteps
  };
}

function extractStepsFromRoute(route) {
  const steps = route.legs[0].steps.map(step => ({
    instruction: step.maneuver.instruction,
    distance: step.distance,
    modifier: step.maneuver.modifier,
    bearing: step.maneuver.bearing_after || 0,
    lat: step.maneuver.location[1],
    lng: step.maneuver.location[0],
    name: step.name || '',
    ref: step.ref || '',               // road number, e.g. "D5"
    destinations: step.destinations || '', // destination sign, e.g. "Praha"
    exits: step.exits || '',            // exit number if applicable
    intersections: step.intersections   // needed for lane guidance
  })).filter(step => step.distance > 5);

  return steps;
}

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

function mapOSRMModifier(modifier) {
  const map = {
    'sharp left': 'turn-left',
    'left': 'turn-left',
    'slight left': 'turn-left',
    'straight': 'straight',
    'slight right': 'turn-right',
    'right': 'turn-right',
    'sharp right': 'turn-right',
    'u-turn': 'u-turn',
    'roundabout left': 'enter roundabout',
    'roundabout right': 'enter roundabout',
    'exit roundabout': 'exit roundabout',
    'use lane': 'straight'
  };
  return map[modifier] || 'straight';
}

