/**
 * OpenRouteService Integration Client
 * Handles all ORS API calls and data transformations
 */

import { API_CONFIG } from './apiConfig.js';

const { BASE_URL, API_KEY, PROFILE_MAP } = API_CONFIG.ORS;

// Use proxy in development to avoid CORS issues
const USE_PROXY = import.meta.env.DEV;
const PROXY_PREFIX = '/ors-api';

/**
 * Get directions route from one point to another
 * @param {Object} from - Start coordinates {lat, lng}
 * @param {Object} to - End coordinates {lat, lng}
 * @param {string} profile - Route profile (driving-car, cycling-regular, foot-hiking)
 * @returns {Promise<Object>} - {geometry, distance, duration, steps}
 */
export async function getDirectionsRoute(from, to, profile) {
  if (!API_KEY) {
    throw new Error('ORS API key not configured. Set VITE_ORS_API_KEY in .env');
  }

  const coordinates = [
    [from.lng, from.lat],
    [to.lng, to.lat]
  ];

  // Use proxy in development to avoid CORS
  let url;
  if (USE_PROXY) {
    // In dev, use relative URL for proxy
    url = new URL(`${window.location.origin}/ors-api/directions/${profile}`);
  } else {
    // In production, use full API URL
    url = new URL(`${BASE_URL}/directions/${profile}`);
  }
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('format', 'json');

  const body = {
    coordinates,
    instructions: true,
    geometry: true,
    maneuvers: true,
    preference: 'recommended',
    units: 'km',
    elevations: false,
    roundabouts: 1,
    suppress_warnings: true
  };

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMsg = response.statusText;
      if (contentType?.includes('application/json')) {
        const error = await response.json();
        errorMsg = error.error?.message || error.message || response.statusText;
      }
      throw new Error(`ORS API error (${response.status}): ${errorMsg}`);
    }

    const data = await response.json();
    console.log('ORS Response:', data);
    return normalizeDirectionsResponse(data);
  } catch (err) {
    console.error('ORS Directions API error:', err);
    throw err;
  }
}

/**
 * Search for places using ORS Geocoding API
 * @param {string} query - Search query
 * @param {Object} proximity - Optional {lat, lng} for location bias
 * @returns {Promise<Array>} - Array of {name, lat, lng}
 */
export async function searchPlaces(query, proximity) {
  if (!API_KEY) {
    throw new Error('ORS API key not configured. Set VITE_ORS_API_KEY in .env');
  }

  // Use proxy in development to avoid CORS
  const geocodeBaseUrl = USE_PROXY ? '' : BASE_URL;
  const url = new URL(`${geocodeBaseUrl}/ors-api/geocode/search`);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('text', query);
  url.searchParams.set('lang', 'en');

  // Add proximity bias if provided
  if (proximity && proximity.lat && proximity.lng) {
    url.searchParams.set('proximity', `${proximity.lng},${proximity.lat}`);
  }

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`ORS Geocode API error: ${response.statusText}`);
    }

    const data = await response.json();
    return normalizeGeocodeResults(data);
  } catch (err) {
    console.error('ORS Geocoding API error:', err);
    throw err;
  }
}

/**
 * Decode polyline string to coordinates
 * @private
 */
function decodePolyline(encoded) {
  const precision = 5;
  const factor = Math.pow(10, precision);
  let index = 0, lat = 0, lng = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte;

    // Decode latitude
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    result = 0;
    shift = 0;

    // Decode longitude
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    coordinates.push([lat / factor, lng / factor]);
  }

  return coordinates;
}

/**
 * Normalize ORS Directions API response to app format
 * @private
 */
function normalizeDirectionsResponse(orsResponse) {
  if (!orsResponse.routes || !orsResponse.routes.length) {
    throw new Error('No routes found');
  }

  const route = orsResponse.routes[0];

  // Handle geometry - it's usually an encoded polyline string
  let geometry = [];
  if (route.geometry) {
    if (typeof route.geometry === 'string') {
      // Encoded polyline format
      geometry = decodePolyline(route.geometry);
    } else if (Array.isArray(route.geometry)) {
      // Direct array format [lat, lng]
      geometry = route.geometry;
    } else if (route.geometry.coordinates) {
      // GeoJSON format [lng, lat]
      geometry = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
    }
  }

  // Extract distance and duration
  const summary = route.summary || {};
  const distance = summary.distance || 0;
  const duration = summary.duration || 0;

  // Extract steps/instructions
  const steps = extractStepsFromRoute(route);

  return {
    geometry,
    distance,
    duration,
    steps
  };
}

/**
 * Extract turn-by-turn instructions from ORS route
 * @private
 */
function extractStepsFromRoute(route) {
  const steps = [];

  if (!route.segments || !Array.isArray(route.segments)) {
    console.warn('No segments array found in route');
    return steps;
  }

  console.log('Route segments:', route.segments);

  let cumulativeDistance = 0;

  route.segments.forEach((segment, segIdx) => {
    if (!segment.steps || !Array.isArray(segment.steps)) {
      console.warn(`No steps found in segment ${segIdx}`);
      return;
    }

    console.log(`Segment ${segIdx} has ${segment.steps.length} steps`);

    segment.steps.forEach(step => {
      if (!step) return;
      
      cumulativeDistance += (step.distance || 0);

      steps.push({
        instruction: step.instruction || 'Continue',
        distance: step.distance || 0,
        type: normalizeStepType(step.type),
        lat: step.maneuver?.location?.[1],
        lng: step.maneuver?.location?.[0],
        name: step.name || '',
        exit_number: step.exit_number,
        bearing_before: step.maneuver?.bearing_before,
        bearing_after: step.maneuver?.bearing_after
      });
    });
  });

  console.log('Extracted', steps.length, 'total steps');
  return steps;
}

