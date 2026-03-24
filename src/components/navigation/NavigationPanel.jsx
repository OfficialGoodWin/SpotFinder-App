/**
 * NavigationPanel.jsx  (voice updated to use voiceService.js)
 *
 * Changes from original:
 *   - All window.speechSynthesis calls replaced with speak()/stopSpeaking()
 *     from voiceService.js (Capacitor TTS → Web Speech API fallback)
 *   - initVoice() called on mount, language synced with app language
 *   - setVoiceMuted() / setVoiceLanguage() replace direct Web Speech API calls
 *   - Everything else (routing logic, step detection, UI) is unchanged
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Car, Bike, PersonStanding, Volume2, VolumeX, ArrowLeft, ArrowRight, ArrowUp, CircleArrowRight } from 'lucide-react';
import { getOSRMRoute, mapOSRMModifier } from '@/api/osrmServiceClient';
import { useLanguage } from '@/lib/LanguageContext';
import {
  initVoice,
  speak,
  stopSpeaking,
  setVoiceLanguage,
  setVoiceMuted,
  isVoiceMuted,
} from '@/lib/voiceService';

const LANG_BCP47 = {
  en:'en-US', cs:'cs-CZ', pl:'pl-PL', de:'de-DE', sk:'sk-SK',
  it:'it-IT', fr:'fr-FR', ru:'ru-RU', uk:'uk-UA', hu:'hu-HU', ro:'ro-RO', es:'es-ES', bg:'bg-BG',
};

const ROUTE_TYPE_KEYS = [
  { id: 'car_fast',   labelKey: 'navPanel.drive', icon: Car,           profile: 'driving-car'     },
  { id: 'bike',       labelKey: 'navPanel.bike',  icon: Bike,          profile: 'cycling-regular' },
  { id: 'pedestrian', labelKey: 'navPanel.walk',  icon: PersonStanding,profile: 'foot-hiking'     },
];

// ── localized instruction builder (unchanged from original) ──────────────────
function localizeInstruction(step, t) {
  if (step._closedRoadWarning) {
    return t ? t('traffic.roadClosedStep') : '⚠️ Warning: road ahead is closed';
  }
  const { maneuverType, modifier, name, ref, destinations, exit, bearingAfter } = step;
  const roadLabel = buildRoadLabel(name, ref);
  const destLabel = destinations
    ? destinations.split(/[;,]/).map(d => d.trim()).filter(Boolean).slice(0, 2).join(' / ')
    : '';
  const dirWord   = t(`navPanel.direction`);
  const towardWord= t(`navPanel.toward`);
  const ontoWord  = t(`navPanel.onto`);
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
    const st = t('navPanel.ordSt'), nd = t('navPanel.ordNd'), rd = t('navPanel.ordRd'), th = t('navPanel.ordTh');
    const v = n % 100;
    const suffix = ([st, nd, rd][(v - 20) % 10 - 1] || [st, nd, rd][v - 1] || th) || th;
    return `${n}${suffix}`;
  }
  const cardinals = ['north','northeast','east','southeast','south','southwest','west','northwest'];
  function cardinal(bearing) { return t(`navPanel.${cardinals[Math.round(((bearing % 360) + 360) % 360 / 45) % 8]}`); }
  switch (maneuverType) {
    case 'depart': { const dir = cardinal(bearingAfter || 0); let s = `${t('navPanel.headDir')} ${dir}`; if (roadLabel) s += ` ${t('navPanel.on')} ${roadLabel}`; if (destLabel) s += ` ${dirWord} ${destLabel}`; return s; }
    case 'arrive':   return t('navPanel.arrived');
    case 'turn': case 'new name': case 'end of road': return withRoadDest(verb);
    case 'continue': return roadLabel ? `${t('navPanel.continueOn')} ${roadLabel}` : t('navPanel.continueStr');
    case 'merge':    return roadLabel ? `${t('navPanel.mergeOnto')} ${roadLabel}${destLabel ? ` ${dirWord} ${destLabel}` : ''}` : t('navPanel.mergeFwd');
    case 'on ramp':  return withRoadDest(verb);
    case 'off ramp': { const exitStr = step.exits ? ` ${t('navPanel.takeExitSign')} ${step.exits}` : ''; return roadLabel ? `${t('navPanel.takeExit')}${exitStr} ${roadLabel}${destLabel ? ` ${dirWord} ${destLabel}` : ''}` : `${t('navPanel.takeExit')}${exitStr}`; }
    case 'fork':     { const side = modifier?.includes('left') ? t('navPanel.keepLeft') : t('navPanel.keepRight'); return destLabel ? `${side} ${towardWord} ${destLabel}` : side; }
    case 'roundabout': case 'rotary': { const n = exit ? ordinal(exit) : ''; const base = t('navPanel.roundaboutExit').replace('{n}', n || ''); if (roadLabel) return `${base} ${ontoWord} ${roadLabel}${destLabel ? ` ${dirWord} ${destLabel}` : ''}`; if (destLabel) return `${base} ${dirWord} ${destLabel}`; return base; }
    case 'roundabout turn': return withRoadDest(verb);
    case 'exit roundabout': case 'exit rotary': return roadLabel ? `${t('navPanel.exitRoundabout')} ${roadLabel}${destLabel ? ` ${dirWord} ${destLabel}` : ''}` : t('navPanel.exitRoundaboutPlain');
    default: return roadLabel ? `${verb} ${ontoWord} ${roadLabel}${destLabel ? ` ${dirWord} ${destLabel}` : ''}` : t('navPanel.continueStr');
  }
}
function buildRoadLabel(name, ref) {
  const cleanRef  = (ref||'').split(/[\s;,/]+/).map(p=>p.trim()).filter(p=>p&&!/^E\d+$/i.test(p)).join(' ').trim();
  const s = (name||'').trim();
  const sanitised = s && /^\d+$/.test(s) ? (s.length<=3?`Road ${s}`:'') : s;
  if (!cleanRef && !sanitised) return '';
  if (!sanitised) return cleanRef;
  if (!cleanRef)  return sanitised;
  if (sanitised === cleanRef) return cleanRef;
  return `${sanitised} (${cleanRef})`;
}
function haversineDistance([lat1,lon1],[lat2,lon2]) {
  const R=6371e3,φ1=lat1*Math.PI/180,φ2=lat2*Math.PI/180,Δφ=(lat2-lat1)*Math.PI/180,Δλ=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(Δφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function formatDist(m) { return m>=1000?`${(m/1000).toFixed(1)} km`:`${Math.round(m)} m`; }
function formatDur(s) { const h=Math.floor(s/3600),m=Math.ceil((s%3600)/60); return h>0?`${h}h ${m}m`:`${m} min`; }

// ── Main component ────────────────────────────────────────────────────────────

export default function NavigationPanel({
  target, onClose, userPosition, onRouteReady, onRouteCleared,
  roadClosures = [], isDark,
}) {
  const { t, language } = useLanguage();
  const [routeType,       setRouteType]       = useState('car_fast');
  const [route,           setRoute]           = useState(null);
  const [steps,           setSteps]           = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [muted,           setMuted]           = useState(false);
  const [currentStep,     setCurrentStep]     = useState(0);
  const [isNavigating,    setIsNavigating]    = useState(false);
  const [routeCoordinates,setRouteCoordinates]= useState([]);
  const [turnMarkers,     setTurnMarkers]     = useState([]);
  const [allRoutes,       setAllRoutes]       = useState([]);
  const [selectedRouteIdx,setSelectedRouteIdx]= useState(0);
  const [routeLocked,     setRouteLocked]     = useState(false);
  const [retryCount,      setRetryCount]      = useState(0);

  const lastSpokenStep    = useRef(-1);
  const routeDebounceTimer= useRef(null);
  const lastFetchedCoords = useRef(null);
  const isRerouting       = useRef(false);
  const lastRerouteTime   = useRef(0);
  const stepsRef          = useRef([]);
  const currentStepRef    = useRef(0);
  const isNavigatingRef   = useRef(false);

  // ── Voice init & language sync ────────────────────────────────────────────
  useEffect(() => {
    initVoice();
  }, []);

  useEffect(() => {
    setVoiceLanguage(LANG_BCP47[language] || 'en-US');
  }, [language]);

  // ── Mute toggle ───────────────────────────────────────────────────────────
  useEffect(() => {
    setVoiceMuted(muted);
  }, [muted]);

  // ── Speech helpers ────────────────────────────────────────────────────────
  function speakRaw(text) {
    speak(text); // voiceService handles muted check internally
  }

  function speakInstruction(step, withDistance = true) {
    if (!step) return;
    const instruction = localizeInstruction(step, t);
    const text = withDistance && step.distance > 0
      ? `${t('navPanel.in')} ${formatDist(step.distance)}, ${instruction}`.trim()
      : instruction;
    speakRaw(text);
  }

  // ── Step detection (unchanged logic) ─────────────────────────────────────
  const convertOSRMStepsToTurns = useCallback((osrmSteps) => {
    const turns = osrmSteps
      .filter(s => s.maneuverType !== 'depart' || osrmSteps.indexOf(s) === 0)
      .map(step => ({
        instruction: localizeInstruction(step, t),
        distance:    step.distance,
        lat:         step.lat,
        lng:         step.lng,
        turnType:    mapOSRMModifier(step.modifier),
        maneuverType: step.maneuverType,
        modifier:    step.modifier,
        name:        step.name,
        ref:         step.ref,
      }));
    const turnMarkers = turns.map(s => ({ lat: s.lat, lng: s.lng, type: s.turnType }));
    return { turns, turnMarkers };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    if (!userPosition || !isNavigatingRef.current || stepsRef.current.length === 0) return;
    const idx = currentStepRef.current;
    const steps_ = stepsRef.current;
    if (idx >= steps_.length - 1) return;

    const nextStep = steps_[idx + 1];
    if (!nextStep) return;

    const dist = haversineDistance(userPosition, [nextStep.lat, nextStep.lng]);

    // Approaching next turn — announce at 200m
    if (dist < 200 && lastSpokenStep.current < idx + 1) {
      lastSpokenStep.current = idx + 1;
      speakInstruction(steps_[idx + 1], true);
    }

    // Close enough to advance to next step (15m)
    if (dist < 15) {
      const newIdx = idx + 1;
      currentStepRef.current = newIdx;
      setCurrentStep(newIdx);
      if (newIdx < steps_.length - 1) {
        speakInstruction(steps_[newIdx], false);
      } else {
        speakRaw(t('navPanel.arrived'));
      }
    }

    // Reroute if far off-course (200m from polyline)
    const now = Date.now();
    if (now - lastRerouteTime.current > 10000 && !isRerouting.current) {
      const nearStep = steps_.find((s, i) => i > idx &&
        haversineDistance(userPosition, [s.lat, s.lng]) < 200
      );
      if (!nearStep && dist > 200) {
        lastRerouteTime.current = now;
        isRerouting.current = true;
        speakRaw(t('navPanel.rerouting'));
        fetchRoute().finally(() => { isRerouting.current = false; });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPosition]);

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

  const fetchRoute = async () => {
    setLoading(true); setIsNavigating(false); isNavigatingRef.current = false;
    setSteps([]); stepsRef.current = []; setAllRoutes([]);

    const profile = ROUTE_TYPE_KEYS.find(r => r.id === routeType)?.profile || 'driving-car';
    const from    = { lat: userPosition[0], lng: userPosition[1] };
    const to      = { lat: target.lat,      lng: target.lng      };

    try {
      const result = await getOSRMRoute(from, to, profile);
      const routes = [result];
      setAllRoutes(routes);
      setSelectedRouteIdx(0);
      updateRouteDisplay(routes, 0);
      onRouteReady?.({ coordinates: result.geometry, turnMarkers: [] });
      lastFetchedCoords.current = userPosition;
      setRetryCount(0);
    } catch (err) {
      console.error('Route fetch error:', err);
      setLoading(false);
      // Show the error message to the user
      setRoute({ error: err.message });
    }
  };

  // Fetch route on mount / target change
  useEffect(() => {
    if (!target || !userPosition) return;
    clearTimeout(routeDebounceTimer.current);
    routeDebounceTimer.current = setTimeout(fetchRoute, 300);
    return () => clearTimeout(routeDebounceTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, routeType, retryCount]);

  // Start navigation
  function startNavigation() {
    setIsNavigating(true);
    isNavigatingRef.current = true;
    setCurrentStep(0);
    currentStepRef.current = 0;
    lastSpokenStep.current = -1;
    setTimeout(() => speakInstruction(stepsRef.current[0], false), 150);
  }

  // Stop navigation
  function stopNavigation() {
    setIsNavigating(false);
    isNavigatingRef.current = false;
    stopSpeaking();
    onRouteCleared?.();
    onClose?.();
  }

  // Advance step manually
  function advanceStep(dir) {
    const idx = currentStepRef.current + dir;
    if (idx < 0 || idx >= stepsRef.current.length) return;
    currentStepRef.current = idx;
    setCurrentStep(idx);
    if (isNavigatingRef.current) {
      const steps_ = stepsRef.current;
      if (idx < steps_.length - 1) {
        speakInstruction(steps_[idx], true);
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const currentStepData = steps[currentStep];
  const remainingDist   = route?.properties?.distance;
  const remainingDur    = route?.properties?.duration;

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-t-2xl shadow-2xl`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {ROUTE_TYPE_KEYS.map(rt => (
            <button key={rt.id}
              onClick={() => { setRouteType(rt.id); setRetryCount(c => c + 1); }}
              className={`p-2 rounded-xl transition-colors ${routeType === rt.id ? 'bg-blue-500 text-white' : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              <rt.icon className="w-4 h-4" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMuted(m => !m)}
            className={`p-2 rounded-xl transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button onClick={stopNavigation}
            className={`p-2 rounded-xl transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Route summary */}
      {route && !route.error && (
        <div className="px-4 pb-2 flex items-center gap-4">
          <span className="text-lg font-semibold">{formatDist(remainingDist)}</span>
          <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatDur(remainingDur)}</span>
          {!navigator.onLine && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">📴 Cached route</span>
          )}
        </div>
      )}

      {/* Error */}
      {route?.error && (
        <div className="px-4 pb-3 text-sm text-red-500">{route.error}</div>
      )}

      {/* Current step */}
      {currentStepData && (
        <div className={`mx-4 mb-3 p-3 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 p-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-white'}`}>
              {currentStepData.turnType === 'turn-left'  ? <ArrowLeft  className="w-5 h-5 text-blue-500" /> :
               currentStepData.turnType === 'turn-right' ? <ArrowRight className="w-5 h-5 text-blue-500" /> :
               currentStepData.turnType === 'u-turn'     ? <CircleArrowRight className="w-5 h-5 text-orange-500" /> :
               <ArrowUp className="w-5 h-5 text-green-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug">{currentStepData.instruction}</p>
              {currentStepData.distance > 0 && (
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t('navPanel.in')} {formatDist(currentStepData.distance)}
                </p>
              )}
            </div>
          </div>
          {/* Step navigation arrows */}
          {steps.length > 1 && (
            <div className="flex justify-between mt-2">
              <button onClick={() => advanceStep(-1)} disabled={currentStep === 0}
                className="text-xs text-blue-500 disabled:opacity-30">‹ Prev</button>
              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{currentStep + 1} / {steps.length}</span>
              <button onClick={() => advanceStep(1)} disabled={currentStep >= steps.length - 1}
                className="text-xs text-blue-500 disabled:opacity-30">Next ›</button>
            </div>
          )}
        </div>
      )}

      {/* Start / loading button */}
      {!isNavigating && !loading && route && !route.error && (
        <div className="px-4 pb-4">
          <button onClick={startNavigation}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors">
            {t('navPanel.startNav') || 'Start navigation'}
          </button>
        </div>
      )}
      {loading && (
        <div className="px-4 pb-4">
          <div className={`w-full py-3 rounded-xl text-center text-sm ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
            {t('navPanel.calculating') || 'Calculating route…'}
          </div>
        </div>
      )}
    </div>
  );
}
