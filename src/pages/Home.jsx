import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Settings, Crosshair, HelpCircle, Trash2 } from 'lucide-react';
import { getPublicSpots, createSpot, deleteSpot, updateSpot } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';
 
import SpotMarker from '../components/map/SpotMarker';
import UserLocationMarker from '../components/map/UserLocationMarker';
import MapLayerSwitcher from '../components/map/MapLayerSwitcher';
import SearchBar from '../components/map/SearchBar';
import AddSpotModal from '../components/spots/AddSpotModal';
import EditSpotModal from '../components/spots/EditSpotModal';
import SpotDetailModal from '../components/spots/SpotDetailModal';
import NavigationPanel from '../components/navigation/NavigationPanel';
import RouteOverlay from '../components/navigation/RouteOverlay';
import RoadClosureLayer from '../components/map/RoadClosureLayer';
import AuthModal from '../components/auth/AuthModal';
import MySpotsPanel from '../components/spots/MySpotsPanel';
import AdBanner from '../components/AdBanner';
import SpotsPanel from '../components/spots/SpotsPanel';
import SettingsModal from '../components/SettingsModal';
import ProfileMenu from '../components/ProfileMenu';
 
// Note: Leaflet marker icons are fixed via src/lib/leaflet-fix.js
 
const MAPY_API_KEY = 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';
 
// ── TomTom API key for real-time traffic overlay ────────────────────────────
// Sign up free at https://developer.tomtom.com — 2,500 req/day on free tier.
// Paste your key below; traffic overlay is silently disabled without it.
const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || '';
 
// ── Base tile URLs ────────────────────────────────────────────────────────────
// Light tiles (default)
// Mapy.cz: use 512px tiles + zoomOffset=-1 for crisp HiDPI rendering.
// Leaflet requests z-1 tiles at 512px and fills one 256-CSS-pixel slot,
// meaning you always get richer detail (one zoom level ahead) downscaled
// rather than coarser tiles upscaled — eliminates blur at every zoom level.
const MAPY_TILE_PROPS = { tileSize: 512, zoomOffset: -1 };

