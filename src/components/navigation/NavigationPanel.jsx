import React, { useState, useEffect, useRef } from 'react';
import { X, Car, Bike, PersonStanding, Volume2, VolumeX, ArrowLeft, ArrowRight, ArrowUp, CircleArrowRight } from 'lucide-react';
import { getDirectionsRoute, transformStepsToTurns } from '@/api/openrouteServiceClient';
import { API_CONFIG } from '@/api/apiConfig';

const ROUTE_TYPES = [
  { id: 'car_fast', label: 'Drive', icon: Car, profile: 'driving-car' },
  { id: 'bike', label: 'Bike', icon: Bike, profile: 'cycling-regular' },
  { id: 'pedestrian', label: 'Walk', icon: PersonStanding, profile: 'foot-hiking' },
];

const ORS_PROFILE_MAP = {
  'car_fast': 'driving-car',
  'bike': 'cycling-regular',
  'pedestrian': 'foot-hiking'
};

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

export default function NavigationPanel({ from, to, toLabel, onClose, onRouteReady, onRouteData, userPosition }) {
  const [routeType, setRouteType] = useState('car_fast');
  const [route, setRoute] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [turnMarkers, setTurnMarkers] = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const lastSpokenStep = useRef(-1);
  const routeDebounceTimer = useRef(null);
  const lastFetchedCoords = useRef(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (routeDebounceTimer.current) {
        clearTimeout(routeDebounceTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!from || !to) return;
    
    // Check if coordinates have actually changed (not just object reference)
    const currentCoords = JSON.stringify({ from, to });
    if (lastFetchedCoords.current === currentCoords) {
      console.log('Same coordinates, skipping fetch');
      return;
    }
    
    // Show loading immediately while debouncing
    setLoading(true);
    
    // Debounce route fetching to avoid rate limiting
    if (routeDebounceTimer.current) {
      clearTimeout(routeDebounceTimer.current);
    }
    
    routeDebounceTimer.current = setTimeout(() => {
      lastFetchedCoords.current = currentCoords;
      fetchRoute();
      setSelectedRouteIdx(0);
    }, 500); // 500ms debounce to prevent rapid API calls
    
    return () => {
      if (routeDebounceTimer.current) {
        clearTimeout(routeDebounceTimer.current);
      }
    };
  }, [from, to]);

  useEffect(() => {
    // Notify parent of route data and current user position for map display
    if (onRouteData) {
      onRouteData({
        coordinates: routeCoordinates,
        turns: turnMarkers,
        currentStep: currentStep,
        userPos: userPosition
      });
    }
  }, [routeCoordinates, turnMarkers, currentStep, userPosition]);

  useEffect(() => {
    if (!userPosition || steps.length === 0 || !isNavigating) return;
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const dist = Math.hypot(
        (step.lat || to.lat) - userPosition[0],
        (step.lng || to.lng) - userPosition[1]
      ) * 111000;
      
      if (dist < 50 && i !== lastSpokenStep.current) {
        lastSpokenStep.current = i;
        setCurrentStep(i);
        speakStep(step, true);
        break;
      }
    }
  }, [userPosition, steps, isNavigating]);

  useEffect(() => {
    if (userPosition && route && routeCoordinates.length > 0) {
      const userLat = userPosition[0];
      const userLng = userPosition[1];
      const destLat = to.lat;
      const destLng = to.lng;
      
      const distToDestination = Math.hypot(
        destLat - userLat,
        destLng - userLng
      ) * 111000;
      
      if (distToDestination < 100) {
        console.log('Approaching destination:', formatDist(distToDestination));
      }
    }
  }, [userPosition, to, routeCoordinates]);

  const updateRouteDisplay = (routes, routeIdx) => {
    const selectedRoute = routes[routeIdx];
    if (!selectedRoute) {
      console.error('No route at index', routeIdx);
      return;
    }
    
    if (!selectedRoute.geometry || selectedRoute.geometry.length === 0) {
      console.error('Selected route has no geometry');
      return;
    }
    
    setRouteCoordinates(selectedRoute.geometry);
    
    let navTurns = [];
    let markers = [];
    
    if (selectedRoute.steps && selectedRoute.steps.length > 0) {
      const result = transformStepsToTurns(selectedRoute.steps);
      navTurns = result.turns || [];
      markers = result.turnMarkers || [];
      console.log('Transformed to', navTurns.length, 'turns');
    } else {
      console.warn('Route has no steps, creating default');
      navTurns = [
        {
          instruction: 'Head towards your destination',
          distance: selectedRoute.distance || 0,
          type: 'depart'
        },
        {
          instruction: 'Arrive at destination',
          distance: 0,
          type: 'arrive'
        }
      ];
    }
    
    setSteps(navTurns);
    setTurnMarkers(markers);
    setRoute({
      properties: {
        distance: selectedRoute.distance,
        duration: selectedRoute.duration
      }
    });
    setLoading(false);
  };

  const fetchRoute = async () => {
    setLoading(true);
    setIsNavigating(false);
    setSteps([]);
    setAllRoutes([]);
    
    const profile = ORS_PROFILE_MAP[routeType] || 'driving-car';
    console.log('Fetching route with ORS:', { from, to, profile });
    
    try {
      const result = await getDirectionsRoute(from, to, profile);
      console.log('ORS Route result:', result);
      
      if (!result || !result.geometry || result.geometry.length === 0) {
        throw new Error('No route geometry returned');
      }
      
      if (!result.steps || result.steps.length === 0) {
        console.warn('No steps in route, creating minimal route');
        result.steps = [{
          instruction: 'Navigate to destination',
          distance: result.distance || 0,
          type: 'depart',
          lat: to.lat,
          lng: to.lng
        }];
      }
      
      const routes = [result];
      setAllRoutes(routes);
      updateRouteDisplay(routes, 0);
      
      if (onRouteReady) onRouteReady(result);
    } catch (err) {
      console.error('Route fetch error:', err.message);
      setLoading(false);
    }
  };

  const startNavigation = () => {
    setIsNavigating(true);
    lastSpokenStep.current = -1;
    
    console.log('Starting navigation, steps:', steps);
    
    if (steps.length > 0) {
      setCurrentStep(0);
      setTimeout(() => {
        speakStep(steps[0]);
      }, 100);
    }
  };

  const speakStep = (step, isAuto = false) => {
    if (!step) {
      console.log('No step to speak');
      return;
    }
    
    console.log('Speaking step:', step, 'muted:', muted);
    
    if (muted) return;
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      let text;
      if (isAuto) {
        text = step.instruction;
      } else {
        text = `In ${formatDist(step.distance)}, ${step.instruction}`;
      }
      
      console.log('Speaking:', text);
      
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'en-US';
      utt.rate = 0.95;
      utt.pitch = 1.0;
      
      utt.onerror = (e) => console.log('Speech error:', e);
      utt.onend = () => console.log('Speech ended');
      
      window.speechSynthesis.speak(utt);
    } else {
      console.log('Speech synthesis not available');
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

  // Pre-navigation screen - show route overview
  if (!isNavigating) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[1500] pointer-events-none">
        <div className="bg-white rounded-t-3xl shadow-2xl px-4 pt-4 pb-6 pointer-events-auto mx-3 mb-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <p className="text-sm text-gray-500 font-medium">Navigating to</p>
              <p className="font-bold text-gray-900 text-lg truncate">{toLabel}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-gray-100 ml-3">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          {loading ? (
            <div className="py-8 text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-500">Calculating route...</p>
            </div>
          ) : steps.length > 0 ? (
            <>
              {allRoutes.length > 1 && (
                <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
                  {allRoutes.map((r, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedRouteIdx(idx);
                        updateRouteDisplay(allRoutes, idx);
                      }}
                      className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
                        ${selectedRouteIdx === idx 
                          ? 'bg-blue-500 text-white shadow-md' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      Route {idx + 1}: {formatDist(r.distance)} • {formatTime(r.duration)}
                    </button>
                  ))}
                </div>
              )}
              
              <div className="flex items-center justify-center gap-8 mb-4 py-3 bg-gray-50 rounded-xl">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatDist(route?.properties?.distance || 0)}
                  </p>
                  <p className="text-xs text-gray-500">Distance</p>
                </div>
                <div className="w-px h-10 bg-gray-300"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatTime(route?.properties?.duration || 0)}
                  </p>
                  <p className="text-xs text-gray-500">Duration</p>
                </div>
              </div>
              
              <div className="flex gap-2 mb-4">
                {ROUTE_TYPES.map(rt => {
                  const Icon = rt.icon;
                  return (
                    <button
                      key={rt.id}
                      onClick={() => setRouteType(rt.id)}
                      className={`flex-1 py-2 rounded-xl flex flex-col items-center gap-0.5 transition-colors text-xs font-semibold
                        ${routeType === rt.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      <Icon className="w-4 h-4" />
                      {rt.label}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={startNavigation}
                className="w-full py-4 bg-blue-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:bg-blue-600 active:scale-98 transition-all"
              >
                <CircleArrowRight className="w-6 h-6" />
                Start Navigation
              </button>
            </>
          ) : (
            <p className="text-center text-gray-400 py-4">
              No route found
              <button 
                onClick={fetchRoute} 
                className="block mx-auto mt-2 text-blue-500 text-sm underline"
              >
                Try again
              </button>
            </p>
          )}
        </div>
      </div>
    );
  }

  // Active navigation screen
  return (
    <div className="fixed inset-x-0 bottom-0 z-[1500] pointer-events-none">
      {step && (
        <div className="mx-3 mb-2 bg-blue-600 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-4 pointer-events-auto">
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <TurnIcon className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-tight truncate">{step.instruction}</p>
            <p className="text-blue-200 text-sm">{formatDist(step.distance)}</p>
          </div>
          <button 
            onClick={() => setMuted(m => !m)} 
            className="p-2 rounded-xl bg-blue-500 flex-shrink-0"
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      )}
      
      <div className="bg-white rounded-t-3xl shadow-2xl px-4 pt-4 pb-8 pointer-events-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-gray-500 font-medium">Navigating to</p>
            <p className="font-bold text-gray-900 truncate max-w-[200px]">{toLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            {route && (
              <div className="text-right">
                <p className="font-bold text-gray-900 text-sm">
                  {formatDist(route.properties?.distance || 0)}
                </p>
                <p className="text-xs text-gray-500">
                  {formatTime(route.properties?.duration || 0)}
                </p>
              </div>
            )}
            <button onClick={onClose} className="p-2 rounded-full bg-gray-100">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
        
        {steps.length > 1 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => goToStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-3 py-2 rounded-xl bg-gray-100 disabled:opacity-30 text-sm font-medium"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-500">
              {currentStep + 1} / {steps.length}
            </span>
            <button
              onClick={() => goToStep(Math.min(steps.length - 1, currentStep + 1))}
              disabled={currentStep === steps.length - 1}
              className="px-3 py-2 rounded-xl bg-gray-100 disabled:opacity-30 text-sm font-medium"
            >
              Next →
            </button>
          </div>
        )}
        
        {steps.length <= 1 && (
          <div className="text-center py-2">
            <p className="text-xs text-gray-400">
              {steps.length === 1 ? 'Single step route' : 'No detailed steps available'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