/**
 * Normalize ORS step type to app format
 * @private
 */
function normalizeStepType(type) {
  // ORS can return either numeric types OR string types depending on processing
  // Map sharp turns to simple left/right to avoid confusing navigation
  
  // Handle string types first (from pre-processed steps)
  if (typeof type === 'string') {
    const stringMap = {
      'turn-sharp-left': 'turn-left',
      'turn-sharp-right': 'turn-right'
    };
    return stringMap[type] || type;
  }
  
  // Handle numeric types (from raw ORS API)
  const numericMap = {
    0: 'turn-left',      // turn left
    1: 'turn-right',     // turn right
    2: 'turn-left',      // sharp-left mapped to simple left
    3: 'turn-right',     // sharp-right mapped to simple right
    4: 'straight',
    5: 'enter roundabout',
    6: 'exit roundabout',
    7: 'u-turn',
    8: 'u-turn',
    10: 'arrive',        // arrive
    11: 'depart',        // head towards
    12: 'slight-left',   // keep left
    13: 'slight-right'   // keep right
  };

  return numericMap[type] || 'straight';
}

/**
 * Transform ORS steps into turn markers for map display
 * @public
 */
export function transformStepsToTurns(steps) {
  const turns = [];
  const turnMarkers = [];
  
  // Handle empty or invalid steps
  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    // Return minimal navigation even with no steps
    turns.push({
      instruction: 'Arrive at destination',
      distance: 0,
      type: 'arrive'
    });
    return { turns, turnMarkers };
  }

  // ---------------------------------------------------------------------------
  // Pre-process step list to clean up odd cases reported by the user:
  //  * ORS sometimes returns a tiny "straight" segment followed by a sharp-
  //    right/left at intersections with turn lanes.  The UI would show "go
  //    straight" then "turn sharply right" even though the driver merely
  //    needed to turn right.  Collapse those two steps into a single turn.
  // ---------------------------------------------------------------------------
  const merged = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
      if (
      s &&
      s.type === 'straight' &&
      (s.distance || 0) < 100 &&
      i + 1 < steps.length
    ) {
      const nxt = steps[i + 1];
      // Match any turn type: turn-left, turn-right, turn-sharp-left, turn-sharp-right, etc.
      if (nxt && (nxt.type.startsWith('turn-') || nxt.type.includes('left') || nxt.type.includes('right'))) {
        // merge into next step
        nxt.distance = (nxt.distance || 0) + (s.distance || 0);
        // convert sharp turns into normal ones since we've merged
        if (nxt.type === 'turn-sharp-right') nxt.type = 'turn-right';
        if (nxt.type === 'turn-sharp-left') nxt.type = 'turn-left';
        console.log(`Merged tiny straight (${s.distance}m) with ${nxt.type}`);
        continue; // drop this tiny straight segment
      }
    }
    merged.push(s);
  }
  steps = merged;

  let distanceFromStart = 0;

  // Add initial depart instruction
  const firstStep = steps[0];
  turns.push({
    instruction: `Head towards your route`,
    distance: Math.round((firstStep.distance || 0) / 1),
    type: 'depart'
  });

  // Process each step
  let hasAnyTurns = false;
  steps.forEach((step, idx) => {
    if (!step) return;
    
    // Skip straight segments
    if (step.type === 'straight' || step.type === 'depart') {
      distanceFromStart += (step.distance || 0);
      return;
    }

    hasAnyTurns = true;
    
    // Add turn instruction
    const nextStep = steps[idx + 1];
    const nextStepDistance = nextStep ? (nextStep.distance || 0) : 0;

    const instruction = step.instruction || `${step.type} turn`;

    turns.push({
      instruction,
      distance: Math.round(nextStepDistance / 1),
      type: step.type
    });

    // Add turn marker for map
    if (step.lat !== undefined && step.lng !== undefined) {
      turnMarkers.push({
        lat: step.lat,
        lng: step.lng,
        type: step.type,
        instruction,
        isRoundabout: step.type === 'roundabout'
      });
    }

    distanceFromStart += (step.distance || 0);
  });

  // Add arrival instruction
  turns.push({
    instruction: 'Arrive at destination',
    distance: 0,
    type: 'arrive'
  });

  return { turns, turnMarkers };
}

/**
 * Normalize ORS Geocoding results
 * @private
 */
function normalizeGeocodeResults(orsResponse) {
  if (!orsResponse.features || !Array.isArray(orsResponse.features)) {
    return [];
  }

  return orsResponse.features.map(feature => {
    const coords = feature.geometry?.coordinates || [0, 0];
    return {
      name: feature.properties?.name || feature.properties?.label || 'Unknown',
      label: feature.properties?.label || feature.properties?.name || 'Unknown',
      location: feature.properties?.locality || '',
      lat: coords[1],
      lng: coords[0],
      position: {
        lat: coords[1],
        lon: coords[0]
      }
    };
  });
}
