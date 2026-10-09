import React, { useState, useEffect, useRef, useCallback } from 'react';

import { Plus, Settings, Crosshair, HelpCircle, Trash2, MoreHorizontal } from 'lucide-react';
import { getPublicSpotsInBounds, getPublicSpotsNear, getPublicSpotById, createSpot, deleteSpot, updateSpot, getAdminPOIs, getAdminClosures, getAdminERouteOverrides, getAdminRoadOverrides, getDeletedAmbientPOIs, addDeletedAmbientPOI, addSocialPost } from '@/api/firebaseClient';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';
 
import MapLayerSwitcher from '../components/map/MapLayerSwitcher';
import SearchBar from '../components/map/SearchBar';
import MapLibreMap from '../components/map/MapLibreMap';
import ProfileMenu from '../components/ProfileMenu';

const SubscriptionModal = React.lazy(() => import('../components/SubscriptionModal'));
const SuperAdminEditor = React.lazy(() => import('../components/map/SuperAdminEditor'));
const AddSpotModal = React.lazy(() => import('../components/spots/AddSpotModal'));
const EditSpotModal = React.lazy(() => import('../components/spots/EditSpotModal'));
const SpotDetailModal = React.lazy(() => import('../components/spots/SpotDetailModal'));
const NavigationPanel = React.lazy(() => import('../components/navigation/NavigationPanel'));
const AuthModal = React.lazy(() => import('../components/auth/AuthModal'));
const MySpotsPanel = React.lazy(() => import('../components/spots/MySpotsPanel'));
const NearbySpotsPanel = React.lazy(() => import('../components/spots/NearbySpotsPanel'));
const POIPanel = React.lazy(() => import('../components/spots/POIPanel'));
const POIDetailPanel = React.lazy(() => import('../components/spots/POIDetailPanel'));
const SettingsModal = React.lazy(() => import('../components/SettingsModal'));
 
 
export default function Home() {
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [spots, setSpots] = useState([]);
  const [mapLayer, setMapLayer] = useState('basic');
  const [userPos, setUserPos] = useState(null);
  const [viewportCenter, setViewportCenter] = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(null);
  const [addMode, setAddMode] = useState(false);
  const [pendingLatlng, setPendingLatlng] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [editingSpot, setEditingSpot] = useState(null);
  const [navTarget, setNavTarget] = useState(null);
  const [isActivelyNavigating, setIsActivelyNavigating] = useState(false);
  const [navFrom, setNavFrom] = useState(null); // snapshot of start position, never changes mid-nav
  const [flyTo, setFlyTo] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showMySpots, setShowMySpots] = useState(false);
  const [showNearbySpots, setShowNearbySpots] = useState(false);
  const [nearbyFilters, setNearbyFilters] = useState({ maxDistance: 50, minRating: 0 }); // maxDistance may be Infinity (= unlimited)
  const [nearbySpots, setNearbySpots] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [terrainEnabled, setTerrainEnabled] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);

  const [navRouteData, setNavRouteData] = useState({ coordinates: [], turns: [], currentStep: 0 });
  const [showSpots, setShowSpots] = useState(true);
  const [fitBoundsData, setFitBoundsData] = useState(null);
  const [zoomToArea, setZoomToArea] = useState(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [selectedPOICategory, setSelectedPOICategory] = useState(null);
  const [currentPOIs, setCurrentPOIs] = useState([]);
  const [showPOIPanel, setShowPOIPanel] = useState(false);
  const [selectedPOI, setSelectedPOI] = useState(null);
  const [selectedPOIDirectCat, setSelectedPOIDirectCat] = useState(null);
  const [poiLoading, setPoiLoading] = useState(false);

  // ── Deleted ambient POIs (superadmin blocklist) ────────────────────────────
  const [deletedAmbientPOIIds, setDeletedAmbientPOIIds] = useState([]);
  useEffect(() => {
    getDeletedAmbientPOIs().then(docs => setDeletedAmbientPOIIds(docs.map(d => d.poiId)));
  }, []);

  const handleBlockAmbientPOI = async (poi) => {
    if (!user) return;
    const poiId = `${poi.lat?.toFixed(5)}_${poi.lon?.toFixed(5)}_${(poi.name || '').replace(/\s+/g, '_')}`;
    try {
      await addDeletedAmbientPOI(user, { poiId, name: poi.name || '', lat: poi.lat, lon: poi.lon });
      setDeletedAmbientPOIIds(prev => [...prev, poiId]);
    } catch (e) { console.error('Block POI failed:', e); }
  };

  // ── Superadmin editor state ────────────────────────────────────────────────
  const isSuperAdmin = isAdmin;
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
  const spotRefreshTimer = useRef(null);
  const moveEndMapRef = useRef(null);

  const refreshSpotsInViewport = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    setViewportCenter({ lat: center.lat, lng: center.lng });
    if (spotRefreshTimer.current) clearTimeout(spotRefreshTimer.current);
    spotRefreshTimer.current = setTimeout(async () => {
      try {
        const b = map.getBounds();
        const rows = await getPublicSpotsInBounds({
          south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast(),
        }, 500);
        setSpots(rows);
      } catch (err) {
        console.error('Failed to load visible spots:', err);
      }
    }, 120);
  }, []);

  const handleMapReady = useCallback((map) => {
    if (moveEndMapRef.current && moveEndMapRef.current !== map) {
      moveEndMapRef.current.off('moveend', refreshSpotsInViewport);
    }
    mapRef.current = map;
    moveEndMapRef.current = map;
    map.off('moveend', refreshSpotsInViewport);
    map.on('moveend', refreshSpotsInViewport);
    refreshSpotsInViewport();
  }, [refreshSpotsInViewport]);

  useEffect(() => () => {
    if (spotRefreshTimer.current) clearTimeout(spotRefreshTimer.current);
    moveEndMapRef.current?.off('moveend', refreshSpotsInViewport);
    moveEndMapRef.current = null;
  }, [refreshSpotsInViewport]);
 
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
 
  const handleSaveSpot = async (data, socialUrl = '') => {
    try {
      let spot = await createSpot(data);
      if (socialUrl) {
        try {
          await addSocialPost({ url: socialUrl, targetType: 'spot', targetId: String(spot.id), targetName: spot.title || 'Spot' });
          spot = { ...spot, has_social: true };
        } catch (socialError) {
          console.error('Spot saved but social post attachment failed:', socialError);
          toast.error('Spot saved, but the social post could not be attached. You can add it from the spot details.');
        }
      }
      setSpots(prev => [spot, ...prev]);
      setPendingLatlng(null);
      return spot;
    } catch (err) {
      console.error('Failed to create spot:', err);
      throw err; // AddSpotModal maps this to its inline, field-associated error UI.
    }
  };

  // Deep-link: ?spot=<id> opens that spot detail
  const deepLinkProcessed = React.useRef(false);
  React.useEffect(() => {
    if (deepLinkProcessed.current) return;
    const params = new URLSearchParams(window.location.search);
    const spotId = params.get('spot');
    if (!spotId) return;
    deepLinkProcessed.current = true;
    getPublicSpotById(spotId).then(found => {
      if (!found) return;
      setSpots(current => current.some(item => item.id === found.id) ? current : [...current, found]);
      setSelectedSpot(found);
      setFlyTo([found.lat, found.lng]);
      setTimeout(() => setFlyTo(null), 1200);
    }).catch(error => console.error('Could not open shared spot:', error));
  }, []);  
 
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

  const openNearby = useCallback(async (filters) => {
    if (!userPos) return alert(t('home.enableLocation'));
    setNearbyFilters(filters);
    setShowNearbySpots(true);
    setNearbyLoading(true);
    try {
      const rows = await getPublicSpotsNear(userPos, filters.maxDistance, 20);
      setNearbySpots(rows);
    } catch (error) {
      console.error('Failed to load nearby spots:', error);
      toast.error('Nearby spots could not be loaded. Please try again.');
    } finally {
      setNearbyLoading(false);
    }
  }, [userPos, t]);
 
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

  const mapCenter = viewportCenter || (userPos
    ? { lat: userPos[0], lng: userPos[1] }
    : { lat: 50.0755, lng: 14.4378 });
 
  return (
    <div className="relative w-full h-full" style={{ touchAction: addMode ? 'none' : undefined }}>
      <h1 className="sr-only">SpotFinder community map</h1>
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
 
      {/* Map — MapLibre GL, vector tiles streamed from R2 */}
      <MapLibreMap
        center={mapCenter}
        flyTo={flyTo}
        fitBoundsData={fitBoundsData}
        zoomToArea={zoomToArea}
        setMapRef={handleMapReady}
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
        onPOIsLoaded={(pois) => {
          setCurrentPOIs(pois);
        }}
        onLoadingChange={(loading) => setPoiLoading(loading)}
        navTarget={navTarget}
        navRouteData={navRouteData}
        isDark={isDark}
        mapLayer={mapLayer}
        terrainEnabled={terrainEnabled}
        adminPOIs={adminPOIs}
        adminClosures={adminClosures}
        adminNavMode={adminNavMode}
        adminERouteOverrides={adminERouteOverrides}
        adminRoadOverrides={adminRoadOverrides}
        onAdminMapClick={(coords) => { adminMapClickRef.current?.(coords); }}
        deletedAmbientPOIIds={deletedAmbientPOIIds}
      />
 
      {/* Search bar */}
      <SearchBar
        onSelect={handleSearchSelect}
        mapCenter={mapCenter}
        spots={spots}
        userPos={userPos}
        onNearby={openNearby}
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
          if (!userPos) {
            alert(t('search.enableLocation') || 'Enable location to search nearby places');
            return;
          }
          setSelectedPOICategory(category);
          setShowPOIPanel(true);
          if (mapRef.current) {
            const [lat, lng] = userPos;
            const radiusKm = 20;
            const latDelta = radiusKm / 111.32;
            const lngDelta = radiusKm / (111.32 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
            mapRef.current.fitBounds(
              [[lng - lngDelta, lat - latDelta], [lng + lngDelta, lat + latDelta]],
              { padding: { top: 72, right: 36, bottom: 72, left: 36 }, duration: 900 }
            );
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
        onShowSubscription={() => setShowSubscription(true)}
        isSuperAdmin={isSuperAdmin}
      />

      {/* Mobile map tools — a thumb-friendly vertical rail that leaves the bottom navigation clear. */}
      <div className={`absolute left-3 top-[max(7rem,calc(env(safe-area-inset-top)+6rem))] z-[1000] sm:hidden transition-all duration-300 ${isActivelyNavigating ? '-translate-x-20 opacity-0 pointer-events-none' : ''}`}>
        <div className="flex flex-col overflow-visible rounded-2xl border border-white/70 bg-white/90 p-1.5 text-slate-700 shadow-[0_10px_32px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-100">
          <MapLayerSwitcher activeLayer={mapLayer} onLayerChange={setMapLayer} menuPlacement="right" />
          <div className="mx-1.5 my-1 h-px bg-slate-200/80 dark:bg-white/10" />
          <button
            type="button"
            onClick={() => userPos && setFlyTo([...userPos])}
            className="grid h-10 w-10 place-items-center rounded-xl transition-colors hover:bg-slate-100 active:scale-95 dark:hover:bg-white/10"
            aria-label="Center on my location"
            title="Center location"
          >
            <Crosshair className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setTerrainEnabled(value => !value)}
            className={`grid h-10 w-10 place-items-center rounded-xl text-xs font-black italic transition-all active:scale-95 ${terrainEnabled ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25' : 'hover:bg-slate-100 dark:hover:bg-white/10'}`}
            aria-label="Toggle 3D terrain"
            aria-pressed={terrainEnabled}
            title="3D terrain"
          >
            3D
          </button>
          <div className="relative">
            {showMobileMore && (
              <>
                <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setShowMobileMore(false)} aria-label="Close more menu" />
                <div className="absolute left-full top-0 z-50 ml-3 w-52 overflow-hidden rounded-2xl border border-border/80 bg-background/95 p-1.5 shadow-2xl backdrop-blur-xl">
                  <button type="button" onClick={() => { navigate('/faq'); setShowMobileMore(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-accent">
                    <HelpCircle className="h-5 w-5 text-muted-foreground" /> FAQ
                  </button>
                  <button type="button" onClick={() => { setShowSettings(true); setShowMobileMore(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-accent">
                    <Settings className="h-5 w-5 text-muted-foreground" /> Settings
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowMobileMore(value => !value)}
              className={`grid h-10 w-10 place-items-center rounded-xl transition-all active:scale-95 ${showMobileMore ? 'bg-primary text-primary-foreground' : 'hover:bg-slate-100 dark:hover:bg-white/10'}`}
              aria-label="More map options"
              aria-expanded={showMobileMore}
              title="More"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Nearby Spots panel (distance + rating filtered) */}
      {showNearbySpots && (
        <NearbySpotsPanel
          spots={nearbySpots}
          userPos={userPos}
          loading={nearbyLoading}
          initialFilters={nearbyFilters}
          onFiltersChange={openNearby}
          onSelectSpot={(spot) => {
            setSelectedSpot(spot);
            setFlyTo([spot.lat, spot.lng]);
            setTimeout(() => setFlyTo(null), 1000);
          }}
          onNavigate={(spot) => handleNavigate(spot)}
          onClose={() => setShowNearbySpots(false)}
        />
      )}
 
 

 
 
 
      {/* Zoom half-circle slider — right edge (removed, file missing) */}

      {/* Bottom bar — hidden during active navigation (drawer replaces it) */}
      <div className={`absolute bottom-0 inset-x-0 z-[1000] transition-transform duration-300 ${isActivelyNavigating ? 'translate-y-full pointer-events-none' : ''}`}>
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
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <MapLayerSwitcher activeLayer={mapLayer} onLayerChange={setMapLayer} />
            <button
              onClick={() => userPos && setFlyTo([...userPos])}
              className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-accent/60 flex items-center justify-center text-gray-600 dark:text-foreground hover:bg-gray-200 dark:hover:bg-accent active:scale-95 transition-all"
              title="Center location"
            >
              <Crosshair className="w-5 h-5" />
            </button>

            {/* 3D Terrain toggle */}
            <button
              onClick={() => setTerrainEnabled(v => !v)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all ${
                terrainEnabled
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-gray-100 dark:bg-accent/60 text-gray-600 dark:text-foreground hover:bg-gray-200 dark:hover:bg-accent'
              }`}
              title="3D terrain"
            >
              <span className="text-base font-extrabold italic tracking-tight">3D</span>
            </button>
          </div>

          {/* Spacer for FAB */}
          <div className="flex-1" />

          {/* Right: FAQ + Settings */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
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
            {isSuperAdmin && (
              <a
                href="/StatusAdmin"
                className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all text-base bg-gray-100 dark:bg-accent/60 text-gray-600 dark:text-foreground hover:bg-gray-200 dark:hover:bg-accent"
                title="Publish Status (Superadmin)"
              >
                📊
              </a>
            )}
          </div>

          <div className="flex-1 sm:hidden" aria-hidden="true" />
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
          isAdmin={isAdmin}
          onClose={() => setSelectedSpot(null)}
          onNavigate={handleNavigate}
          onEdit={() => { setEditingSpot(selectedSpot); setSelectedSpot(null); }}
          onDelete={() => handleDeleteSpot(selectedSpot)}
          onShowAuth={() => setShowAuth(true)}
          onSpotUpdate={(updated) => {
            setSpots(prev => prev.map(s => s.id === updated.id ? updated : s));
            setSelectedSpot(updated);
          }}
        />
      )}

      {editingSpot && (
        <EditSpotModal
          spot={editingSpot}
          user={user}
          onClose={() => setEditingSpot(null)}
          onSave={handleEditSpot}
        />
      )}
 
      {navTarget && navFrom && (
        <NavigationPanel
          from={navFrom}
          to={{ lat: navTarget.lat, lng: navTarget.lng }}
          toLabel={navTarget.label}
          onClose={(clearRoute) => { setNavTarget(null); setNavFrom(null); if (clearRoute) setNavRouteData({ coordinates: [], turns: [], currentStep: 0 }); setIsActivelyNavigating(false); }}
          onRouteReady={() => {}}
          onNavigatingChange={setIsActivelyNavigating}
          isSuperAdmin={isSuperAdmin}
          userSubscription={null}
          onOpenSettings={() => setShowSettings(true)}
          onChangeMapLayer={() => {/* MapLayerSwitcher is in toolbar — just open it */}}
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
          isSuperAdmin={isSuperAdmin}
          onClose={() => { setSelectedPOI(null); setSelectedPOIDirectCat(null); if (!showPOIPanel) setSelectedPOICategory(null); }}
          onNavigate={(destination) => {
            if (!userPos) return alert(t('home.locationUnavailable'));
            startNavTo(destination);
          }}
          onBlockPOI={handleBlockAmbientPOI}
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
