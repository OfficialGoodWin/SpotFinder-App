import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Car, Bike, PersonStanding, Volume2, VolumeX, ArrowLeft, ArrowRight, ArrowUp, CircleArrowRight, ChevronUp, ChevronDown, Settings, Layers, MapPin, Zap, Crown, Gauge, Navigation, Truck } from 'lucide-react';
import { getOSRMRoute, mapOSRMModifier } from '@/api/osrmServiceClient';
import { useLanguage } from '@/lib/LanguageContext';

const LANG_BCP47 = {
  en:'en-US', cs:'cs-CZ', pl:'pl-PL', de:'de-DE', sk:'sk-SK',
  it:'it-IT', fr:'fr-FR', ru:'ru-RU', uk:'uk-UA', hu:'hu-HU', ro:'ro-RO', es:'es-ES', bg:'bg-BG',
};

const ROUTE_TYPE_KEYS = [
  { id: 'car_fast',   labelKey: 'navPanel.drive', icon: Car,           profile: 'driving-car'     },
  { id: 'truck',      labelKey: 'navPanel.truck', icon: Truck,         profile: 'external-tomtom' },
  { id: 'bike',       labelKey: 'navPanel.bike',  icon: Bike,          profile: 'cycling-regular' },
  { id: 'pedestrian', labelKey: 'navPanel.walk',  icon: PersonStanding,profile: 'foot-hiking'     },
];

// ─── Localized instruction builder ───────────────────────────────────────────
// Takes the raw OSRM step data and builds a human-readable instruction
// in whatever language t() is currently set to.
function localizeInstruction(step, t) {
  // Special: closed road warning step
  if (step._closedRoadWarning) {
    return t ? t('traffic.roadClosedStep') : '⚠️ Warning: road ahead is closed';
  }

  const { maneuverType, modifier, name, ref, destinations, exit, bearingAfter } = step;

  // helpers
  const roadLabel = buildRoadLabel(name, ref);
  const destLabel = destinations
    ? destinations.split(/[;,]/).map(d => d.trim()).filter(Boolean).slice(0, 2).join(' / ')
    : '';
  const dirWord = t(`navPanel.direction`);
  const towardWord = t(`navPanel.toward`);
  const ontoWord = t(`navPanel.onto`);

  const verbMap = {
    'sharp left':   t('navPanel.sharpLeft'),
    'left':         t('navPanel.turnLeft'),
    'slight left':  t('navPanel.bearLeft'),
    'straight':     t('navPanel.continueStr'),
    'slight right': t('navPanel.bearRight'),
    'right':        t('navPanel.turnRight'),
    'sharp right':  t('navPanel.sharpRight'),
    'u-turn':       t('navPanel.uTurn'),
  };
  const verb = verbMap[modifier] || t('navPanel.turnRight');

  function withRoadDest(action) {
    let s = action;
    if (roadLabel) s += ` ${ontoWord} ${roadLabel}`;
    if (destLabel) s += ` ${dirWord} ${destLabel}`;
    return s;
  }

  function ordinal(n) {
    const st = t('navPanel.ordSt'), nd = t('navPanel.ordNd'),
          rd = t('navPanel.ordRd'), th = t('navPanel.ordTh');
    const v = n % 100;
    const suffix = ([st, nd, rd][(v - 20) % 10 - 1] || [st, nd, rd][v - 1] || th) || th;
    return `${n}${suffix}`;
  }

  const cardinals = ['north','northeast','east','southeast','south','southwest','west','northwest'];
  function cardinal(bearing) {
    const key = cardinals[Math.round(((bearing % 360) + 360) % 360 / 45) % 8];
    return t(`navPanel.${key}`);
  }

  switch (maneuverType) {
    case 'depart': {
      const dir = cardinal(bearingAfter || 0);
      let s = `${t('navPanel.headDir')} ${dir}`;
      if (roadLabel) s += ` ${t('navPanel.on')} ${roadLabel}`;
      if (destLabel) s += ` ${dirWord} ${destLabel}`;
      return s;
    }
    case 'arrive':
      return t('navPanel.arrived');
    case 'turn':
    case 'new name':
    case 'end of road':
      return withRoadDest(verb);
    case 'continue':
      if (roadLabel) return `${t('navPanel.continueOn')} ${roadLabel}`;
      return t('navPanel.continueStr');
    case 'merge':
      if (roadLabel) return `${t('navPanel.mergeOnto')} ${roadLabel}${destLabel ? ` ${dirWord} ${destLabel}` : ''}`;
      return t('navPanel.mergeFwd');
    case 'on ramp':
      return withRoadDest(verb);
    case 'off ramp': {
      const exitStr = step.exits ? ` ${t('navPanel.takeExitSign')} ${step.exits}` : '';
      if (roadLabel) return `${t('navPanel.takeExit')}${exitStr} ${roadLabel}${destLabel ? ` ${dirWord} ${destLabel}` : ''}`;
      return `${t('navPanel.takeExit')}${exitStr}`;
    }
    case 'fork': {
      const side = modifier?.includes('left') ? t('navPanel.keepLeft') : t('navPanel.keepRight');
      return destLabel ? `${side} ${towardWord} ${destLabel}` : side;
    }
    case 'roundabout':
    case 'rotary': {
      const n = exit ? ordinal(exit) : '';
      const base = t('navPanel.roundaboutExit').replace('{n}', n || '');
      if (roadLabel) return `${base} ${ontoWord} ${roadLabel}${destLabel ? ` ${dirWord} ${destLabel}` : ''}`;
      if (destLabel) return `${base} ${dirWord} ${destLabel}`;
      return base;
    }
    case 'roundabout turn':
      return withRoadDest(verb);
    case 'exit roundabout':
    case 'exit rotary':
      if (roadLabel) return `${t('navPanel.exitRoundabout')} ${roadLabel}${destLabel ? ` ${dirWord} ${destLabel}` : ''}`;
      return t('navPanel.exitRoundaboutPlain');
    case 'notification':
    case 'use lane':
      if (roadLabel) return `${t('navPanel.continueOn')} ${roadLabel}${destLabel ? ` ${dirWord} ${destLabel}` : ''}`;
      return t('navPanel.continueStr');
    default:
      if (roadLabel) return `${verb} ${ontoWord} ${roadLabel}${destLabel ? ` ${dirWord} ${destLabel}` : ''}`;
      return verb;
  }
}

