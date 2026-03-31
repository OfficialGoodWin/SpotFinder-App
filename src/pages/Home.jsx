import React, { useState, useEffect, useRef, useCallback } from 'react';

import { Plus, Settings, Crosshair, HelpCircle, Trash2, WifiOff, Sparkles } from 'lucide-react';
import SubscriptionModal from '../components/SubscriptionModal';
import { getPublicSpots, createSpot, deleteSpot, updateSpot, getAdminPOIs, getAdminClosures, getAdminERouteOverrides, getAdminRoadOverrides } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';
 
import MapLayerSwitcher from '../components/map/MapLayerSwitcher';
import ZoomSlider from '../components/map/ZoomSlider';
import SearchBar from '../components/map/SearchBar';
import MapLibreMap from '../components/map/MapLibreMap';
import SuperAdminEditor from '../components/map/SuperAdminEditor';
import AddSpotModal from '../components/spots/AddSpotModal';
import EditSpotModal from '../components/spots/EditSpotModal';
import SpotDetailModal from '../components/spots/SpotDetailModal';
import NavigationPanel from '../components/navigation/NavigationPanel';
import AuthModal from '../components/auth/AuthModal';
import MySpotsPanel from '../components/spots/MySpotsPanel';

import SpotsPanel from '../components/spots/SpotsPanel';
import POIPanel from '../components/spots/POIPanel';
import POIDetailPanel from '../components/spots/POIDetailPanel';
import SettingsModal from '../components/SettingsModal';
import ProfileMenu from '../components/ProfileMenu';
import OfflineMapsMenu from '../components/offline/OfflineMapsMenu';
import { getAllMeta } from '../lib/offlineStorage.js';
 
// Note: Leaflet marker icons are fixed via src/lib/leaflet-fix.js
 
