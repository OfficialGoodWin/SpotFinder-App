import React from "react";
import 'leaflet/dist/leaflet.css';

export default function Layout({ children }) {
  return (
    <div style={{ height: '100dvh', width: '100vw', overflow: 'hidden', position: 'fixed', top: 0, left: 0 }}>
      {children}
    </div>
  );
}