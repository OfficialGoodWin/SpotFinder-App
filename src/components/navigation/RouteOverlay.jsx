import React from 'react';
import { Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

export default function RouteOverlay({ routeCoordinates, turnMarkers, currentStep }) {
  if (!routeCoordinates || routeCoordinates.length === 0) {
    return null;
  }

  const getTurnIcon = (type, isCurrentStep) => {
    const getArrowSVG = () => {
      if (type === 'turn-left') {
        return '↙️';
      } else if (type === 'turn-right') {
        return '↗️';
      } else {
        return '⬆️';
      }
    };

    const iconHtml = `
      <div class="flex items-center justify-center w-8 h-8 rounded-full ${
        isCurrentStep 
          ? 'bg-blue-500 shadow-lg ring-2 ring-blue-300' 
          : 'bg-blue-400'
      } text-xl font-bold transition-all duration-200 border-2 border-white">
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

