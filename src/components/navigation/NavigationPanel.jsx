import React, { useState, useEffect, useRef } from 'react';
import { X, Car, Bike, PersonStanding, Volume2, VolumeX, ArrowLeft, ArrowRight, ArrowUp, CircleArrowRight, Navigation } from 'lucide-react';
import { getDirectionsRoute, transformStepsToTurns } from '../../api/openrouteServiceClient';
import { API_CONFIG } from '../../api/apiConfig';

const ROUTE_TYPES = [
  { id: 'car_fast_traffic', label: 'Drive', icon: Car },
  { id: 'car_fast', label: 'Car', icon: Car },
  { id: 'bike_road', label: 'Bike', icon: Bike },
  { id: 'foot_fast', label: 'Walk', icon: PersonStanding },
];

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
  'turn-left': ArrowLeft,
  'turn-right': ArrowRight,
  'straight': ArrowUp,
  'depart': ArrowUp,
  'arrive': Navigation,
  default: ArrowUp,
};

export default function NavigationPanel({ from, to, toLabel, onClose, onRouteReady, userPosition }) {
  const [routeType, setRouteType] = useState('car_fast_traffic');
  const [route, setRoute] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isOffRoad, setIsOffRoad] = useState(false);
  const [allRoutes, setAllRoutes] = useState([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);

  const lastSpokenStep = useRef(-1);
  const lastFetchRef = useRef(null);
  const routeGeometryRef = useRef(null);

  const shouldFetch = () => {
    if (!from || !to) return false;
    const current = `${from.lat},${from.lng},${to.lat},${to.lng},${routeType}`;
    if (lastFetchRef.current === current) return false;
    lastFetchRef.current = current;
    return true;
  };

  useEffect(() => {
    if (shouldFetch()) {
      fetchRoute();
    }
  }, [from, to, routeType]);

  const fetchRoute = async () => {
    setLoading(true);
    setIsNavigating(false);
    setSteps([]);
    setAllRoutes([]);
    setSelectedRouteIdx(0);

    try {
      const profile = API_CONFIG.ORS.PROFILE_MAP[routeType] || 'driving-car';
      const route = await getDirectionsRoute(
        { lat: from.lat, lng: from.lng },
        { lat: to.lat, lng: to.lng },
        profile
      );
      const { geometry, distance, duration, steps } = route;
      const { turns, turnMarkers } = transformStepsToTurns(steps);
      const processedRoute = {
        routeGeometry: geometry,
        turns,
        turnMarkers,
        totalDistance: distance,
        totalDuration: duration
      };
      setAllRoutes([processedRoute]);
      switchToRoute(0, [processedRoute]);
    } catch (err) {
      console.error('Route calculation error:', err);
      alert(`Unable to calculate route: ${err.message}`);
    }
    setLoading(false);
  };

  const switchToRoute = (idx, routesList = allRoutes) => {
    const targetRoute = routesList[idx];
    if (!targetRoute) return;
    setSelectedRouteIdx(idx);
    setRoute({ length: targetRoute.totalDistance, duration: targetRoute.totalDuration });
    setSteps(targetRoute.turns);
    routeGeometryRef.current = targetRoute.routeGeometry;
    setCurrentStep(0);
    lastSpokenStep.current = -1;
    if (onRouteReady) {
      onRouteReady({
        routeGeometry: targetRoute.routeGeometry,
        length: targetRoute.totalDistance,
        duration: targetRoute.totalDuration,
        steps: targetRoute.turns,
        turnMarkers: targetRoute.turnMarkers || []
      });
    }
  };

  const startNavigation = () => {
    setIsNavigating(true);
    lastSpokenStep.current = -1;
    if (steps.length > 0) {
      setCurrentStep(0);
      setTimeout(() => speakStep(steps[0]), 100);
    }
  };

  const speakStep = (step, isAuto = false) => {
    if (!step || muted) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = isAuto ? step.instruction : `In ${formatDist(step.distance)}, ${step.instruction}`;
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'en-US';
      window.speechSynthesis.speak(utt);
    }
  };

  const goToStep = (idx) => {
    if (idx >= 0 && idx < steps.length) {
      setCurrentStep(idx);
      speakStep(steps[idx]);
    }
  };

  const step = steps[currentStep];
  const TurnIcon = step ? (TURN_ICONS[step.type] || TURN_ICONS.default) : ArrowUp;

  if (!isNavigating) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[1100] pointer-events-none animate-slide-up">
        <div className="bg-white rounded-t-3xl shadow-2xl px-4 pt-4 pb-6 pointer-events-auto mx-3 mb-3 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <p className="text-sm text-gray-500 font-medium">Navigating to</p>
              <p className="font-bold text-gray-900 text-lg truncate">{toLabel}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-gray-100 ml-3 hover:bg-gray-200 transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <div className="flex gap-2 mb-4">
            {ROUTE_TYPES.map(rt => {
              const Icon = rt.icon;
              return (
                <button
                  key={rt.id}
                  onClick={() => setRouteType(rt.id)}
                  className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-0.5 transition-all text-xs font-semibold
                    ${routeType === rt.id ? 'bg-green-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  <Icon className="w-4 h-4" />
                  {rt.label}
                </button>
              );
            })}
          </div>
          {loading ? (
            <div className="py-8 text-center">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-500">Calculating routes...</p>
            </div>
          ) : allRoutes.length > 0 ? (
            <>
              <div className="flex flex-col gap-3 mb-6">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider px-1">Select Route</p>
                {allRoutes.slice(0, 2).map((r, idx) => (
                  <button
                    key={idx}
                    onClick={() => switchToRoute(idx)}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                      selectedRouteIdx === idx
                        ? 'border-green-500 bg-green-50 shadow-sm'
                        : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div>
                      <p className={`font-bold ${selectedRouteIdx === idx ? 'text-green-700' : 'text-gray-900'}`}>
                        {idx === 0 ? 'Recommended Route' : 'Alternative Route'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm font-semibold ${selectedRouteIdx === idx ? 'text-green-600' : 'text-gray-600'}`}>
                          {formatTime(r.totalDuration)}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-sm text-gray-500">
                          {formatDist(r.totalDistance)}
                        </span>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedRouteIdx === idx ? 'border-green-500' : 'border-gray-300'
                    }`}>
                      {selectedRouteIdx === idx && <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={startNavigation}
                className="w-full py-4 bg-green-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:bg-green-600 active:scale-[0.98] transition-all"
              >
                <CircleArrowRight className="w-6 h-6" />
                Start Navigation
              </button>
            </>
          ) : (
            <p className="text-center text-gray-400 py-4">
              No route found
              <button onClick={fetchRoute} className="block mx-auto mt-2 text-green-500 text-sm underline">
                Try again
              </button>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[1200] pointer-events-none">
      {isOffRoad ? (
        <div className="mx-3 mt-16 mb-2 bg-red-600 text-white rounded-2xl shadow-2xl px-4 py-4 flex items-center gap-4 pointer-events-auto animate-slide-down">
          <div className="w-14 h-14 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <ArrowLeft className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg leading-tight">You are off-road!</p>
            <p className="text-red-200 text-sm">Turn around and head back to the route</p>
          </div>
        </div>
      ) : step ? (
        <div className="mx-3 mt-16 mb-2 bg-green-600 text-white rounded-2xl shadow-2xl px-4 py-4 flex items-center gap-4 pointer-events-auto animate-slide-down">
          <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <TurnIcon className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg leading-tight truncate">{step.instruction}</p>
            <p className="text-green-200 text-sm">{formatDist(step.distance)}</p>
          </div>
          <button
            onClick={() => setMuted(m => !m)}
            className="p-3 rounded-xl bg-green-500 flex-shrink-0 hover:bg-green-400 transition-colors"
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      ) : null}
      <div className="fixed bottom-0 inset-x-0 bg-white rounded-t-3xl shadow-2xl px-4 pt-4 pb-8 pointer-events-auto animate-slide-up">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-gray-500 font-medium">Navigating to</p>
            <p className="font-bold text-gray-900 truncate max-w-[200px]">{toLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            {route && (
              <div className="text-right">
                <p className="font-bold text-gray-900 text-sm">{formatDist(route.length || 0)}</p>
                <p className="text-xs text-gray-500">{formatTime(route.duration || 0)}</p>
              </div>
            )}
            <button onClick={onClose} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
        {steps.length > 1 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => goToStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 rounded-xl bg-gray-100 disabled:opacity-30 text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500 font-medium">
              {currentStep + 1} / {steps.length}
            </span>
            <button
              onClick={() => goToStep(Math.min(steps.length - 1, currentStep + 1))}
              disabled={currentStep === steps.length - 1}
              className="px-4 py-2 rounded-xl bg-gray-100 disabled:opacity-30 text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