// Road label helpers (same logic as osrmServiceClient)
const PLATE_LOOKUP = {
  '605': 'D2', '18701': 'D2', '27': 'E53', 'E53': 'E53',
  // Czech motorways/expressways → add more as needed
  'D0': 'D0', 'D1': 'D1', 'D2': 'D2', 'D5': 'D5', 'D8': 'D8', 
  'R10': 'R10', 'R35': 'R35', 'R48': 'R48',
  // Add more road numbers as needed
  'E50': 'E50', 'E65': 'E65', 'E75': 'E75', 'E462': 'E462',
  'E442': 'E442', 'E55': 'E55', 'E49': 'E49', 'E48': 'E48',
  'E67': 'E67', 'E40': 'E40', 'E59': 'E59', 'E461': 'E461'
};

// Direction labels for major cities
const DIRECTION_LABELS = {
  'Brno': 'Brno',
  'Praha': 'Praha',
  'Plzeň': 'Plzeň',
  'Ostrava': 'Ostrava',
  'Olomouc': 'Olomouc',
  'Liberec': 'Liberec',
  'Hradec': 'Hradec Králové',
  'Pardubice': 'Pardubice',
  'České': 'České Budějovice',
  'Jihlava': 'Jihlava',
  'Zlín': 'Zlín',
  'Karlovy': 'Karlovy Vary'
};

function filterRef(ref) {
  if (!ref) return '';
  const parts = ref.split(/[\s;,/]+/).map(p => p.trim()).filter(Boolean);
  return parts.map(p => {
    const plate = PLATE_LOOKUP[p];
    if (plate) {
      // Return road number with plate styling
      return `<span class="px-1 py-0.5 bg-blue-600 text-white rounded font-bold text-xs">${plate}</span>`;
    }
    return p && !/^E\d+$/i.test(p) ? p : '';
  }).filter(Boolean).join(' ').trim();
}
function cleanName(name) {
  const s = (name || '').trim();
  if (!s) return '';
  if (/^\d{1,4}$/.test(s)) return s;
  return s;
}
function buildRoadLabel(name, ref) {
  const cleanRef = filterRef(ref);
  const sanitised = cleanName(name);
  
  // Check for direction labels
  let direction = '';
  if (sanitised) {
    for (const [key, value] of Object.entries(DIRECTION_LABELS)) {
      if (sanitised.includes(key)) {
        direction = ` <span class="text-green-500">→ ${value}</span>`;
        break;
      }
    }
  }
  
  if (!cleanRef && !sanitised) return '';
  if (!sanitised) return cleanRef;
  if (!cleanRef) return sanitised + direction;
  if (sanitised === cleanRef) return cleanRef + direction;
  return `${sanitised} ${cleanRef}${direction}`;
}

