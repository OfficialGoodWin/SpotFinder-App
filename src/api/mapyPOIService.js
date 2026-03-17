import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, Image, Star, Clock, Phone, Globe, ChevronRight } from 'lucide-react';
import { smartPOISearch, enrichPOIWithDetails, getPlaceDetails } from '@/api/mapyPOIService';

// Create custom icon for POI markers
const createPOIIcon = (emoji, color, size = 32) => {
  return L.divIcon({
    className: 'custom-poi-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${size * 0.56}px;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: transform 0.15s ease;
      " class="poi-marker">
        ${emoji}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
};

// Create larger icon for important POIs at low zoom
const createImportantPOIIcon = (emoji, color) => {
  return createPOIIcon(emoji, color, 40);
};

export default function POILayer({ category, onNavigate }) {
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPOI, setSelectedPOI] = useState(null);
  const [poiDetails, setPoiDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const map = useMap();
  const abortControllerRef = useRef(null);
  const lastSearchRef = useRef(null);

  // Load POIs with smart zoom handling
  const loadPOIs = useCallback(async (forceRefresh = false) => {
    if (!category) {
      setPois([]);
      return;
    }

    const zoom = map.getZoom();
    
    // Check if current zoom level is appropriate for this category
    if (zoom < category.minZoom) {
      setPois([]);
      return;
    }

    // Create a search key to avoid duplicate searches
    const bounds = map.getBounds();
    const searchKey = `${category.name}-${zoom.toFixed(0)}-${bounds.toBBoxString()}`;
    
    // Skip if same search was just made
    if (!forceRefresh && lastSearchRef.current === searchKey) {
      return;
    }
    lastSearchRef.current = searchKey;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);

    try {
      const center = map.getCenter();
      
      // Use smart POI search that adapts to zoom level
      const results = await smartPOISearch({
        bounds: {
          south: bounds.getSouth(),
          west: bounds.getWest(),
          north: bounds.getNorth(),
          east: bounds.getEast()
        },
        center: { lat: center.lat, lng: center.lng },
        zoom,
        category,
        lang: 'en' // Could be dynamic based on user language
      });

      // Only update if this request wasn't aborted
      if (!abortControllerRef.current.signal.aborted) {
        setPois(results);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading POIs:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [category, map]);

  // Initial load and category change
  useEffect(() => {
    if (!category) {
      setPois([]);
      return;
    }

    loadPOIs(true);

    // Debounced reload on map movement
    let debounceTimer;
    const handleMoveEnd = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadPOIs(), 300);
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    return () => {
      clearTimeout(debounceTimer);
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [category, map, loadPOIs]);

  // Fetch POI details when selected
  const handlePOIClick = useCallback(async (poi) => {
    setSelectedPOI(poi);
    setPoiDetails(null);
    setLoadingDetails(true);

    try {
      const details = await enrichPOIWithDetails(poi);
      setPoiDetails(details);
    } catch (error) {
      console.warn('Could not load POI details:', error);
      setPoiDetails(poi); // Fall back to basic info
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  // Determine icon size based on zoom
  const getIconForZoom = useCallback((poi) => {
    const zoom = map.getZoom();
    const isImportant = poi.rating || poi.photo || poi.description;
    
    // Use larger icons for important POIs at low zoom
    if (zoom < 14 && isImportant) {
      return createImportantPOIIcon(category.icon, category.color);
    }
    
    return createPOIIcon(category.icon, category.color);
  }, [category, map]);

  if (!category) return null;

  const zoom = map.getZoom();
  const showPOIs = zoom >= category.minZoom;

  return (
    <>
      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-20 right-4 z-[1001] bg-white dark:bg-card px-3 py-1.5 rounded-full shadow-lg text-xs font-medium text-gray-600 dark:text-muted-foreground flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Loading {category.name}...
        </div>
      )}

      {/* Zoom hint when below minimum zoom */}
      {!showPOIs && category && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1001] bg-black/80 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
          🔍 Zoom in to see {category.name}
        </div>
      )}

      {/* POI Markers */}
      {showPOIs && pois.map(poi => (
        <Marker 
          key={poi.id} 
          position={[poi.lat, poi.lon || poi.lng]}
          icon={getIconForZoom(poi)}
          eventHandlers={{
            click: () => handlePOIClick(poi)
          }}
        >
          <Popup maxWidth={320} minWidth={280}>
            <div className="p-1">
              {/* Photo */}
              {(poiDetails?.photo || poi.photo) && (
                <div className="relative w-full h-32 -mt-1 -mx-1 mb-2 rounded-t-lg overflow-hidden">
                  <img 
                    src={poiDetails?.photo || poi.photo} 
                    alt={poi.name}
                    className="w-full h-full object-cover"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                  {poiDetails?.rating && (
                    <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded-full text-sm font-semibold flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                      {typeof poiDetails.rating === 'number' ? poiDetails.rating.toFixed(1) : poiDetails.rating}
                    </div>
                  )}
                </div>
              )}
              
              {/* Title */}
              <h3 className="text-base font-semibold text-gray-900 dark:text-foreground mb-1 line-clamp-2">
                {poi.name}
              </h3>
              
              {/* Category badge */}
              <div className="flex items-center gap-2 mb-2">
                <span 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: `${category.color}20`, color: category.color }}
                >
                  <span>{category.icon}</span>
                  {category.name}
                </span>
                {poiDetails?.priceLevel && (
                  <span className="text-xs text-gray-500">
                    {'💰'.repeat(poiDetails.priceLevel)}
                  </span>
                )}
              </div>

              {/* Address */}
              {poi.address && (
                <p className="text-sm text-gray-600 dark:text-muted-foreground mb-2 flex items-start gap-1.5">
                  <span className="text-base">📍</span>
                  <span className="line-clamp-2">{poi.address}</span>
                </p>
              )}

              {/* Description */}
              {(poiDetails?.description || poi.description) && (
                <p className="text-sm text-gray-600 dark:text-muted-foreground mb-2 line-clamp-3">
                  {poiDetails?.description || poi.description}
                </p>
              )}

              {/* Details */}
              {loadingDetails && (
                <div className="flex items-center justify-center py-3">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                </div>
              )}

              {/* Additional info */}
              {poiDetails && !loadingDetails && (
                <div className="space-y-1.5 mb-3">
                  {/* Opening hours */}
                  {poiDetails.openingHours && (
                    <p className="text-xs text-gray-500 dark:text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="truncate">{poiDetails.openingHours}</span>
                    </p>
                  )}
                  
                  {/* Phone */}
                  {poiDetails.phone && (
                    <p className="text-xs text-gray-500 dark:text-muted-foreground flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      <a href={`tel:${poiDetails.phone}`} className="text-blue-500 hover:underline truncate">
                        {poiDetails.phone}
                      </a>
                    </p>
                  )}
                  
                  {/* Website */}
                  {poiDetails.website && (
                    <p className="text-xs text-gray-500 dark:text-muted-foreground flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <a 
                        href={poiDetails.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline truncate max-w-[200px]"
                      >
                        {poiDetails.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    </p>
                  )}

                  {/* Rating */}
                  {poiDetails?.rating && !poiDetails.photo && (
                    <p className="text-sm text-gray-700 dark:text-foreground flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-medium">
                        {typeof poiDetails.rating === 'number' ? poiDetails.rating.toFixed(1) : poiDetails.rating}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {/* Navigate button */}
              <button
                onClick={() => {
                  onNavigate({ lat: poi.lat, lng: poi.lon || poi.lng, label: poi.name });
                }}
                className="w-full mt-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Navigation className="w-4 h-4" />
                Navigate Here
              </button>


            </div>
          </Popup>
        </Marker>
      ))}

      {/* Empty state */}
      {showPOIs && !loading && pois.length === 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] bg-white dark:bg-card px-4 py-3 rounded-xl shadow-lg text-center">
          <span className="text-2xl mb-1 block">{category.icon}</span>
          <p className="text-sm text-gray-600 dark:text-muted-foreground">
            No {category.name.toLowerCase()} found in this area
          </p>
          <p className="text-xs text-gray-400 dark:text-muted-foreground mt-1">
            Try zooming out or moving the map
          </p>
        </div>
      )}

      {/* Count indicator */}
      {showPOIs && !loading && pois.length > 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1001] bg-white/95 dark:bg-card/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg text-xs font-medium text-gray-600 dark:text-muted-foreground flex items-center gap-2">
          <span style={{ color: category.color }}>{category.icon}</span>
          {pois.length} {category.name.toLowerCase()} found
        </div>
      )}
    </>
  );
}
