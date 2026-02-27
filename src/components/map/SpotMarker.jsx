import React from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';

const TYPE_CONFIG = {
  parking: { emoji: '🅿️', bg: '#3B82F6', label: 'Parking' },
  food: { emoji: '🍽️', bg: '#22C55E', label: 'Eat' },
  toilet: { emoji: '🚽', bg: '#F97316', label: 'Toilet' },
};

function createSpotIcon(type) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.parking;
  return L.divIcon({
    html: `
      <div style="
        width:36px;height:36px;
        background:${cfg.bg};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
        border:2px solid white;
      ">
        <span style="transform:rotate(45deg);font-size:16px;line-height:1;">${cfg.emoji}</span>
      </div>
    `,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

export default function SpotMarker({ spot, onClick }) {
  return (
    <Marker
      position={[spot.lat, spot.lng]}
      icon={createSpotIcon(spot.spot_type)}
      eventHandlers={{ click: onClick }}
    />
  );
}