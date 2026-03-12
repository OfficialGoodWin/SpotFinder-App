/**
 * OpenRouteService Integration Client
 * CLEAN VERSION: Fixed by removing all unsupported API parameters (continue_straight/avoid_features).
 * SHORTCUT FIX: Implemented via frontend road-name comparison logic.
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
        // Note: Removed 'options' block entirely. ORS frequently updates 
        // which sub-parameters are allowed, leading to 400/500 errors.
        units: 'm'
      })
    });

    if (!response.ok) {
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
  if (!orsResponse.routes || !orsResponse.routes.length) throw new Error('No routes found');
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

function normalizeStepType(type) {
  // Mapping Keep Left (12) and Keep Right (13) to straight to avoid junction icons
  const map = { 
    0: 'turn-left', 1: 'turn-right', 2: 'turn-left', 3: 'turn-right', 
    12: 'straight', 13: 'straight', 
    11: 'depart', 10: 'arrive' 
  };
  return map[type] || 'straight';
}

/**
 * FIXED INTERSECTION LOGIC - VERSION 5.0 (The Deep-Path Fix)
 * This version looks up to 4 steps ahead to find if the route returns 
 * to the original road, effectively deleting any \"bypass\" instructions.
 */
export function transformStepsToTurns(steps) {
  if (!steps || steps.length === 0) return { turns: [], turnMarkers: [] };

  const turns = [];
  const turnMarkers = [];
  
  // 1. PASS 1: Recursive Lookahead for Road Continuation
  const filteredSteps = [];
  for (let i = 0; i < steps.length; i++) {
    const curr = { ...steps[i] };
    const prev = filteredSteps[filteredSteps.length - 1];
    
    if (prev && prev.name !== '') {
      const pName = prev.name.toLowerCase();
      let foundContinuation = false;

      // Look ahead up to 4 segments to see if we get back on the same road
      // This catches: Main Road -> Slip Road -> Connector -> Main Road
      for (let j = 1; j <= 4; j++) {
        const futureStep = steps[i + j];
        if (!futureStep) break;

        const fName = (futureStep.name || '').toLowerCase();
        
        // If we find the original road name again within a short distance
        if (fName === pName || fName.includes(pName) || pName.includes(fName)) {
          // Calculate total distance of the \"shortcut\"
          let detourDistance = 0;
          for (let k = 0; k <= j; k++) detourDistance += (steps[i + k]?.distance || 0);

          if (detourDistance < 600) {
            prev.distance += detourDistance;
            i += j; // Skip all intermediate shortcut steps
            foundContinuation = true;
            break;
          }
        }
      }
      if (foundContinuation) continue;
    }
    filteredSteps.push(curr);
  }

  // 2. PASS 2: Proximity & Text Cleaning
  const cleanSteps = [];
  for (let i = 0; i < filteredSteps.length; i++) {
    let current = filteredSteps[i];
    const next = filteredSteps[i + 1];

    // Merge maneuvers within 150m (common for multi-part intersection turns)
    if (next && current.distance < 150 && next.type !== 'arrive') {
      next.distance += current.distance;
      continue;
    }
    cleanSteps.push(current);
  }

  // 3. PASS 3: Final Turn Generation
  const first = cleanSteps[0];
  turns.push({
    instruction: `Drive on ${first.name || 'route'}`,
    distance: Math.round(first.distance),
    type: 'depart'
  });

  for (let i = 0; i < cleanSteps.length; i++) {
    const step = cleanSteps[i];
    if (step.type === 'straight' || step.type === 'depart' || step.type === 'arrive') continue;

    // Hard-filter instructions that aren't real turns
    const instr = step.instruction.toLowerCase();
    if (instr.includes('keep') || instr.includes('continue') || instr.includes('straight')) continue;

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

