import React, { useEffect, useState, useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { POI_ICON_MAP } from '@/lib/POICategories';

// Helper function to get SVG paths for icons (no emoji, pure SVG)
function getIconSVG(iconName) {
  const paths = {
    school: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path>',
    restaurant: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path>',
    cafe: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"></path><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path><line x1="6" x2="6" y1="2" y2="4"></line><line x1="10" x2="10" y1="2" y2="4"></line><line x1="14" x2="14" y1="2" y2="4"></line>',
    shop: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path>',
    supermarket: '<circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>',
    wc: '<rect width="14" height="6" x="5" y="16" rx="2"></rect><rect width="10" height="6" x="7" y="2" rx="2"></rect><path d="M22 12h-2"></path><path d="M4 12H2"></path>',
    bank: '<path d="m16 6 4 14"></path><path d="M12 6v14"></path><path d="M8 8v12"></path><path d="M4 4v16"></path>',
    atm: '<rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" x2="22" y1="10" y2="10"></line>',
    pharmacy: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"></path><path d="m8.5 8.5 7 7"></path>',
    hospital: '<path d="M12 6v4"></path><path d="M14 14h-4"></path><path d="M14 18h-4"></path><path d="M14 8h-4"></path><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"></path><path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"></path>',
    parking: '<circle cx="12" cy="12" r="10"></circle><path d="M9 17V7h4a3 3 0 0 1 0 6H9"></path>',
    fuel: '<path d="M3 22h12"></path><path d="M4 9h10"></path><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"></path><path d="m14 13 5.5-5.5a2.12 2.12 0 0 1 3 3L17 16v6"></path><path d="M14 13h6"></path>',
    charging: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"></path>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle>',
  };
  return paths[iconName] || '<circle cx="12" cy="12" r="10"></circle><path d="M12 8v8"></path><path d="M8 12h8"></path>';
}

// Create custom icon for POI markers using pure SVG (no emojis)
const createPOIIcon = (iconName, color) => {
  const svgPath = getIconSVG(iconName);
  
  return L.divIcon({
    className: 'custom-poi-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${svgPath}
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

export default function POILayer({ category, onNavigate, onPOIsLoaded }) {
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(false);
  const map = useMap();
  const loadTimeoutRef = useRef(null);

  useEffect(() => {
    if (!category) {
      setPois([]);
      if (onPOIsLoaded) onPOIsLoaded([]);
      return;
    }

    const loadPOIs = async () => {
      const zoom = map.getZoom();
      
      // Check if current zoom level is appropriate for this category
      if (zoom < category.minZoom) {
        setPois([]);
        if (onPOIsLoaded) onPOIsLoaded([]);
        return;
      }

      setLoading(true);
      const bounds = map.getBounds();
      const south = bounds.getSouth();
      const west = bounds.getWest();
      const north = bounds.getNorth();
      const east = bounds.getEast();

      // Overpass API query
      const query = `
        [out:json][timeout:25];
        (
          node["${category.osmTag}"](${south},${west},${north},${east});
          way["${category.osmTag}"](${south},${west},${north},${east});
          relation["${category.osmTag}"](${south},${west},${north},${east});
        );
        out center;
      `;

      try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query
        });

        const data = await response.json();
        
        const poiList = data.elements.map(element => {
          const lat = element.lat || element.center?.lat;
          const lon = element.lon || element.center?.lon;
          
          if (lat && lon) {
            return {
              id: element.id,
              lat,
              lon,
              name: element.tags?.name || category.name.en,
              address: element.tags?.['addr:street'] 
                ? `${element.tags['addr:street']} ${element.tags['addr:housenumber'] || ''}` 
                : '',
              tags: element.tags
            };
          }
          return null;
        }).filter(Boolean);

        setPois(poiList);
        if (onPOIsLoaded) onPOIsLoaded(poiList);
        setLoading(false);
      } catch (error) {
        console.error('Error loading POIs:', error);
        setLoading(false);
        setPois([]);
        if (onPOIsLoaded) onPOIsLoaded([]);
      }
    };

    // Debounce POI loading to avoid too many requests
    clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(loadPOIs, 500);

    // Reload POIs when map moves or zooms
    const handleMoveEnd = () => {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = setTimeout(loadPOIs, 500);
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
      clearTimeout(loadTimeoutRef.current);
    };
  }, [category, map, onPOIsLoaded]);

  if (!category) return null;

  return (
    <>
      {pois.map(poi => (
        <Marker 
          key={poi.id} 
          position={[poi.lat, poi.lon]}
          icon={createPOIIcon(category.icon, category.color)}
        >
          <Popup>
            <div style={{ minWidth: '200px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>
                {poi.name}
              </h3>
              {poi.address && (
                <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>
                  📍 {poi.address}
                </p>
              )}
              <button
                onClick={() => onNavigate({ lat: poi.lat, lng: poi.lon, label: poi.name })}
                style={{
                  marginTop: '10px',
                  padding: '8px 16px',
                  background: category.color,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  width: '100%'
                }}
              >
                Navigate Here
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}