const LIGHT_TILES = {
  basic:   `https://api.mapy.com/v1/maptiles/basic/512/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
  outdoor: `https://api.mapy.com/v1/maptiles/outdoor/512/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
  aerial:  `https://api.mapy.com/v1/maptiles/aerial/512/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
  winter:  `https://api.mapy.com/v1/maptiles/winter/512/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
  traffic: `https://api.mapy.com/v1/maptiles/basic/512/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
};
 
// Dark tiles — CartoDB Dark Matter (free, no API key required)
// aerial stays as Mapy.cz (inverted satellite looks terrible), winter keeps its own style
const DARK_TILES = {
  basic:   'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  outdoor: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  aerial:  `https://api.mapy.com/v1/maptiles/aerial/512/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
  winter:  `https://api.mapy.com/v1/maptiles/winter/512/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
  traffic: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
 
// ── TomTom traffic flow overlay ───────────────────────────────────────────────
// Overlaid on top of ANY base layer when mapLayer === 'traffic'
// Green = free flow  |  Yellow = slow  |  Red = heavy congestion
// TomTom traffic tile URL — 256px tiles load ~4× faster than 512px,
// have better browser cache hit rate, and avoid ERR_FAILED on slow connections.
// We use 'relative' style (proportional width coloring) which renders cleaner at zoom <14.
const TRAFFIC_OVERLAY_URL = TOMTOM_API_KEY
  ? `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`
  : null;

// Second TomTom subdomain mirror — round-robin between a/b/c/d to parallelise requests
// Leaflet's {s} subdomain syntax picks randomly from the subdomains array per tile
const TRAFFIC_OVERLAY_URL_SUB = TOMTOM_API_KEY
  ? `https://{s}.api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`
  : null;
 
// Map controller component
function MapController({ flyTo, fitBoundsData, zoomToArea, setMapRef }) {
  const map = useMap();
  useEffect(() => { setMapRef(map); }, [map]);
  useEffect(() => {
    if (flyTo) map.flyTo(flyTo, 15, { duration: 1 });
  }, [flyTo]);
  useEffect(() => {
    if (fitBoundsData && fitBoundsData.length >= 2) {
      map.fitBounds(fitBoundsData, { padding: [60, 60], animate: true, duration: 1.2 });
    }
  }, [fitBoundsData]);
  useEffect(() => {
    if (zoomToArea) {
      // Zoom to current position at ~40km radius visible (zoom 9)
      if (zoomToArea.center) map.flyTo(zoomToArea.center, 9, { duration: 1.2 });
      else map.setZoom(9);
    }
  }, [zoomToArea]);
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
  const { t, language } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [spots, setSpots] = useState([]);
  const [mapLayer, setMapLayer] = useState('basic');
  // Select the right tile set based on dark mode
  const tileUrls = isDark ? DARK_TILES : LIGHT_TILES;
  // CartoDB needs subdomains; Mapy.cz does not
  const cartoDomains = ['a', 'b', 'c', 'd'];
  const useCartoTile = isDark && mapLayer !== 'aerial' && mapLayer !== 'winter';
  const [userPos, setUserPos] = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(null);
  const [addMode, setAddMode] = useState(false);
  const [pendingLatlng, setPendingLatlng] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [editingSpot, setEditingSpot] = useState(null);
  const [navTarget, setNavTarget] = useState(null);
  const [navFrom, setNavFrom] = useState(null); // snapshot of start position, never changes mid-nav
  const [flyTo, setFlyTo] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showMySpots, setShowMySpots] = useState(false);
  const [showNearbySpots, setShowNearbySpots] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [navRouteData, setNavRouteData] = useState({ coordinates: [], turns: [], currentStep: 0 });
  const [showSpots, setShowSpots] = useState(false);
  const [fitBoundsData, setFitBoundsData] = useState(null);
  const [zoomToArea, setZoomToArea] = useState(null);
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
    const spot = await createSpot(data);
    setSpots(prev => [spot, ...prev]);
    setPendingLatlng(null);
  };

  // Deep-link: ?spot=<id> opens that spot detail
  const deepLinkProcessed = React.useRef(false);
  React.useEffect(() => {
    if (deepLinkProcessed.current) return;
    const params = new URLSearchParams(window.location.search);
    const spotId = params.get('spot');
    if (!spotId) return;
    deepLinkProcessed.current = true;
    const tryOpen = (retries = 0) => {
      setSpots(current => {
        const found = current.find(s => s.id === spotId);
        if (found) {
          setSelectedSpot(found);
          setFlyTo([found.lat, found.lng]);
          setTimeout(() => setFlyTo(null), 1200);
          window.history.replaceState({}, '', window.location.pathname);
        } else if (retries < 10) {
          setTimeout(() => tryOpen(retries + 1), 600);
        }
        return current;
      });
    };
    setTimeout(() => tryOpen(), 800);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
 
  const handleDeleteSpot = async (spot) => {
    await deleteSpot(spot.id);
    setSpots(prev => prev.filter(s => s.id !== spot.id));
    setSelectedSpot(null);
  };

  const handleEditSpot = async (updatedSpot) => {
    await updateSpot(updatedSpot.id, updatedSpot);
    setSpots(prev => prev.map(s => s.id === updatedSpot.id ? updatedSpot : s));
    setEditingSpot(null);
    setSelectedSpot(null);
  };
 
  const handleNavigate = (spot) => {
    if (!userPos) return alert(t('home.locationUnavailable'));
    startNavTo({ lat: spot.lat, lng: spot.lng, label: spot.title || 'Spot' });
    setSelectedSpot(null);
  };
 
  const handleSearchSelect = ({ lat, lng, label }) => {
    setFlyTo([lat, lng]);
    setTimeout(() => setFlyTo(null), 1000);
  };
 
  const showNearby = () => {
    if (!userPos) return alert(t('home.enableLocation'));
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
 
  // Stable nav start — set both target and snapshot from-position together
  const startNavTo = (destination) => {
    if (!userPos) return alert(t('home.locationUnavailable'));
    setNavFrom({ lat: userPos[0], lng: userPos[1] });
    setNavTarget(destination);
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
          <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg animate-pulse top-20 absolute">
            {t('home.tapToPlace')}
          </div>
        </div>
      )}
 
      {/* Map */}
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={13}
        minZoom={3}
        maxZoom={20}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={true}
        wheelPxPerZoomLevel={80}
        zoomSnap={0.5}
        zoomDelta={0.5}
        wheelDebounceTime={40}
        touchZoom={true}
        bounceAtZoomLimits={false}
        preferCanvas={true}
      >
        {/* Base map tile */}
        <TileLayer
          key={`${mapLayer}-${isDark}`}
          url={tileUrls[mapLayer]}
          subdomains={useCartoTile ? cartoDomains : []}
          attribution={useCartoTile
            ? '&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
            : '&copy; <a href="https://mapy.com">Mapy.cz</a>'}
          {...(!useCartoTile ? MAPY_TILE_PROPS : {})}
          maxZoom={20}
          maxNativeZoom={useCartoTile ? 19 : 18}
          keepBuffer={4}
          updateWhenIdle={false}
          updateWhenZooming={true}
          crossOrigin="anonymous"
          errorTileUrl="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        />
 
        {/* TomTom real-time traffic flow overlay (only on traffic layer) */}
        {mapLayer === 'traffic' && TRAFFIC_OVERLAY_URL_SUB && (
          <TileLayer
            key="traffic-overlay"
            url={TRAFFIC_OVERLAY_URL_SUB}
            subdomains={['a','b','c','d']}
            tileSize={256}
            opacity={0.60}
            maxZoom={20}
            maxNativeZoom={18}
            zIndex={200}
            keepBuffer={4}
            updateWhenIdle={false}
            updateWhenZooming={true}
            crossOrigin="anonymous"
            errorTileUrl="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          />
        )}
        {/* Road closure markers — shown on traffic layer when TomTom key is set */}
        <RoadClosureLayer
          apiKey={TOMTOM_API_KEY}
          enabled={mapLayer === 'traffic'}
          lang={language}
          t={t}
        />
 
        <MapController flyTo={flyTo} fitBoundsData={fitBoundsData} zoomToArea={zoomToArea} setMapRef={(m) => { mapRef.current = m; }} />
        <MapClickHandler addMode={addMode} onMapClick={handleMapClick} />
 
        {/* User location */}
        <UserLocationMarker position={userPos} accuracy={userAccuracy} />
 
        {/* Spot markers — only shown when showSpots is enabled */}
        {showSpots && spots.map(spot => (
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
        showSpots={showSpots}
        onToggleSpots={() => setShowSpots(v => !v)}
        onNavigate={(destination) => {
          if (!userPos) return alert(t('home.locationUnavailable'));
          startNavTo(destination);
        }}
      />
 
      {/* Profile menu — top right */}
      <ProfileMenu
        user={user}
        isAuthenticated={isAuthenticated}
        showMenu={showAccountMenu}
        onToggleMenu={() => setShowAccountMenu(v => !v)}
        onShowMySpots={() => setShowMySpots(true)}
        onSignOut={handleSignOut}
        onShowDeleteConfirm={() => setShowDeleteConfirm(true)}
        onShowAuth={() => setShowAuth(true)}
      />

      {/* Spots toggle — sits between search bar and layer switcher */}
      <SpotsPanel
        spots={spots}
        userPos={userPos}
        showSpots={showSpots}
        onToggleSpots={() => setShowSpots(v => !v)}
        onZoomToArea={() => {
          const center = userPos ? { lat: userPos[0], lng: userPos[1] } : null;
          setZoomToArea({ center, ts: Date.now() });
          setTimeout(() => setZoomToArea(null), 200);
        }}
        onFlyTo={(pos) => { setFlyTo(pos); setTimeout(() => setFlyTo(null), 1000); }}
        onNavigate={(spot) => {
          if (!userPos) return alert(t('home.locationUnavailable'));
          startNavTo({ lat: spot.lat, lng: spot.lng, label: spot.title || 'Spot' });
        }}
        onSelectSpot={setSelectedSpot}
      />
 
 

 
 
 
      {/* Bottom bar */}
      <div className="absolute bottom-0 inset-x-0 z-[1000]">
        {/* FAB — green + floating above bar */}
        <div className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none" style={{ bottom: '100%', marginBottom: '-36px' }}>
          <button
            onClick={() => setAddMode(a => !a)}
            className={`w-[72px] h-[72px] rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 pointer-events-auto
              ${addMode ? 'bg-red-500 rotate-45 shadow-red-300' : 'bg-green-500 shadow-green-300'}`}
          >
            <Plus className="w-9 h-9 text-white" />
          </button>
        </div>

        {/* Bar row */}
        <div className="flex items-center px-4 pt-2 pb-5 bg-background/95 backdrop-blur-md border-t border gap-2">
          {/* Left: Layers + Location */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <MapLayerSwitcher activeLayer={mapLayer} onLayerChange={setMapLayer} />
            <button
              onClick={() => userPos && setFlyTo([...userPos])}
              className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-accent/60 flex items-center justify-center text-gray-600 dark:text-foreground hover:bg-gray-200 dark:hover:bg-accent active:scale-95 transition-all"
              title="Center location"
            >
              <Crosshair className="w-5 h-5" />
            </button>
          </div>

          {/* Center: Ad banner */}
          <div className="flex-1 min-w-0 mx-1">
            <AdBanner />
          </div>

          {/* Right: FAQ + Settings */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/faq')}
              className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-accent/60 flex items-center justify-center text-gray-600 dark:text-foreground hover:bg-gray-200 dark:hover:bg-accent active:scale-95 transition-all"
              title="FAQ"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-accent/60 flex items-center justify-center text-gray-600 dark:text-foreground hover:bg-gray-200 dark:hover:bg-accent active:scale-95 transition-all"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {pendingLatlng && (
        <AddSpotModal
          latlng={pendingLatlng}
          onClose={() => setPendingLatlng(null)}
          onSave={handleSaveSpot}
          user={user}
        />
      )}
 
      {selectedSpot && !editingSpot && (
        <SpotDetailModal
          spot={selectedSpot}
          user={user}
          onClose={() => setSelectedSpot(null)}
          onNavigate={handleNavigate}
          onEdit={() => { setEditingSpot(selectedSpot); setSelectedSpot(null); }}
          onDelete={() => handleDeleteSpot(selectedSpot)}
          onSpotUpdate={(updated) => {
            setSpots(prev => prev.map(s => s.id === updated.id ? updated : s));
            setSelectedSpot(updated);
          }}
        />
      )}

      {editingSpot && (
        <EditSpotModal
          spot={editingSpot}
          onClose={() => setEditingSpot(null)}
          onSave={handleEditSpot}
        />
      )}
 
      {navTarget && navFrom && (
        <NavigationPanel
          from={navFrom}
          to={{ lat: navTarget.lat, lng: navTarget.lng }}
          toLabel={navTarget.label}
          onClose={() => { setNavTarget(null); setNavFrom(null); }}
          onRouteReady={() => {}}
          onRouteData={(data) => {
            setNavRouteData(data);
            // Fit map to show full route
            if (data.coordinates && data.coordinates.length >= 2) {
              setFitBoundsData([...data.coordinates]);
              setTimeout(() => setFitBoundsData(null), 300);
            }
          }}
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
              <h3 className="text-lg font-bold text-gray-900 dark:text-foreground">{t('home.deleteAccountTitle')}</h3>
            </div>
            
            <p className="text-gray-600 dark:text-muted-foreground text-sm mb-4">
              {t('home.deleteAccountWarning')}
            </p>
            
            <p className="text-gray-500 dark:text-muted-foreground text-xs mb-4">
              {t('home.deleteAccountType')}
            </p>
            
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={t('home.deleteAccountPlaceholder')}
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
                {t('home.deleteAccountConfirm')}
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