import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, User, Settings, Crosshair, LogOut, Trash2, List } from 'lucide-react';
import { getPublicSpots, createSpot, deleteSpot } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

import SpotMarker from '../components/map/SpotMarker';
import UserLocationMarker from '../components/map/UserLocationMarker';
import MapLayerSwitcher from '../components/map/MapLayerSwitcher';
import SearchBar from '../components/map/SearchBar';
import AddSpotModal from '../components/spots/AddSpotModal';
import SpotDetailModal from '../components/spots/SpotDetailModal';
import NavigationPanel from '../components/navigation/NavigationPanel';
import RouteOverlay from '../components/navigation/RouteOverlay';
import AuthModal from '../components/auth/AuthModal';
import MySpotsPanel from '../components/spots/MySpotsPanel';
import SettingsModal from '../components/SettingsModal';

// Note: Leaflet marker icons are fixed via src/lib/leaflet-fix.js

const MAPY_API_KEY = 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';

const TILE_URLS = {
  basic:   `https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
  outdoor: `https://api.mapy.com/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
  aerial:  `https://api.mapy.com/v1/maptiles/aerial/256/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
  winter:  `https://api.mapy.com/v1/maptiles/winter/256/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
  // roads-focused tile — shows road names & numbers prominently
  traffic: `https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
};

// Layers where the dark CSS filter should NOT be applied (aerial looks wrong inverted)
const NO_DARK_FILTER_LAYERS = new Set(['aerial']);

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
  const { isDark } = useTheme();
  const [spots, setSpots] = useState([]);
  const [mapLayer, setMapLayer] = useState('basic');
  // Apply dark CSS filter when dark mode is on, except for aerial/satellite
  const mapDarkMode = isDark && !NO_DARK_FILTER_LAYERS.has(mapLayer);
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
  const [showSettings, setShowSettings] = useState(false);
  const [navRouteData, setNavRouteData] = useState({ coordinates: [], turns: [], currentStep: 0 });
  const [deleteInput, setDeleteInput] = useState('');
  const mapRef = useRef(null);

  console.log('[Home] Component mounted');

  // Load spots
  useEffect(() => {
    getPublicSpots(200).then(setSpots).catch(console.error);
  }, []);

  // Track if we've centered to user location once
  const hasCenteredToUser = useRef(false);
  const geolocationTimeoutRef = useRef(null);

  // Watch user location
  useEffect(() => {
    if (!navigator.geolocation) return;

    // Set timeout to allow app to work without geolocation (e.g., if permission denied on mobile)
    geolocationTimeoutRef.current = setTimeout(() => {
      console.warn('Geolocation timeout - proceeding without location');
      if (!hasCenteredToUser.current) {
        hasCenteredToUser.current = true;
        // Use default Prague location
        setFlyTo([50.0755, 14.4378]);
      }
    }, 5000); // 5 second timeout

    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        // Clear timeout on successful location
        if (geolocationTimeoutRef.current) {
          clearTimeout(geolocationTimeoutRef.current);
          geolocationTimeoutRef.current = null;
        }
        const newPos = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(newPos);
        setUserAccuracy(pos.coords.accuracy);
        
        // Auto-center map to user location on first position
        if (!hasCenteredToUser.current) {
          hasCenteredToUser.current = true;
          setFlyTo(newPos);
        }
      },
      (error) => {
        // Handle geolocation errors
        console.warn('Geolocation error:', error.message);
        if (geolocationTimeoutRef.current) {
          clearTimeout(geolocationTimeoutRef.current);
          geolocationTimeoutRef.current = null;
        }
        // Continue without location if permission denied or unavailable
        if (!hasCenteredToUser.current) {
          hasCenteredToUser.current = true;
          setFlyTo([50.0755, 14.4378]); // Default to Prague
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => {
      navigator.geolocation.clearWatch(wid);
      if (geolocationTimeoutRef.current) {
        clearTimeout(geolocationTimeoutRef.current);
      }
    };
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
    <div className={`relative w-full h-full${mapDarkMode ? ' map-dark' : ''}`} style={{ touchAction: addMode ? 'none' : undefined }}>
      {/* Cursor overlay in add mode */}
      {addMode && (
        <div
          className="absolute inset-0 z-[999] flex items-center justify-center pointer-events-none"
          style={{ cursor: 'crosshair' }}
        >
          <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg animate-pulse top-20 absolute">
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
          attribution='&copy; <a href="https://mapy.com">Mapy.cz</a>'
          maxZoom={20}
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

        {/* Route overlay during navigation */}
        {navTarget && navRouteData.coordinates.length > 0 && (
          <RouteOverlay
            routeCoordinates={navRouteData.coordinates}
            turnMarkers={navRouteData.turns}
            currentStep={navRouteData.currentStep}
          />
        )}
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
        onClick={() => userPos && setFlyTo([...userPos])}
        className="absolute bottom-32 right-4 z-[1000] w-11 h-11 bg-white dark:bg-card rounded-full shadow-lg flex items-center justify-center border border-gray-200 dark:border-border active:scale-95 transition-transform"
      >
        <Crosshair className="w-5 h-5 text-gray-700" />
      </button>

      {/* Nearby spots button */}
      <button
        onClick={showNearby}
        className="absolute bottom-48 right-4 z-[1000] w-11 h-11 bg-white dark:bg-card rounded-full shadow-lg flex items-center justify-center border border-gray-200 dark:border-border active:scale-95 transition-transform"
        title="Show nearest spot"
      >
        <span className="text-xl leading-none">🚗🌲</span>
      </button>

      {/* Bottom bar */}
      <div className="absolute bottom-0 inset-x-0 z-[1000] flex items-center justify-between px-5 py-4 pb-8 bg-background/90 backdrop-blur-md border-t border">
        {/* Profile / Auth - shows Account or Sign In */}
        {isAuthenticated && user ? (
          <div className="relative">
            <button
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              className="flex flex-col items-center gap-1 text-gray-600 active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-blue-500">{user.displayName?.[0] || user.email?.[0] || '?'}</span>
                )}
              </div>
              <span className="text-xs font-medium">Account</span>
            </button>

            {/* Account dropdown menu */}
            {showAccountMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-40 bg-white dark:bg-card rounded-2xl shadow-xl border border-gray-200 dark:border-border py-2">
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

        {/* Add Spot FAB */}
        <button
          onClick={() => {
            if (!user) {
              setShowAuth(true);
              return;
            }
            setAddMode(a => !a);
          }}
          className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95
            ${addMode ? 'bg-red-500 rotate-45 shadow-red-200' : 'bg-blue-500 shadow-blue-200'}`}
        >
          <Plus className="w-8 h-8 text-white" />
        </button>

        {/* Spots list button -> Settings button */}
        <button
          onClick={() => setShowSettings(true)}
          className="flex flex-col items-center gap-1 text-gray-600 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 bg-gray-100 rounded-2xl flex items-center justify-center">
            <Settings className="w-5 h-5 text-gray-500" />
          </div>
          <span className="text-xs font-medium">Settings</span>
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
          onDelete={() => handleDeleteSpot(selectedSpot)}
        />
      )}

      {navTarget && userPos && (
        <NavigationPanel
          from={{ lat: userPos[0], lng: userPos[1] }}
          to={{ lat: navTarget.lat, lng: navTarget.lng }}
          toLabel={navTarget.label}
          onClose={() => setNavTarget(null)}
          onRouteReady={() => {}}
          onRouteData={(data) => setNavRouteData(data)}
          userPosition={userPos}
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

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-card w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-foreground">Delete Account</h3>
            </div>
            
            <p className="text-gray-600 dark:text-muted-foreground text-sm mb-4">
              This action cannot be undone. All your data will be permanently deleted.
            </p>
            
            <p className="text-gray-500 dark:text-muted-foreground text-xs mb-4">
              Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm:
            </p>
            
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-red-300 text-sm mb-4"
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                className="flex-1 py-3 rounded-2xl border-2 border-gray-200 dark:border-border text-gray-600 dark:text-foreground font-semibold text-sm hover:bg-gray-50 dark:hover:bg-accent"
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
