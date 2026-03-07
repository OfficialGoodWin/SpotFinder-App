import React, { useState, useEffect, useRef } from 'react';
import { X, Car, Bike, PersonStanding, Volume2, VolumeX, ArrowLeft, ArrowRight, ArrowUp, CircleArrowRight } from 'lucide-react';

const ROUTE_TYPES = [
  { id: 'car_fast', label: 'Drive', icon: Car },
  { id: 'bike', label: 'Bike', icon: Bike },
  { id: 'pedestrian', label: 'Walk', icon: PersonStanding },
];

const MAPY_API_KEY = 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';

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
  default: ArrowUp,
};

export default function NavigationPanel({ from, to, toLabel, onClose, onRouteReady, userPosition: propUserPosition }) {
  const [routeType, setRouteType] = useState('car_fast');
  const [route, setRoute] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userPosition, setUserPosition] = useState(propUserPosition || null);
  const lastSpokenStep = useRef(-1);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by your browser");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.warn(`ERROR(${error.code}): ${error.message}`);
        if (error.code === error.PERMISSION_DENIED) {
          alert("Please allow location access in Safari settings to use navigation.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (from && to) fetchRoute();
  }, [from, to, routeType]);

  useEffect(() => {
    if (!userPosition || steps.length === 0 || !isNavigating) return;
    
    // Calculate distance from user to each step
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.distance < 50 && i !== lastSpokenStep.current) {
        lastSpokenStep.current = i;
        setCurrentStep(i);
        speakStep(step, true);
        break;
      }
    }
  }, [userPosition, steps, isNavigating]);

  const fetchRoute = async () => {
    setLoading(true);
    setIsNavigating(false);
    setSteps([]);
    
    const startStr = `${from.lng},${from.lat}`;
    const endStr = `${to.lng},${to.lat}`;
    const url = `https://api.mapy.com/v1/routing/route?apikey=${MAPY_API_KEY}&start=${startStr}&end=${endStr}&routeType=${routeType}&lang=en&format=geojson`;
    
    console.log('Fetching route:', url);
    
    try {
      const res = await fetch(url);
      const data = await res.json();
      console.log('Route response:', data);
      
      if (data.error) {
        console.error('Route API error:', data.error);
        setLoading(false);
        return;
      }
      
      setRoute(data);
      
      // Parse turns from GeoJSON format
      let turns = [];
      try {
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          if (feature.properties && feature.properties.segments) {
            for (const segment of feature.properties.segments) {
              if (segment.steps) {
                for (const step of segment.steps) {
                  const instruction = step.instruction || 
                    (step.maneuver?.instruction) || 
                    `${step.name || 'Continue'}`;
                  turns.push({
                    instruction: instruction,
                    distance: step.distance || 0,
                    type: step.maneuver?.type || 'straight',
                    name: step.name
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('Error parsing turns:', e);
      }
      
      // If no turns parsed, create a basic one
      if (turns.length === 0) {
        const dist = data.features?.[0]?.properties?.distance || 
                     data.properties?.distance || 0;
        turns = [{
          instruction: `Head to ${toLabel || 'destination'}`,
          distance: dist,
          type: 'straight'
        }];
      }
      
      console.log('Parsed turns:', turns);
      setSteps(turns);
      
      if (onRouteReady) onRouteReady(data);
    } catch (err) {
      console.error('Route fetch error:', err);
    }
    
    setLoading(false);
  };

  const startNavigation = () => {
    setIsNavigating(true);
    lastSpokenStep.current = -1;
    
    console.log('Starting navigation, steps:', steps);
    
    if (steps.length > 0) {
      setCurrentStep(0);
      // Small delay to ensure UI renders first
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
          
          {loading && steps.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-500">Calculating route...</p>
            </div>
          ) : steps.length > 0 ? (
            <>
              <div className="flex items-center justify-center gap-8 mb-4 py-3 bg-gray-50 rounded-xl">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatDist(route?.features?.[0]?.properties?.distance || route?.properties?.distance || steps[0]?.distance || 0)}
                  </p>
                  <p className="text-xs text-gray-500">Distance</p>
                </div>
                <div className="w-px h-10 bg-gray-300"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatTime(route?.features?.[0]?.properties?.duration || route?.properties?.duration || 0)}
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
              {route ? 'No turns found' : 'No route found'}
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
                  {formatDist(route.features?.[0]?.properties?.distance || route.properties?.distance || 0)}
                </p>
                <p className="text-xs text-gray-500">
                  {formatTime(route.features?.[0]?.properties?.duration || route.properties?.duration || 0)}
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
