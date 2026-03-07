import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, User, MapPin, List, Navigation2, Crosshair, LogOut, Trash2 } from 'lucide-react';
import { getPublicSpots, createSpot, deleteSpot } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';

import SpotMarker from '../components/map/SpotMarker';
import UserLocationMarker from '../components/map/UserLocationMarker';
import MapLayerSwitcher from '../components/map/MapLayerSwitcher';
import SearchBar from '../components/map/SearchBar';
import AddSpotModal from '../components/spots/AddSpotModal';
import SpotDetailModal from '../components/spots/SpotDetailModal';
import NavigationPanel from '../components/navigation/NavigationPanel';
import AuthModal from '../components/auth/AuthModal';
import MySpotsPanel from '../components/spots/MySpotsPanel';

// Note: Leaflet marker icons are fixed via src/lib/leaflet-fix.js

const TILE_URLS = {
  basic: `https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${import.meta.env.VITE_MAPY_API_KEY}`,
  outdoor: `https://api.mapy.com/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=${import.meta.env.VITE_MAPY_API_KEY}`,
  aerial: `https://api.mapy.com/v1/maptiles/aerial/256/{z}/{x}/{y}?apikey=${import.meta.env.VITE_MAPY_API_KEY}`,
  winter: `https://api.mapy.com/v1/maptiles/winter/256/{z}/{x}/{y}?apikey=${import.meta.env.VITE_MAPY_API_KEY}`,
};

// Map controller component
function MapController({ flyTo, setMapRef }) {
  const map = useMap();
  useEffect(() => { setMapRef(map); }, [map]);
  useEffect(() => {
    if (flyTo) map.flyTo(flyTo, 15, { duration: 1 });
  }, [flyTo]);
  return null;
}

// Click handler for adding spot
function MapClickHandler({ addMode, onMapClick }) {
  useMapEvents({
    click: (e) => {
      if (addMode) onMapClick(e.latlng);
    }
  });
  return null;
}