export default function Home() {
  const { user, logout, isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [spots, setSpots] = useState([]);
  const [mapLayer, setMapLayer] = useState('basic');
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
  const [showSubscription, setShowSubscription] = useState(false);
  const [showOffline, setShowOffline] = useState(false);
  const [offlineMeta, setOfflineMeta] = useState({});

  // Load offline metadata once on mount
  useEffect(() => {
    getAllMeta().then(setOfflineMeta);
  }, []);
  const [navRouteData, setNavRouteData] = useState({ coordinates: [], turns: [], currentStep: 0 });
  const [showSpots, setShowSpots] = useState(false);
  const [fitBoundsData, setFitBoundsData] = useState(null);
  const [zoomToArea, setZoomToArea] = useState(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [selectedPOICategory, setSelectedPOICategory] = useState(null);
  const [currentPOIs, setCurrentPOIs] = useState([]);
  const [showPOIPanel, setShowPOIPanel] = useState(false);
  const [selectedPOI, setSelectedPOI] = useState(null);
  const [selectedPOIDirectCat, setSelectedPOIDirectCat] = useState(null);
  const [poiLoading, setPoiLoading] = useState(false);

  // ── Superadmin editor state ────────────────────────────────────────────────
  const isSuperAdmin = user?.email === 'superadmin@spotfinder.cz';
  const [showAdminEditor, setShowAdminEditor] = useState(false);
  const [adminPOIs, setAdminPOIs] = useState([]);
  const [adminClosures, setAdminClosures] = useState([]);
  const [adminNavMode, setAdminNavMode] = useState(false);
  const [adminERouteOverrides, setAdminERouteOverrides] = useState([]);
  const [adminRoadOverrides, setAdminRoadOverrides] = useState([]);
  const adminMapClickRef = useRef(null);

  // Load admin map data for all users (POIs, closures, E-route markers visible to everyone)
  useEffect(() => {
    getAdminPOIs().then(setAdminPOIs);
    getAdminClosures().then(setAdminClosures);
    getAdminERouteOverrides().then(setAdminERouteOverrides);
    getAdminRoadOverrides().then(setAdminRoadOverrides);
  }, []);
  const mapRef = useRef(null);
 
 
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
 
    // Fallback center after 15s if geolocation is slow or denied
    geolocationTimeoutRef.current = setTimeout(() => {
      if (!hasCenteredToUser.current) {
        hasCenteredToUser.current = true;
        setFlyTo([50.0755, 14.4378]);
      }
    }, 15000);
 
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
 
      {/* Map — MapLibre GL: online=vector tiles from R2, offline=local PMTiles */}
      <MapLibreMap
        center={mapCenter}
        flyTo={flyTo}
        fitBoundsData={fitBoundsData}
        zoomToArea={zoomToArea}
        setMapRef={(m) => { mapRef.current = m; }}
        addMode={addMode}
        onMapClick={handleMapClick}
        spots={spots}
        showSpots={showSpots}
        onSelectSpot={setSelectedSpot}
        userPos={userPos}
        userAccuracy={userAccuracy}
        selectedPOICategory={selectedPOICategory}
        onSelectPOI={(poi, cat) => {
          if (cat) {
            // Direct ambient dot click — store category just for the detail panel,
            // do NOT set selectedPOICategory (that would trigger a full category load)
            setSelectedPOIDirectCat(cat);
          } else {
            setSelectedPOIDirectCat(null);
          }
          setSelectedPOI(poi);
        }}
        onPOIsLoaded={(pois) => setCurrentPOIs(pois)}
        onLoadingChange={(loading) => setPoiLoading(loading)}
        navTarget={navTarget}
        navRouteData={navRouteData}
        isDark={isDark}
        mapLayer={mapLayer}
        adminPOIs={adminPOIs}
        adminClosures={adminClosures}
        adminNavMode={adminNavMode}
        adminERouteOverrides={adminERouteOverrides}
        adminRoadOverrides={adminRoadOverrides}
        onAdminMapClick={(coords) => { adminMapClickRef.current?.(coords); }}
      />
 
      {/* Search bar */}
      <SearchBar
        onSelect={handleSearchSelect}
        mapCenter={mapCenter}
        showSpots={showSpots}
        onToggleSpots={() => setShowSpots(v => !v)}
        spots={spots}
        onSelectSpot={(spot) => {
          setSelectedSpot(spot);
          setFlyTo([spot.lat, spot.lng]);
          setTimeout(() => setFlyTo(null), 1000);
        }}
        onNavigate={(destination) => {
          if (!userPos) return alert(t('home.locationUnavailable'));
          startNavTo(destination);
        }}
        onSelectCategory={(category) => {
          setSelectedPOICategory(category);
          setShowPOIPanel(true);
          if (mapRef.current) {
            const center = mapRef.current.getCenter();
            const zoom   = mapRef.current.getZoom();
            if (zoom < 14) mapRef.current.flyTo({ center, zoom: 14, duration: 800 });
          }
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
 
 

 
 
 
      {/* Zoom half-circle slider — right edge */}
      <ZoomSlider mapRef={mapRef} />

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

        {/* Controls row */}
        <div className="flex items-center px-4 gap-2 bg-background/95 backdrop-blur-md border-t border" style={{ height: 56, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
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

          {/* Spacer for FAB */}
          <div className="flex-1" />

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
            {isSuperAdmin && (
              <button
                onClick={() => setShowAdminEditor(v => !v)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all text-base ${showAdminEditor ? 'bg-red-100 dark:bg-red-900/40 text-red-600' : 'bg-gray-100 dark:bg-accent/60 text-gray-600 dark:text-foreground hover:bg-gray-200 dark:hover:bg-accent'}`}
                title="Map Editor (Superadmin)"
              >
                🛠️
              </button>
            )}
            <button
              onClick={() => setShowOffline(true)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all relative
                ${Object.keys(offlineMeta).length > 0
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60'
                  : 'bg-gray-100 dark:bg-accent/60 text-gray-600 dark:text-foreground hover:bg-gray-200 dark:hover:bg-accent'}`}
              title="Offline Maps"
            >
              <WifiOff className="w-5 h-5" />
              {Object.keys(offlineMeta).length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
              )}
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

      {showOffline && (
        <OfflineMapsMenu
          onClose={() => { setShowOffline(false); getAllMeta().then(setOfflineMeta); }}
        />
      )}
 
      {showMySpots && isAuthenticated && user && (
        <MySpotsPanel
          user={user}
          onClose={() => setShowMySpots(false)}
          onFlyTo={(pos) => setFlyTo(pos)}
        />
      )}

      {showPOIPanel && selectedPOICategory && (
        <POIPanel
          pois={currentPOIs}
          category={selectedPOICategory}
          userPos={userPos}
          loading={poiLoading}
          onFlyTo={(pos) => setFlyTo(pos)}
          onNavigate={(poi) => {
            if (!userPos) return alert(t('home.locationUnavailable'));
            startNavTo({ lat: poi.lat, lng: poi.lon, label: poi.name });
          }}
          onSelect={(poi) => setSelectedPOI(poi)}
          onClose={() => { setShowPOIPanel(false); setSelectedPOICategory(null); setSelectedPOI(null); }}
        />
      )}

      {selectedPOI && (selectedPOIDirectCat || selectedPOICategory) && (
        <POIDetailPanel
          poi={selectedPOI}
          category={selectedPOIDirectCat || selectedPOICategory}
          user={user}
          onClose={() => { setSelectedPOI(null); setSelectedPOIDirectCat(null); if (!showPOIPanel) setSelectedPOICategory(null); }}
          onNavigate={(destination) => {
            if (!userPos) return alert(t('home.locationUnavailable'));
            startNavTo(destination);
          }}
        />
      )}
 
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {isSuperAdmin && showAdminEditor && (
        <SuperAdminEditor
          user={user}
          onClose={() => setShowAdminEditor(false)}
          onAdminDataChange={({ handleMapClick, adminNavMode: mode }) => {
            adminMapClickRef.current = (coords) => {
              handleMapClick(coords);
              // Refresh lists after a short delay so new item shows up
              setTimeout(() => {
                getAdminPOIs().then(setAdminPOIs);
                getAdminClosures().then(setAdminClosures);
                getAdminERouteOverrides().then(setAdminERouteOverrides);
                getAdminRoadOverrides().then(setAdminRoadOverrides);
              }, 800);
            };
            setAdminNavMode(mode);
          }}
        />
      )}

      {showSubscription && (
        <SubscriptionModal
          onClose={() => setShowSubscription(false)}
          user={user}
        />
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