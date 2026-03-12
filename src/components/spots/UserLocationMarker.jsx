import React from 'react';
import { Marker, Circle } from 'react-leaflet';
import L from 'leaflet';

const userIcon = L.divIcon({
  html: `
    <div style="
      width:22px;height:22px;
      background:white;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
    ">
      <div style="
        width:12px;height:12px;
        background:#3B82F6;
        border-radius:50%;
      "></div>
    </div>
  `,
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function UserLocationMarker({ position, accuracy }) {
  if (!position) return null;
  return (
    <>
      {accuracy && (
        <Circle
          center={position}
          radius={accuracy}
          pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.08, weight: 1 }}
        />
      )}
      {/* zIndexOffset 9000 puts GPS dot above all spot markers and traffic icons */}
      <Marker position={position} icon={userIcon} zIndexOffset={9000} />
    </>
  );
}