export default function Home() {
  const { user, logout, isAuthenticated } = useAuth();
  const [spots, setSpots] = useState([]);
  const [mapLayer, setMapLayer] = useState('basic');
  const [userPos, setUserPos] = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(null);
  const [addMode, setAddMode] = useState(false);
  const [pendingLatlng, setPendingLatlng] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [navTarget, setNavTarget] = useState(null);
  const [flyTo, setFlyTo] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showMySpots, setShowMySpots] = useState(false);
  const [showNearbySpots, setShowNearbySpots] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteSpotId, setDeleteSpotId] = useState(null);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [routeSteps, setRouteSteps] = useState(null);
  const [turnMarkers, setTurnMarkers] = useState(null);
  const mapRef = useRef(null);

  // Load spots
  useEffect(() => {
    getPublicSpots(200).then(setSpots).catch(console.error);
  }, []);

  // Track if we've centered to user location once
  const hasCenteredToUser = useRef(false);

  // Draw route polyline on map with turn indicators
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing route layer if any
    mapRef.current.eachLayer((layer) => {
      if (layer.options && (layer.options.routeLayer || layer.options.turnMarker)) {
        mapRef.current.removeLayer(layer);
      }
    });

    if (routePolyline && routePolyline.length > 0) {
      const polyline = L.polyline(routePolyline, {
        color: '#3b82f6',
        weight: 5,
        opacity: 0.8,
        routeLayer: true
      });
      polyline.addTo(mapRef.current);

      // Add turn indicators along the route
      // Use exact turnMarker coordinates if available, otherwise calculate from routeSteps
      if (turnMarkers && turnMarkers.length > 0) {
        turnMarkers.forEach((marker) => {
          const turnIcons = {
            'turn-left': '↙',
            'turn-right': '↘',
            'slight-left': '↖',
            'slight-right': '↗',
            'turn-sharp-left': '↙',
            'turn-sharp-right': '↘',
            'uturn': '↻',
            'straight': '↑',
            'depart': '→',
            'roundabout': '⭕',
            'default': '•'
          };

          const iconChar = turnIcons[marker.type] || turnIcons['default'];

          // Determine color: yellow for roundabouts, green for depart, red for regular turns
          let fillColor = '#ef4444'; // default red for turns
          if (marker.isRoundabout) fillColor = '#fbbf24'; // yellow
          else if (marker.type === 'depart') fillColor = '#10b981'; // green

          const circleMarker = L.circleMarker([marker.lat, marker.lng], {
            radius: 12,
            fillColor,
            color: 'white',
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.85,
            turnMarker: true
          });

          // Add label with turn icon
          const label = L.tooltip({
            permanent: true,
            direction: 'center',
            className: 'turn-indicator',
            offset: [0, 0]
          });
          label.setContent(`<span style="font-weight: bold; color: white; font-size: 14px;">${iconChar}</span>`);
          circleMarker.bindTooltip(label);

          // Add popup with turn info
          circleMarker.bindPopup(`
            <div style="font-size: 12px;">
              <strong>${marker.instruction}</strong>
            </div>
          `);

          circleMarker.addTo(mapRef.current);
        });
      } else if (routeSteps && routeSteps.length > 0) {
        // Fallback: calculate turn positions from route steps
        routeSteps.forEach((step, idx) => {
          // Skip arrival (last step)
          if (step.type === 'arrive') return;

          // Find the coordinate closest to the turn distance
          let turnCoord = null;
          const routeLength = routePolyline.length;

          // Calculate what percentage along the route this turn is
          let distanceCovered = 0;
          for (let i = 0; i < routeLength - 1; i++) {
            const segmentStart = routePolyline[i];
            const segmentEnd = routePolyline[i + 1];
            const segmentDist = Math.sqrt(
              Math.pow(segmentEnd[0] - segmentStart[0], 2) +
              Math.pow(segmentEnd[1] - segmentStart[1], 2)
            ) * 111000; // rough conversion to meters

            if (distanceCovered + segmentDist >= step.distance) {
              // This segment contains the turn
              const ratio = (step.distance - distanceCovered) / segmentDist;
              turnCoord = [
                segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * ratio,
                segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * ratio
              ];
              break;
            }
            distanceCovered += segmentDist;
          }

          if (turnCoord) {
            // Create a marker for the turn
            const turnIcons = {
              'turn-left': '↙',
              'turn-right': '↘',
              'slight-left': '↖',
              'slight-right': '↗',
              'turn-sharp-left': '↙',
              'turn-sharp-right': '↘',
              'uturn': '↻',
              'straight': '↑',
              'depart': '→',
              'roundabout': '⭕',
              'default': '•'
            };

            const iconChar = turnIcons[step.type] || turnIcons['default'];

            // Determine color
            let fillColor = '#ef4444'; // default red for turns
            if (step.type === 'roundabout') fillColor = '#fbbf24'; // yellow
            else if (step.type === 'depart') fillColor = '#10b981'; // green

            const marker = L.circleMarker(turnCoord, {
              radius: 12,
              fillColor,
              color: 'white',
              weight: 2,
              opacity: 0.9,
              fillOpacity: 0.85,
              turnMarker: true
            });

            // Add label with turn icon
            const label = L.tooltip({
              permanent: true,
              direction: 'center',
              className: 'turn-indicator',
              offset: [0, 0]
            });
            label.setContent(`<span style="font-weight: bold; color: white; font-size: 14px;">${iconChar}</span>`);
            marker.bindTooltip(label);

            // Add popup with turn info
            marker.bindPopup(`
              <div style="font-size: 12px;">
                <strong>${step.instruction}</strong><br/>
                <small>${Math.round(step.distance)}m</small>
              </div>
            `);

            marker.addTo(mapRef.current);
          }
        });
      }

      mapRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }
  }, [routePolyline, routeSteps, turnMarkers]);

  // Watch user location
  const requestLocationPermission = useCallback(async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    // Check permission status first using the Permissions API
    const checkPermission = async () => {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          return permissionStatus.state; // 'granted', 'denied', or 'prompt'
        } catch (e) {
          // Permissions API not supported, will use legacy method
          console.log('Permissions API not supported, using legacy method');
        }
      }
      return null; // Fallback to legacy method
    };

    const permissionState = await checkPermission();

    // If permission was previously denied, show helpful message
    if (permissionState === 'denied') {
      alert('Location access was denied. Please enable it in your device settings:\n\n' +
            '• iOS: Settings > Privacy & Security > Location Services > Safari/Websites\n' +
            '• Android: Settings > Location > Chrome > Permissions\n\n' +
            'Or tap the 🔒/📋 icon in your browser address bar to change permissions.');
      return;
    }

    // Request location - this will trigger the permission prompt if state is 'prompt' or null
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(newPos);
        setUserAccuracy(pos.coords.accuracy);
        
        // Auto-center map to user location
        if (!hasCenteredToUser.current) {
          hasCenteredToUser.current = true;
          setFlyTo(newPos);
        }
        
        // Start watching after getting initial position
        const wid = navigator.geolocation.watchPosition(
          (p) => {
            setUserPos([p.coords.latitude, p.coords.longitude]);
            setUserAccuracy(p.coords.accuracy);
          },
          (err) => console.warn('Watch error:', err.message),
          { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
        );
      },
      (error) => {
        console.warn('Geolocation error:', error.code, error.message);
        
        let errorMessage = '';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please tap the 🔒/📋 icon in your browser address bar to allow location access, or enable it in your device settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable. Please check if GPS is enabled on your device.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
          default:
            errorMessage = 'Unable to get location. Please try again.';
        }
        alert(errorMessage);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }, []);

  const handleMapClick = useCallback((latlng) => {
    setPendingLatlng(latlng);
    setAddMode(false);
  }, []);

  const handleSaveSpot = async (data) => {
    const spotData = {
      ...data,
      created_by: user?.email || 'anonymous'
    };
    const spot = await createSpot(spotData);
    setSpots(prev => [spot, ...prev]);
    setPendingLatlng(null);
  };

  const handleDeleteSpot = async (spot) => {
    await deleteSpot(spot.id);
    setSpots(prev => prev.filter(s => s.id !== spot.id));
    setSelectedSpot(null);
  };

  const handleNavigate = (spot) => {
    if (!userPos) return alert('Location not available yet');
    setNavTarget({ lat: spot.lat, lng: spot.lng, label: spot.title || 'Spot' });
    setSelectedSpot(null);
  };

  const handleSearchSelect = ({ lat, lng, label }) => {
    setFlyTo([lat, lng]);
    setTimeout(() => setFlyTo(null), 1000);
  };

  const showNearby = () => {
    if (!userPos) return alert('Enable location to find nearby spots');
    const nearby = spots
      .map(s => ({
        ...s,
        dist: Math.hypot(s.lat - userPos[0], s.lng - userPos[1])
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 1);
    if (nearby.length > 0) {
      setFlyTo([nearby[0].lat, nearby[0].lng]);
      setTimeout(() => { setSelectedSpot(nearby[0]); setFlyTo(null); }, 800);
    }
  };

  const handleSignOut = async () => {
    await logout();
  };

  const handleDeleteAccount = () => {
    if (deleteInput === 'DELETE') {
      // Note: This would need backend support to actually delete the account
      alert('Account deletion requires backend implementation. Please contact support.');
      setShowDeleteConfirm(false);
      setDeleteInput('');
    }
  };

  const mapCenter = userPos
    ? { lat: userPos[0], lng: userPos[1] }
    : { lat: 50.0755, lng: 14.4378 };

  return (
    <div className="relative w-full h-full" style={{ touchAction: addMode ? 'none' : undefined }}>
      {/* Cursor overlay in add mode */}
      {addMode && (
        <div
          className="absolute inset-0 z-[999] flex items-center justify-center pointer-events-none"
          style={{ cursor: 'crosshair' }}
        >
          <div className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg animate-pulse top-20 absolute">
            Tap on the map to place spot
          </div>
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url={TILE_URLS[mapLayer]}
          attribution='&copy; <a href="https://api.mapy.com/copyright" target="_blank">Seznam.cz a.s. a další</a>'
          maxZoom={19}
        />
        <MapController flyTo={flyTo} setMapRef={(m) => { mapRef.current = m; }} />
        <MapClickHandler addMode={addMode} onMapClick={handleMapClick} />

        {/* User location */}
        <UserLocationMarker position={userPos} accuracy={userAccuracy} />

        {/* Spot markers */}
        {spots.map(spot => (
          <SpotMarker
            key={spot.id}
            spot={spot}
            onClick={() => setSelectedSpot(spot)}
          />
        ))}
      </MapContainer>

      {/* Search bar */}
      <SearchBar 
        onSelect={handleSearchSelect} 
        mapCenter={mapCenter}
        onNavigate={(destination) => {
          if (!userPos) return alert('Location not available yet');
          setNavTarget(destination);
        }}
      />

      {/* Layer switcher */}
      <MapLayerSwitcher activeLayer={mapLayer} onLayerChange={setMapLayer} />

      {/* Center on user location */}
      <button
        onClick={() => {
          if (userPos) {
            setFlyTo([...userPos]);
          } else {
            requestLocationPermission();
          }
        }}
        className="absolute bottom-32 right-4 z-[1000] w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-200 active:scale-95 transition-transform"
      >
        <Crosshair className="w-5 h-5 text-gray-700" />
      </button>

      {/* Nearby spots button */}
      <button
        onClick={showNearby}
        className="absolute bottom-48 right-4 z-[1000] w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-200 active:scale-95 transition-transform"
        title="Show nearest spot"
      >
        <span className="text-xl leading-none">🚗🌲</span>
      </button>

      {/* Bottom bar */}
      <div className="absolute bottom-0 inset-x-0 z-[1000] flex items-center justify-between px-5 py-4 pb-8 bg-white/90 backdrop-blur-md border-t border-gray-200">
        {/* Profile / Auth - shows Account or Sign In */}
        {isAuthenticated && user ? (
          <div className="relative">
            <button
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              className="flex flex-col items-center gap-1 text-gray-600 active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                <span className="text-lg font-bold text-green-600">{user.displayName?.[0] || user.email?.[0] || '?'}</span>
                )}
              </div>
              <span className="text-xs font-medium">Account</span>
            </button>

            {/* Account dropdown menu */}
            {showAccountMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-40 bg-white rounded-2xl shadow-xl border border-gray-200 py-2">
                <button
                  onClick={() => { setShowMySpots(true); setShowAccountMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <List className="w-4 h-4" />
                  My Spots
                </button>
                <button
                  onClick={() => { handleSignOut(); setShowAccountMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
                <hr className="my-1 border-gray-100" />
                <button
                  onClick={() => { setShowDeleteConfirm(true); setShowAccountMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Account
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowAuth(true)}
            className="flex flex-col items-center gap-1 text-gray-600 active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">
              <User className="w-5 h-5 text-gray-500" />
            </div>
            <span className="text-xs font-medium">Sign In</span>
          </button>
        )}

        {/* Add Spot FAB - works without account */}
        <button
          onClick={() => {
            setAddMode(a => !a);
          }}
          className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95
            ${addMode ? 'bg-red-500 rotate-45 shadow-red-200' : 'bg-green-500 shadow-green-200'}`}
        >
          <Plus className="w-8 h-8 text-white" />
        </button>

        {/* Spots list button */}
        <button
          onClick={() => user ? setShowMySpots(true) : setShowAuth(true)}
          className="flex flex-col items-center gap-1 text-gray-600 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">
            <List className="w-5 h-5 text-gray-500" />
          </div>
          <span className="text-xs font-medium">List</span>
        </button>
      </div>

      {/* Modals */}
      {pendingLatlng && (
        <AddSpotModal
          latlng={pendingLatlng}
          onClose={() => setPendingLatlng(null)}
          onSave={handleSaveSpot}
        />
      )}

      {selectedSpot && (
        <SpotDetailModal
          spot={selectedSpot}
          user={user}
          onClose={() => setSelectedSpot(null)}
          onNavigate={handleNavigate}
          onEdit={() => { /* TODO: edit */ }}
          onDelete={() => setDeleteSpotId(selectedSpot.id)}
        />
      )}

      {navTarget && (
        <NavigationPanel
          from={{ lat: userPos[0], lng: userPos[1] }}
          to={{ lat: navTarget.lat, lng: navTarget.lng }}
          toLabel={navTarget.label}
          onClose={() => { setNavTarget(null); setRoutePolyline(null); setRouteSteps(null); setTurnMarkers(null); }}
          onRouteReady={(route) => { setRoutePolyline(route.routeGeometry); setRouteSteps(route.steps); setTurnMarkers(route.turnMarkers); }}
          userPosition={{ lat: userPos[0], lng: userPos[1] }}
        />
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}

      {showMySpots && isAuthenticated && user && (
        <MySpotsPanel
          user={user}
          onClose={() => setShowMySpots(false)}
          onFlyTo={(pos) => setFlyTo(pos)}
        />
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete Account</h3>
            </div>
            
            <p className="text-gray-600 text-sm mb-4">
              This action cannot be undone. All your data will be permanently deleted.
            </p>
            
            <p className="text-gray-500 text-xs mb-4">
              Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm:
            </p>
            
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-300 text-sm mb-4"
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'DELETE'}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Spot Confirmation Modal */}
      {deleteSpotId && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete Spot</h3>
            </div>
            
            <p className="text-gray-600 text-sm mb-4">
              Are you sure you want to delete this spot? This action cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteSpotId(null)}
                className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await deleteSpot(deleteSpotId);
                  setSpots(prev => prev.filter(s => s.id !== deleteSpotId));
                  setSelectedSpot(null);
                  setDeleteSpotId(null);
                }}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop for account menu */}
      {showAccountMenu && (
        <div 
          className="fixed inset-0 z-[999]"
          onClick={() => setShowAccountMenu(false)}
        />
      )}
    </div>
  );
}
