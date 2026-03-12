/**
 * OpenRouteService Integration Client
 * Fixed API request structure to resolve the 400 error.
 */

import { API_CONFIG } from './apiConfig.js';

const { BASE_URL, API_KEY } = API_CONFIG.ORS;
const USE_PROXY = import.meta.env.DEV;

export async function getDirectionsRoute(from, to, profile = 'driving-car') {
  if (!API_KEY) {
    throw new Error('ORS API key not configured. Set VITE_ORS_API_KEY in .env');
  }

  const coordinates = [[from.lng, from.lat], [to.lng, to.lat]];
  let url = USE_PROXY 
    ? new URL(`${window.location.origin}/ors-api/directions/${profile}`)
    : new URL(`${BASE_URL}/directions/${profile}`);
  
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('format', 'json');

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coordinates,
        instructions: true,
        geometry: true,
        preference: 'fastest',
        // REVISED OPTIONS STRUCTURE
        options: {
          avoid_features: [\"unpavedroads\"], 
          continue_straight: true 
        }
      })
    });

    if (!response.ok) {
      // Log the exact error from the server to pinpoint the issue
      const errorData = await response.json();
      console.error('Detailed ORS Error:', errorData);
      throw new Error(`ORS API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return normalizeDirectionsResponse(data);
  } catch (err) {
    console.error('ORS Directions API error:', err);
    throw err;
  }
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

function normalizeDirectionsResponse(orsResponse) {
  const route = orsResponse.routes[0];
  let geometry = typeof route.geometry === 'string' 
    ? decodePolyline(route.geometry) 
    : route.geometry.coordinates.map(c => [c[1], c[0]]);

  return {
    geometry,
    distance: route.summary?.distance || 0,
    duration: route.summary?.duration || 0,
    steps: route.segments.flatMap(segment => segment.steps.map(step => ({
      instruction: step.instruction,
      distance: step.distance,
      type: normalizeStepType(step.type),
      lat: step.maneuver?.location?.[1],
      lng: step.maneuver?.location?.[0],
      name: (step.name || '').trim()
    })))
  };
}

/**
 * Maps ORS codes. Note: 12 and 13 (Keep Left/Right) are now 'straight' 
 * to avoid unnecessary icons on highways.
 */
function normalizeStepType(type) {
  const map = { 
    0: 'turn-left', 1: 'turn-right', 2: 'turn-left', 3: 'turn-right', 
    12: 'straight', // Changed to straight to hide \"Keep Left\" noise
    13: 'straight', // Changed to straight to hide \"Keep Right\" noise
    11: 'depart', 10: 'arrive' 
  };
  return map[type] || 'straight';
}

/**
 * Enhanced transformation to fix Intersection Shortcut issues
 */
export function transformStepsToTurns(steps) {
  if (!steps || steps.length === 0) return { turns: [], turnMarkers: [] };

  const turns = [];
  const turnMarkers = [];
  
  // 1. Semantic Merging & Name Filtering
  const cleanSteps = [];
  for (let i = 0; i < steps.length; i++) {
    let current = { ...steps[i] };
    const prev = cleanSteps[cleanSteps.length - 1];
    
    // FILTER: If we are \"turning\" onto a road with the exact same name, it's noise.
    // This happens at slip-roads that lead back to the same highway.
    if (prev && current.name && prev.name === current.name && current.distance < 200) {
        prev.distance += current.distance;
        continue;
    }

    // FILTER: Ignore extremely short turns (<80m) that occur immediately after another turn.
    if (i < steps.length - 1 && current.distance < 80) {
      const next = steps[i + 1];
      if (next.type !== 'straight' && next.type !== 'arrive') {
        next.distance += current.distance;
        continue; 
      }
    }
    cleanSteps.push(current);
  }

  // 2. Build instructions
  const first = cleanSteps[0];
  turns.push({
    instruction: `Drive on ${first.name || 'current road'}`,
    distance: Math.round(first.distance),
    type: 'depart'
  });

  for (let i = 0; i < cleanSteps.length; i++) {
    const step = cleanSteps[i];
    
    // Skip all 'straight' types (including the Keep Left/Right noise we remapped)
    if (step.type === 'straight' || step.type === 'depart' || step.type === 'arrive') continue;

    // Check instruction text for \"Keep\" or \"Continue\" - if found, treat as straight.
    if (step.instruction.toLowerCase().includes('keep') || step.instruction.toLowerCase().includes('continue')) {
        continue;
    }

    const nextStep = cleanSteps[i + 1];
    turns.push({
      instruction: step.instruction,
      distance: Math.round(nextStep?.distance || 0),
      type: step.type
    });

    if (step.lat !== undefined) {
      turnMarkers.push({
        lat: step.lat,
        lng: step.lng,
        type: step.type,
        instruction: step.instruction
      });
    }
  }

  turns.push({ instruction: 'Arrive at destination', distance: 0, type: 'arrive' });
  return { turns, turnMarkers };
}

