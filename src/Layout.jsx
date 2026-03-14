import React from "react";
import 'leaflet/dist/leaflet.css';

export default function Layout({ children, currentPageName }) {
  // The map page needs overflow:hidden + position:fixed to prevent rubber-band
  // scrolling on mobile and keep the map full-screen.
  // All other pages (FAQ, etc.) need normal document flow so they can scroll.
  const isMapPage = !currentPageName || currentPageName === 'Home';

  if (isMapPage) {
    return (
      <div style={{ height: '100dvh', width: '100vw', overflow: 'hidden', position: 'fixed', top: 0, left: 0 }}>
        {children}
      </div>
    );
  }

  // Non-map pages: let the browser handle scrolling normally
  return (
    <div style={{ minHeight: '100dvh', width: '100%', overflowX: 'hidden' }}>
      {children}
    </div>
  );
}
