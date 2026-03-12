/**
 * OpenRouteService Integration Client
 * Handles all ORS API calls and data transformations
 * * IMPORTANT: To prevent the \"walking\" look (straight lines cutting corners), 
 * your map component MUST use the 'geometry' field to draw the blue line, 
 * not the 'turnMarkers'.
 */

import { API_CONFIG } from './apiConfig.js';

const { BASE_URL, API_KEY, PROFILE_MAP } = API_CONFIG.ORS;

const USE_PROXY = import.meta.env.DEV;

/**
 * Get directions route from one point to another
 * @returns {Promise<Object>} - {geometry, distance, duration, steps}
 */
export async function getDirectionsRoute(from, to, profile = 'driving-car') {
  if (!API_KEY) {
    throw new Error('ORS API key not configured. Set VITE_ORS_API_KEY in .env');
  }

  const coordinates = [[from.lng, from.lat], [to.lng, to.lat]];

  let url;
  if (USE_PROXY) {
    url = new URL(`${window.location.origin}/ors-api/directions/${profile}`);
  } else {
    url = new URL(`${BASE_URL}/directions/${profile}`);
  }
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('format', 'json');

  const body = {
    coordinates,
    instructions: true,
    geometry: true
  };

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ORS API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return normalizeDirectionsResponse(data);
  } catch (err) {
    console.error('ORS Directions API error:', err);
    throw err;
  }
}

/**
 * Decode polyline string to coordinates
 */
function decodePolyline(encoded) {
  const precision = 5;
  const factor = Math.pow(10, precision);
  let index = 0, lat = 0, lng = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let result = 0, shift = 0, byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    result = 0; shift = 0;
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

function normalizeDirectionsResponse(orsResponse) {
  if (!orsResponse.routes || !orsResponse.routes.length) throw new Error('No routes found');

  const route = orsResponse.routes[0];
  let geometry = [];
  
  // High-resolution geometry for smooth road-following lines
  if (route.geometry) {
    if (typeof route.geometry === 'string') {
      geometry = decodePolyline(route.geometry);
    } else if (route.geometry.coordinates) {
      geometry = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
    }
  }

  return {
    geometry,
    distance: route.summary?.distance || 0,
    duration: route.summary?.duration || 0,
    steps: extractStepsFromRoute(route)
  };
}

function extractStepsFromRoute(route) {
  const steps = [];
  if (!route.segments) return steps;

  route.segments.forEach(segment => {
    segment.steps?.forEach(step => {
      steps.push({
        instruction: step.instruction || 'Continue',
        distance: step.distance || 0,
        type: normalizeStepType(step.type),
        lat: step.maneuver?.location?.[1],
        lng: step.maneuver?.location?.[0],
        name: step.name || ''
      });
    });
  });
  return steps;
}

/**
 * Fixes \"Straight Arrow\" issues by mapping slight turns to standard turn icons
 */
function normalizeStepType(type) {
  if (typeof type === 'string') {
    const stringMap = {
      'turn-sharp-left': 'turn-left',
      'turn-sharp-right': 'turn-right',
      'slight-left': 'turn-left', 
      'slight-right': 'turn-right'
    };
    return stringMap[type] || type;
  }

  const numericMap = {
    0: 'turn-left', 1: 'turn-right', 2: 'turn-left', 3: 'turn-right',
    4: 'straight', 5: 'enter roundabout', 6: 'exit roundabout',
    7: 'u-turn', 8: 'u-turn', 10: 'arrive', 11: 'depart',
    12: 'turn-left', // Mapped from slight-left
    13: 'turn-right' // Mapped from slight-right
  };
  return numericMap[type] || 'straight';
}

/**
 * Transforms steps into clean navigation instructions
 */
export function transformStepsToTurns(steps) {
  const turns = [];
  const turnMarkers = [];
  
  if (!steps || steps.length === 0) return { turns, turnMarkers };

  // Segment Merging Logic: Collapses tiny segments often found at highway exits
  const merged = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s && (s.distance || 0) < 50 && i + 1 < steps.length) {
      const nxt = steps[i + 1];
      if (nxt && (nxt.type.includes('left') || nxt.type.includes('right'))) {
        nxt.distance = (nxt.distance || 0) + (s.distance || 0);
        continue; 
      }
    }
    merged.push(s);
  }
  steps = merged;

  // FIX: Updated \"Walking\" language to Driving language
  const firstStep = steps[0];
  const roadName = firstStep.name ? ` onto ${firstStep.name}` : '';
  turns.push({
    instruction: `Head north${roadName}`,
    distance: Math.round(firstStep.distance || 0),
    type: 'depart'
  });

  steps.forEach((step, idx) => {
    if (step.type === 'straight' || step.type === 'depart') return;

    const nextStep = steps[idx + 1];
    const instruction = step.instruction || `${step.type} turn`;

    turns.push({
      instruction,
      distance: Math.round(nextStep?.distance || 0),
      type: step.type
    });

    if (step.lat !== undefined && step.lng !== undefined) {
      turnMarkers.push({
        lat: step.lat,
        lng: step.lng,
        type: step.type,
        instruction
      });
    }
  });

  turns.push({ instruction: 'Arrive at destination', distance: 0, type: 'arrive' });

  return { turns, turnMarkers };
}

