/**
 * GraphHopper Integration Client
 * Alternative routing service with identical API interface to ORS.
 * Usage: const routeData = await getGraphHopperRoute(start, end);
 * L.polyline(routeData.geometry, { color: 'blue' }).addTo(map);
 */

const GRAPH_HOPPER_KEY = import.meta.env.VITE_GRAPH_HOPPER_KEY;
const BASE_URL = 'https://graphhopper.com/api/1/route';

export async function getGraphHopperRoute(from, to, profile = 'car') {
  if (!GRAPH_HOPPER_KEY) {
    throw new Error('GraphHopper API key not configured. Set VITE_GRAPH_HOPPER_KEY in .env');
  }

  const url = new URL(BASE_URL);
  url.searchParams.set('key', GRAPH_HOPPER_KEY);
  url.searchParams.set('point', `${from.lat},${from.lng}`);
  url.searchParams.set('point', `${to.lat},${to.lng}`);
  url.searchParams.set('vehicle', mapGraphHopperProfile(profile));
  url.searchParams.set('calculate_edges', 'true');
  url.searchParams.set('details', 'instructions,street_name');
  url.searchParams.set('format', 'json');

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`GraphHopper API error: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    return normalizeGraphHopperResponse(data);
  } catch (err) {
    console.error('GraphHopper API error:', err);
    throw err;
  }
}

function normalizeGraphHopperResponse(ghResponse) {
  if (!ghResponse.paths || !ghResponse.paths.length) throw new Error('No routes found');
  const path = ghResponse.paths[0];

  // Geometry from points (GraphHopper returns encoded polyline by default)
  let geometry = path.points ? decodePolyline(path.points) : [];

  return {
    geometry,
    distance: path.distance || 0,
    duration: path.time / 1000 || 0, // GraphHopper uses milliseconds
    steps: extractStepsFromPath(path)
  };
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

function mapGraphHopperProfile(profile) {
  const map = {
    'driving-car': 'car',
    'cycling-regular': 'bike',
    'foot-hiking': 'foot'
  };
  return map[profile] || 'car';
}

function extractStepsFromPath(path) {
  const steps = [];
  const instructions = path.instructions || [];
  
  instructions.forEach((instr, idx) => {
    steps.push({
      instruction: instr.text || 'Continue',
      distance: instr.distance || 0,
      type: 'straight', // GraphHopper doesn't have detailed turn types, map later
      lat: instr.lat || instr.latitude,
      lng: instr.lon || instr.longitude,
      name: instr.name || ''
    });
  });

  return steps;
}