// ─── Distance / time formatters ───────────────────────────────────────────────
function formatDist(m) {
  if (!m || m <= 0) return '0 m';
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}
function formatTime(s) {
  if (!s || s <= 0) return '0 min';
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.round(s / 60)} min`;
}

const TURN_ICONS = {
  'turn-left': ArrowLeft, 'turn-right': ArrowRight,
  'straight': ArrowUp, 'depart': ArrowUp, 'arrive': ArrowUp,
  'slight-left': ArrowLeft, 'slight-right': ArrowRight,
  'sharp-left': ArrowLeft, 'sharp-right': ArrowRight,
  'u-turn': ArrowLeft,
  default: ArrowUp,
};

// ─── Haversine ────────────────────────────────────────────────────────────────
function haversineDistance([lat1, lng1], [lat2, lng2]) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Component ────────────────────────────────────────────────────────────────

// ─── Check if destination is on/near a closed road ───────────────────────────
// Overpass removed — skip closed-road destination check to avoid 429s.
async function isDestinationOnClosedRoad(_lat, _lng) {
  return false;
}

export default function NavigationPanel({ from, to, toLabel, onClose, onRouteReady, onRouteData, userPosition, onNavigatingChange, isSuperAdmin, userSubscription, onOpenSettings, onChangeMapLayer }) {
  const { t, language } = useLanguage();
  const [routeType, setRouteType] = useState('car_fast');
  const [carSubMode, setCarSubMode] = useState('fastest'); // 'fastest' | 'shortest' | 'eco' | 'ev'
  const [route, setRoute] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [turnMarkers, setTurnMarkers] = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [routeLocked, setRouteLocked] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [gpsSpeed, setGpsSpeed] = useState(0);       // km/h from GPS deltas
  const [speedLimit, setSpeedLimit] = useState(90);  // estimated from road type
  const [use24hTime, setUse24hTime] = useState(false);

  // Persist 24h preference
  useEffect(() => {
    const saved = localStorage.getItem('spotfinder.use24hTime');
    if (saved !== null) setUse24hTime(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('spotfinder.use24hTime', JSON.stringify(use24hTime));
  }, [use24hTime]);

  const lastSpokenStep = useRef(-1);
  const routeDebounceTimer = useRef(null);
  const lastFetchedCoords = useRef(null);
  const isRerouting = useRef(false);
  const lastRerouteTime = useRef(0);
  const stepsRef = useRef([]);          // always-current copy for async callbacks
  const currentStepRef = useRef(0);
  const isNavigatingRef = useRef(false);

  const OFF_ROUTE_M = 80;
  const REROUTE_COOLDOWN_MS = 15000;
  const ADVANCE_THRESHOLD_M = 35;       // how close to maneuver point to advance

  // Keep refs in sync
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { isNavigatingRef.current = isNavigating; }, [isNavigating]);
  // Notify parent when navigation state changes
  useEffect(() => { onNavigatingChange?.(isNavigating); }, [isNavigating]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GPS speed from position deltas ────────────────────────────────────────
  const prevPosRef = useRef(null);
  const prevPosTimeRef = useRef(null);
  useEffect(() => {
    if (!userPosition || !isNavigating) return;
    const now = Date.now();
    if (prevPosRef.current && prevPosTimeRef.current) {
      const dt = (now - prevPosTimeRef.current) / 1000; // seconds
      if (dt > 0.5 && dt < 10) {
        const dist = haversineDistance(prevPosRef.current, userPosition);
        const speedMs = dist / dt;
        setGpsSpeed(Math.round(speedMs * 3.6)); // m/s → km/h
      }
    }
    prevPosRef.current = userPosition;
    prevPosTimeRef.current = now;
  }, [userPosition, isNavigating]);

  // ── Speed limit from current step road type ───────────────────────────────
  useEffect(() => {
    const step = stepsRef.current[currentStepRef.current];
    if (!step) return;
    const ref = (step._raw?.ref || '').toUpperCase();
    const name = (step._raw?.name || '').toLowerCase();
    if (/^D\d|^A\d|motorway/i.test(ref) || name.includes('dálnice') || name.includes('autobahn')) {
      setSpeedLimit(130);
    } else if (/^E\d|trunk/i.test(ref)) {
      setSpeedLimit(110);
    } else if (/^I\d|^II\d|primary|secondary/i.test(ref) || name.includes('silnice')) {
      setSpeedLimit(90);
    } else {
      setSpeedLimit(50);
    }
  }, [currentStep]);

  // ── Convert OSRM steps → localized turns ──────────────────────────────────
  const convertOSRMStepsToTurns = useCallback((osrmSteps) => {
    const turns = [];
    const markers = [];

    osrmSteps.forEach((step) => {
      const type = mapOSRMModifier(step.modifier);
      // Build instruction in the current language using t()
      const instruction = localizeInstruction(step, t);

      turns.push({ instruction, distance: step.distance, type, lat: step.lat, lng: step.lng,
                   // keep raw data for re-localization if language changes
                   _raw: step });
      markers.push({ lat: step.lat, lng: step.lng, type, instruction });
    });

    if (turns.length > 0) {
      turns[0].type = 'depart';
      markers[0].type = 'depart';
      const last = turns.length - 1;
      turns[last].type = 'arrive';
      markers[last].type = 'arrive';
    }

    return { turns, turnMarkers: markers };
  }, [t]);

  // ── Re-localize when language changes ─────────────────────────────────────
  useEffect(() => {
    if (steps.length === 0) return;
    setSteps(prev => prev.map(s => s._raw
      ? { ...s, instruction: localizeInstruction(s._raw, t) }
      : s
    ));
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Route route on from/to change ─────────────────────────────────────────
  useEffect(() => {
    if (!from || !to || routeLocked) return;
    const key = JSON.stringify({ from, to });
    if (lastFetchedCoords.current === key) return;
    setLoading(true);
    clearTimeout(routeDebounceTimer.current);
    routeDebounceTimer.current = setTimeout(() => {
      lastFetchedCoords.current = key;
      fetchRoute();
      setSelectedRouteIdx(0);
    }, 500);
    return () => clearTimeout(routeDebounceTimer.current);
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Broadcast route data to parent ────────────────────────────────────────
  useEffect(() => {
    onRouteData?.({ coordinates: routeCoordinates, turns: turnMarkers, currentStep, userPos: userPosition });
  }, [routeCoordinates, turnMarkers, currentStep, userPosition]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AUTO-ADVANCE: advance step when user reaches the maneuver point ────────
  // The current step's lat/lng IS the point where you perform the maneuver.
  // Advance to the NEXT step when the user gets within ADVANCE_THRESHOLD_M of it.
  useEffect(() => {
    if (!userPosition || !isNavigatingRef.current) return;
    const steps_ = stepsRef.current;
    const cur = currentStepRef.current;
    if (steps_.length === 0 || cur >= steps_.length - 1) return;

    // Look at the NEXT step's maneuver point (that's where we need to turn)
    const nextStep = steps_[cur + 1];
    if (!nextStep?.lat || !nextStep?.lng) return;

    const dist = haversineDistance(userPosition, [nextStep.lat, nextStep.lng]);

    if (dist < ADVANCE_THRESHOLD_M && cur + 1 !== lastSpokenStep.current) {
      const newIdx = cur + 1;
      lastSpokenStep.current = newIdx;
      setCurrentStep(newIdx);
      currentStepRef.current = newIdx;
      // Speak the step we just advanced to (it's the current action now)
      speakInstruction(steps_[newIdx], false);
    }
  }, [userPosition]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── OFF-ROUTE detection + reroute ─────────────────────────────────────────
  useEffect(() => {
    if (!userPosition || !isNavigatingRef.current || routeCoordinates.length < 2) return;
    const now = Date.now();
    if (isRerouting.current || now - lastRerouteTime.current < REROUTE_COOLDOWN_MS) return;

    const [uLat, uLng] = userPosition;
    let minDist = Infinity;

    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const [aLat, aLng] = routeCoordinates[i];
      const [bLat, bLng] = routeCoordinates[i + 1];
      const dx = bLat - aLat, dy = bLng - aLng;
      const lenSq = dx*dx + dy*dy;
      let tParam = lenSq > 0 ? ((uLat - aLat)*dx + (uLng - aLng)*dy) / lenSq : 0;
      tParam = Math.max(0, Math.min(1, tParam));
      const d = haversineDistance([uLat, uLng], [aLat + tParam*dx, aLng + tParam*dy]);
      if (d < minDist) minDist = d;
    }

    if (minDist > OFF_ROUTE_M) {
      console.log(`[Nav] Off-route ${Math.round(minDist)}m — rerouting`);
      isRerouting.current = true;
      lastRerouteTime.current = now;
      speakRaw(t('navPanel.rerouting'));

      const profile = ROUTE_TYPE_KEYS.find(r => r.id === routeType)?.profile || 'driving-car';
      getOSRMRoute({ lat: uLat, lng: uLng }, to, profile)
        .then(result => {
          if (!result?.geometry?.length) throw new Error('empty');
          setRouteCoordinates(result.geometry);
          const { turns, turnMarkers: markers } = convertOSRMStepsToTurns(result.steps || []);
          setSteps(turns); stepsRef.current = turns;
          setTurnMarkers(markers);
          setCurrentStep(0); currentStepRef.current = 0;
          lastSpokenStep.current = -1;
          setRoute({ properties: { distance: result.distance, duration: result.duration } });
        })
        .catch(err => console.warn('[Nav] Reroute failed:', err.message))
        .finally(() => { isRerouting.current = false; });
    }
  }, [userPosition]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Speech helpers ────────────────────────────────────────────────────────
  const bcp47 = LANG_BCP47[language] || 'en-US';

  function speakRaw(text) {
    if (muted || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = bcp47; utt.rate = 0.95; utt.pitch = 1.0;
    window.speechSynthesis.speak(utt);
  }

  function speakInstruction(step, withDistance = true) {
    if (!step) return;
    const text = withDistance && step.distance > 0
      ? `${t('navPanel.in')} ${formatDist(step.distance)}, ${step.instruction}`.trim()
      : step.instruction;
    speakRaw(text);
  }

  // ── Route fetching ────────────────────────────────────────────────────────
  const updateRouteDisplay = (routes, idx) => {
    const r = routes[idx];
    if (!r?.geometry?.length) return;
    setRouteCoordinates(r.geometry);
    const { turns, turnMarkers: markers } = convertOSRMStepsToTurns(r.steps || []);
    setSteps(turns); stepsRef.current = turns;
    setTurnMarkers(markers);
    setRoute({ properties: { distance: r.distance, duration: r.duration } });
    setLoading(false);
  };

  const fetchRoute = async (subMode = 'fastest') => {
    setLoading(true); setIsNavigating(false); isNavigatingRef.current = false;
    setSteps([]); stepsRef.current = []; setAllRoutes([]);

    // FIX: pass profile key directly — no more .replace('-', '/') which broke cycling/walking
    const profile = ROUTE_TYPE_KEYS.find(r => r.id === routeType)?.profile || 'driving-car';
    
    if (profile === 'external-tomtom') {
      setLoading(false);
      return; // Do nothing here, UI handles it
    }

    // Apply route options based on carSubMode
    const options = {};
    if (routeType === 'car_fast') {
      switch (subMode) {
        case 'fastest':
          options.preference = 'fastest';
          break;
        case 'shortest':
          options.preference = 'shortest';
          break;
        case 'eco':
          options.preference = 'recommended';
          break;
        case 'ev':
          options.preference = 'recommended';
          options.vehicle_type = 'electric';
          break;
      }
    }

    try {
      const result = await getOSRMRoute(from, to, profile, options);

      if (!result?.geometry?.length) throw new Error('No route geometry');

      if (!result.steps?.length) {
        result.steps = [{
          maneuverType: 'depart', modifier: 'straight', name: '', ref: '', destinations: '',
          distance: result.distance || 0, lat: from.lat, lng: from.lng, bearingAfter: 0,
        }];
      }

      // Check if destination is on a closed road and warn user
      const destClosed = await isDestinationOnClosedRoad(to.lat, to.lng);
      if (destClosed && result.steps.length > 0) {
        // Insert warning step just before the final "arrive" step
        const lastIdx = result.steps.length - 1;
        const warningStep = {
          maneuverType: 'notification',
          modifier: 'straight',
          name: '',
          ref: '',
          destinations: '',
          distance: 0,
          lat: to.lat,
          lng: to.lng,
          bearingAfter: 0,
          _closedRoadWarning: true, // flag for special localization
        };
        result.steps.splice(lastIdx, 0, warningStep);
        console.warn('[Nav] Destination is on a closed road — warning step inserted');
      }

      // Off-road last-mile check for driving
      if (profile === 'driving-car' && result.steps.length > 0) {
        const last = result.steps[result.steps.length - 1];
        if (last.lat != null && last.lng != null) {
          const gap = haversineDistance([to.lat, to.lng], [last.lat, last.lng]);
          if (gap > 50) {
            result.steps.push({
              maneuverType: 'arrive', modifier: 'straight', name: '', ref: '',
              destinations: '', distance: gap, lat: to.lat, lng: to.lng, bearingAfter: 0,
            });
          }
        }
      }

      const routes = [result];
      setAllRoutes(routes);
      updateRouteDisplay(routes, 0);
      onRouteReady?.(result);
    } catch (err) {
      console.error('Route fetch error:', err.message);
      // Walking fallback only if car route fails
      if (profile === 'driving-car') {
        try {
          const walk = await getOSRMRoute(from, to, 'foot-hiking', {});
          const routes = [walk];
          setAllRoutes(routes);
          updateRouteDisplay(routes, 0);
          onRouteReady?.(walk);
          return;
        } catch (_) {}
      }
      if (retryCount < 2) {
        setRetryCount(p => p + 1);
        setTimeout(fetchRoute, 2000);
      }
      setLoading(false);
    }
  };

  // Re-fetch when route type changes (and not locked)
  useEffect(() => {
    if (!from || !to || !allRoutes.length) return;
    setRouteLocked(false);
    lastFetchedCoords.current = null;
    setLoading(true);
    clearTimeout(routeDebounceTimer.current);
    routeDebounceTimer.current = setTimeout(() => fetchRoute(carSubMode), 300);
  }, [routeType, carSubMode]); // eslint-disable-line react-hooks/exhaustive-deps // eslint-disable-line react-hooks/exhaustive-deps

  const startNavigation = () => {
    setIsNavigating(true); isNavigatingRef.current = true;
    lastSpokenStep.current = -1;
    setCurrentStep(0); currentStepRef.current = 0;
    if (stepsRef.current.length > 0) {
      setTimeout(() => speakInstruction(stepsRef.current[0], false), 150);
    }
  };

  const goToStep = (idx) => {
    if (idx >= 0 && idx < steps.length) {
      setCurrentStep(idx); currentStepRef.current = idx;
      speakInstruction(steps[idx]);
    }
  };

  const step = steps[currentStep];
  const TurnIcon = step ? (TURN_ICONS[step.type] || TURN_ICONS.default) : ArrowUp;

  // ── Subscription gate helper ──────────────────────────────────────────────
  const hasElite = isSuperAdmin || userSubscription === 'elite' || userSubscription === 'ultra';
  const hasUltra = isSuperAdmin || userSubscription === 'ultra';

  // ── ETA string ────────────────────────────────────────────────────────────
  const etaString = (() => {
    const dur = route?.properties?.duration || 0;
    if (!dur) return '--:--';
    const eta = new Date(Date.now() + dur * 1000);
    return eta.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: !use24hTime 
    });
  })();

  // ── Pre-navigation screen ─────────────────────────────────────────────────
  if (!isNavigating) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[1500] pointer-events-none">
        <div className="bg-background rounded-t-3xl shadow-2xl px-4 pt-4 pb-6 pointer-events-auto mx-3 mb-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground font-medium">{t('navPanel.navigatingTo')}</p>
              <p className="font-bold text-foreground text-lg truncate">{toLabel}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-gray-100 dark:bg-accent ml-3">
              <X className="w-5 h-5 text-gray-600 dark:text-foreground" />
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-muted-foreground">{t('navPanel.calculatingRoute')}</p>
            </div>
          ) : steps.length > 0 ? (
            <>
              {/* Route type selector */}
              <div className="flex gap-2 mb-3">
                {ROUTE_TYPE_KEYS.map(rt => {
                  const Icon = rt.icon;
                  return (
                    <button key={rt.id} onClick={() => setRouteType(rt.id)}
                      className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-0.5 transition-colors text-xs font-semibold
                        ${routeType === rt.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                      <Icon className="w-4 h-4" />
                      {t(rt.labelKey) || (rt.id === 'truck' ? 'Truck' : rt.id)}
                    </button>
                  );
                })}
              </div>

              {routeType === 'truck' && (
                <div className="my-6">
                  <p className="text-center text-sm text-muted-foreground mb-4">
                    Open TomTom GO app for specialized truck routing.
                  </p>
                  <button onClick={() => window.location.href = `tomtomgo://x-callback-url/navigate?destination=${to.lat},${to.lng}`}
                    className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:bg-orange-600 active:scale-[0.98] transition-all">
                    <Truck className="w-6 h-6" />
                    Open TomTom GO
                  </button>
                </div>
              )}

              {/* Car sub-modes: Fastest / Shortest / Eco */}
              {routeType === 'car_fast' && !isNavigating && (
                <div className="flex gap-2 mb-3">
                  {[{ id: 'fastest', label: '⚡ Fastest' }, { id: 'shortest', label: '📏 Shortest' }, { id: 'eco', label: '🌿 Eco' }].map(m => (
                    <button key={m.id} onClick={() => setCarSubMode(m.id)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors
                        ${carSubMode === m.id ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                      {m.label}
                    </button>
                  ))}
                  {/* Ultra: EV */}
                  <button
                    onClick={() => hasUltra ? setCarSubMode('ev') : null}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1
                      ${carSubMode === 'ev' ? 'bg-emerald-600 text-white' : hasUltra ? 'bg-muted text-muted-foreground hover:bg-accent' : 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'}`}
                    title={hasUltra ? 'EV route planning' : 'SpotFinder Ultra required'}>
                    <Zap className="w-3 h-3" />
                    {hasUltra ? 'EV' : '🔒 EV'}
                  </button>
                </div>
              )}

              {/* Ultra: EV route planning */}
              {routeType === 'car_fast' && !isNavigating && (
                <div className={`mb-3 px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-semibold
                  ${hasUltra ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/40' : 'bg-muted/40 text-muted-foreground/60 border border-border/40'}`}>
                  <Crown className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{hasUltra ? '⚡ EV Route: charger stops every 300 km (+2h/stop)' : '🔒 EV Route Planning — SpotFinder Ultra'}</span>
                </div>
              )}

              {/* Distance / duration */}
              <div className="flex items-center justify-center gap-8 mb-4 py-3 bg-gray-50 dark:bg-accent rounded-xl">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{formatDist(route?.properties?.distance || 0)}</p>
                  <p className="text-xs text-muted-foreground">{t('navPanel.distance')}</p>
                </div>
                <div className="w-px h-10 bg-gray-300 dark:bg-border" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{etaString}</p>
                  <p className="text-xs text-muted-foreground">ETA</p>
                </div>
                <div className="w-px h-10 bg-gray-300 dark:bg-border" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{formatTime(route?.properties?.duration || 0)}</p>
                  <p className="text-xs text-muted-foreground">Time</p>
                </div>
              </div>

              <button onClick={startNavigation}
                className="w-full py-4 bg-blue-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:bg-blue-600 active:scale-[0.98] transition-all">
                <CircleArrowRight className="w-6 h-6" />
                {t('navPanel.startNavigation')}
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-400 dark:text-muted-foreground">{t('navPanel.noRouteFound')}</p>
              <button onClick={fetchRoute} className="mt-2 text-primary text-sm underline">{t('common.tryAgain')}</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Active navigation screen ──────────────────────────────────────────────
  return (
    <>
      {/* ── TOP: Green turn-indicator pill ─────────────────────────────────── */}
      {step && (
        <div className="fixed top-4 inset-x-3 z-[1600] pointer-events-auto">
          <div className="bg-green-500 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-11 h-11 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <TurnIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base leading-tight truncate">{step.instruction}</p>
              <p className="text-green-100 text-sm font-medium">{formatDist(step.distance)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM: Slide-up drawer ─────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-[1500] pointer-events-none">
        <div className="pointer-events-auto bg-card rounded-t-3xl shadow-2xl">
          {/* Drag handle */}
          <button
            onClick={() => setDrawerExpanded(e => !e)}
            className="w-full flex flex-col items-center pt-2 pb-1"
            aria-label="Toggle drawer"
          >
            <div className="w-10 h-1 bg-gray-300 dark:bg-border rounded-full mb-1" />
            {drawerExpanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
          </button>

          {/* ── Collapsed row: speedometer | stats | distance ─────────────── */}
          <div className="flex items-center px-4 pb-4 gap-3">
            {/* Left: GPS speed + speed limit */}
            <div className="flex flex-col items-center justify-center w-16 flex-shrink-0">
              <div className="relative w-14 h-14 flex items-center justify-center">
                {/* Speed limit badge */}
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-red-500 bg-white dark:bg-card flex items-center justify-center z-10">
                  <span className="text-[9px] font-black text-red-600">{speedLimit}</span>
                </div>
                {/* Speedometer circle */}
                <div className="w-14 h-14 rounded-full border-4 border-blue-500 flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-900/20">
                  <span className="text-lg font-black text-blue-600 dark:text-blue-400 leading-none">{gpsSpeed}</span>
                  <span className="text-[9px] text-blue-500 font-semibold leading-none">km/h</span>
                </div>
              </div>
            </div>

            {/* Center: time remaining + ETA */}
            <div className="flex-1 flex flex-col items-center">
              <p className="text-2xl font-black text-foreground leading-none">
                {etaString}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">ETA</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <button 
                  onClick={() => setUse24hTime(!use24hTime)} 
                  className="text-xs underline text-primary"
                >
                  {use24hTime ? '12h' : '24h'}
                </button>
              </p>
            </div>

            {/* Right: distance to destination */}
            <div className="flex flex-col items-end flex-shrink-0">
              <p className="text-xl font-bold text-foreground leading-none">
                {formatDist(route?.properties?.distance || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('navPanel.distance')}</p>
            </div>
          </div>

          {/* ── Expanded panel ────────────────────────────────────────────── */}
          {drawerExpanded && (
            <div className="px-4 pb-8 border-t border-border pt-3 flex flex-col gap-2">
              {/* Cancel navigation */}
              <button
                onClick={() => onClose(true)}
                className="w-full py-3 rounded-2xl bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                <X className="w-4 h-4" /> Cancel Navigation
              </button>

              <div className="grid grid-cols-2 gap-2">
                {/* Change map style */}
                <button
                  onClick={() => { onChangeMapLayer?.(); setDrawerExpanded(false); }}
                  className="py-3 rounded-2xl bg-muted text-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-accent active:scale-[0.98] transition-all">
                  <Layers className="w-4 h-4" /> Map Style
                </button>

                {/* Settings */}
                <button
                  onClick={() => { onOpenSettings?.(); setDrawerExpanded(false); }}
                  className="py-3 rounded-2xl bg-muted text-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-accent active:scale-[0.98] transition-all">
                  <Settings className="w-4 h-4" /> Settings
                </button>

                {/* Find Nearby on Route */}
                <button
                  disabled={!isSuperAdmin && userSubscription !== 'ultra'}
                  className={`py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 ${
                    isSuperAdmin || userSubscription === 'ultra'
                      ? 'bg-muted text-foreground hover:bg-accent active:scale-[0.98] transition-all'
                      : 'bg-muted/50 text-muted-foreground/70 cursor-not-allowed'
                  }`}
                  title={isSuperAdmin || userSubscription === 'ultra' ? 'Find Nearby on Route' : 'SpotFinder Ultra required'}
                  onClick={() => {
                    if (isSuperAdmin || userSubscription === 'ultra') {
                      alert(t('common.comingSoon') || 'Coming soon');
                    }
                  }}
                >
                  <MapPin className="w-4 h-4" /> Nearby on Route {!(isSuperAdmin || userSubscription === 'ultra') && '🔒'}
                </button>

              </div>

              {/* Step counter */}
              {steps.length > 1 && (
                <div className="flex items-center justify-between mt-1">
                  <button onClick={() => goToStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}
                    className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-accent disabled:opacity-30 text-sm font-medium text-foreground">
                    {t('navPanel.prev')}
                  </button>
                  <span className="text-xs text-muted-foreground">{currentStep + 1} / {steps.length}</span>
                  <button onClick={() => goToStep(Math.min(steps.length - 1, currentStep + 1))} disabled={currentStep === steps.length - 1}
                    className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-accent disabled:opacity-30 text-sm font-medium text-foreground">
                    {t('navPanel.next')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
