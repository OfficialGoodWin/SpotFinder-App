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
 * FIXED INTERSECTION LOGIC - VERSION 3.0 (The Sandwich Fix)
 * Specifically handles slip roads and intersections where the road name 
 * might be missing or slightly different on the connector.
 */
export function transformStepsToTurns(steps) {
  if (!steps || steps.length === 0) return { turns: [], turnMarkers: [] };

  const turns = [];
  const turnMarkers = [];
  
  // 1. PRE-FILTER: Remove \"Sandwiched\" Slip Roads
  // We look at 3 steps at a time: Prev -> Current -> Next
  const filteredSteps = [];
  for (let i = 0; i < steps.length; i++) {
    const prev = filteredSteps[filteredSteps.length - 1];
    const curr = steps[i];
    const next = steps[i + 1];

    if (prev && next && curr.distance < 400) {
      const pName = (prev.name || '').trim().toLowerCase();
      const nName = (next.name || '').trim().toLowerCase();
      const cName = (curr.name || '').trim().toLowerCase();

      // THE SANDWICH RULE:
      // If we are on \"Road A\", turn onto \"Unnamed/Turning Channel\", 
      // and immediately end up back on \"Road A\", it's a slip road.
      const isReturnToSameRoad = pName !== '' && pName === nName;
      
      // THE FUZZY RULE:
      // If the current \"turn\" name is actually just a subset of the road we're on
      const isFuzzyMatch = cName !== '' && (pName.includes(cName) || cName.includes(pName));

      if (isReturnToSameRoad || isFuzzyMatch) {
        // Absorb the distance into the previous step and skip this \"turn\"
        prev.distance += curr.distance;
        continue;
      }
    }
    filteredSteps.push({ ...curr });
  }

  // 2. SECOND PASS: Merge rapid-fire noise (turns within 100m)
  const cleanSteps = [];
  for (let i = 0; i < filteredSteps.length; i++) {
    let current = filteredSteps[i];
    const next = filteredSteps[i + 1];

    if (next && current.distance < 100 && next.type !== 'arrive') {
      next.distance += current.distance;
      continue;
    }
    cleanSteps.push(current);
  }

  // 3. GENERATE INSTRUCTIONS
  const first = cleanSteps[0];
  turns.push({
    instruction: `Drive on ${first.name || 'route'}`,
    distance: Math.round(first.distance),
    type: 'depart'
  });

  for (let i = 0; i < cleanSteps.length; i++) {
    const step = cleanSteps[i];
    if (step.type === 'straight' || step.type === 'depart' || step.type === 'arrive') continue;

    // Filter \"Keep\" instructions which are just fork-guidance, not real turns
    const lowerInstr = step.instruction.toLowerCase();
    if (lowerInstr.includes('keep') || lowerInstr.includes('continue')) continue;

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

