import React, { useEffect, useState } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation } from 'lucide-react';

// Create custom icon for POI markers
const createPOIIcon = (emoji, color) => {
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
        font-size: 18px;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      ">
        ${emoji}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

export default function POILayer({ category, onNavigate }) {
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(false);
  const map = useMap();

  useEffect(() => {
    if (!category) {
      setPois([]);
      return;
    }

    const loadPOIs = async () => {
      const zoom = map.getZoom();
      
      // Check if current zoom level is appropriate for this category
      if (zoom < category.minZoom) {
        setPois([]);
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
              name: element.tags?.name || category.name,
              address: element.tags?.['addr:street'] 
                ? `${element.tags['addr:street']} ${element.tags['addr:housenumber'] || ''}` 
                : '',
              tags: element.tags
            };
          }
          return null;
        }).filter(Boolean);

        setPois(poiList);
        setLoading(false);
      } catch (error) {
        console.error('Error loading POIs:', error);
        setLoading(false);
      }
    };

    loadPOIs();

    // Reload POIs when map moves
    const handleMoveEnd = () => {
      loadPOIs();
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
    };
  }, [category, map]);

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
              <p style={{ margin: '4px 0', fontSize: '13px', color: '#666' }}>
                Category: {category.name}
              </p>
              <button
                onClick={() => onNavigate({ lat: poi.lat, lng: poi.lon, label: poi.name })}
                style={{
                  marginTop: '10px',
                  padding: '8px 16px',
                  background: '#007bff',
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
