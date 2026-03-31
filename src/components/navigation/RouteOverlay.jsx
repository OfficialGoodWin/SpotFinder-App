import React from 'react';
import { Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

export default function RouteOverlay({ routeCoordinates, turnMarkers, currentStep }) {
  if (!routeCoordinates?.length || routeCoordinates.length === 0) {
    return null;
  }

  const getTurnIcon = (type, isCurrentStep) => {
    // Determine arrow color based on road color
    // For white roads: use gray arrows
    // For green roads: use white arrows
    const getArrowSVG = () => {
      const arrowColor = type === 'road-white' ? '#666666' : '#ffffff';
      
      if (type === 'turn-left') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${arrowColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7l-10 10M7 7l10 10"/></svg>`;
      } else if (type === 'turn-right') {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${arrowColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M17 17L7 7"/></svg>`;
      } else {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${arrowColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
      }
    };

    const bgColor = isCurrentStep ? 'bg-primary shadow-lg ring-2 ring-primary/50' : 'bg-primary/80';
    
    const iconHtml = `
      <div class="flex items-center justify-center w-8 h-8 rounded-full ${bgColor} text-xl font-bold transition-all duration-200 border-2 border-white">
        ${getArrowSVG()}
      </div>
    `;

    return L.divIcon({
      html: iconHtml,
      className: 'turn-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });
  };

  return (
    <>
      {/* Blue polyline for the route */}
      <Polyline
        positions={routeCoordinates}
        color="#3b82f6"
        weight={5}
        opacity={0.85}
        lineCap="round"
        lineJoin="round"
      />

      {/* Turn markers with directional icons */}
      {turnMarkers.map((marker, idx) => {
        if (!marker.lat || !marker.lng) return null;
        const isCurrentStep = idx === currentStep;
        
        return (
          <Marker
            key={`turn-${idx}`}
            position={[marker.lat, marker.lng]}
            icon={getTurnIcon(marker.type, isCurrentStep)}
          >
            <Popup>{marker.instruction}</Popup>
          </Marker>
        );
      })}
    </>
  );
}

