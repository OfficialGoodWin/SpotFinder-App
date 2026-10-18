import React, { useState, useEffect, useRef, useCallback } from 'react';

import { Plus, Settings, Crosshair, HelpCircle, Trash2, MoreHorizontal } from 'lucide-react';
import { getPublicSpotsInBounds, getPublicSpotsNear, getPublicSpotById, getFeaturedSpotCandidates, createSpot, deleteSpot, updateSpot, getAdminPOIs, getAdminClosures, getAdminERouteOverrides, getAdminRoadOverrides, getDeletedAmbientPOIs, addDeletedAmbientPOI, addSocialPost, getFirebaseServices, reauthenticateForAccountDeletion, requestAccountDeletion } from '@/api/firebaseClient';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/LanguageContext';
 
import MapLayerSwitcher from '../components/map/MapLayerSwitcher';
import SearchBar from '../components/map/SearchBar';
import MapLibreMap from '../components/map/MapLibreMap';
import NearbySpotsFilterModal from '../components/spots/NearbySpotsFilterModal';
import NavigationProviderSheet from '../components/navigation/NavigationProviderSheet';
import ProfileMenu from '../components/ProfileMenu';
import WelcomeDiscoveryCard from '../components/WelcomeDiscoveryCard';
import FeaturedDiscoveryPanel from '../components/FeaturedDiscoveryPanel';
import { recoverableLazy } from '@/components/ChunkLoadRecovery';
import { getSpotDisplayName } from '@/lib/spotPresentation';
import { navigationCoordinates } from '@/lib/externalNavigation';
import { filterAndSortNearbySpots, normalizeLatLng } from '@/lib/spotDiscovery';
import { cachedViewportRows, canReuseNearby, filterViewportRows } from '@/lib/mapQueryCache';
import { freshNearbyFix, nearbyLocationFailure } from '@/lib/nearbyLocation';
import { createLiveLocationController, normalizeDeviceFix } from '@/lib/liveLocation';
import { createNearbyRequestGate } from '@/lib/nearbySearch';
import { NEARBY_DEFAULT_KM } from '@/lib/nearbyFilters';
import { useSpotOpenFocus } from '@/hooks/useSpotOpenFocus';
import { getConsent } from '@/lib/consent';
import { shouldShowWelcome } from '@/lib/discoveryExperience';
import { selectFeaturedSpots } from '@/lib/featuredDiscovery';
import { spotIdFromLocation, validSpotId } from '@/lib/spotLinks';
import { getGuestDraftOwnerKey, listGuestDrafts } from '@/lib/spotDrafts';
import { getMapExploreEnabled, setMapExploreEnabled as persistMapExploreEnabled } from '@/lib/mapExplorePreference';

const SubscriptionModal = recoverableLazy(() => import('../components/SubscriptionModal'));
const SuperAdminEditor = recoverableLazy(() => import('../components/map/SuperAdminEditor'));
const AddSpotModal = recoverableLazy(() => import('../components/spots/AddSpotModal'));
const EditSpotModal = recoverableLazy(() => import('../components/spots/EditSpotModal'));
const SpotDetailModal = recoverableLazy(() => import('../components/spots/SpotDetailModal'));
const AuthModal = recoverableLazy(() => import('../components/auth/AuthModal'));
const MySpotsPanel = recoverableLazy(() => import('../components/spots/MySpotsPanel'));
const NearbySpotsPanel = recoverableLazy(() => import('../components/spots/NearbySpotsPanel'));
const POIPanel = recoverableLazy(() => import('../components/spots/POIPanel'));
const POIDetailPanel = recoverableLazy(() => import('../components/spots/POIDetailPanel'));
const SettingsModal = recoverableLazy(() => import('../components/SettingsModal'));
 
 
export default function Home() {
  const { user, authUid, logout, isAuthenticated, isAdmin, isLoadingAuth } = useAuth();
  const { t, language } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const linkedSpot = spotIdFromLocation(location.pathname, location.search);
  const [spots, setSpots] = useState([]);
  const [spotsLoading, setSpotsLoading] = useState(true);
  const [featuredSpots, setFeaturedSpots] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [featuredError, setFeaturedError] = useState(false);
  const [sharedSpotError, setSharedSpotError] = useState(false);
  const [mapLayer, setMapLayer] = useState('basic');
  const [userPos, setUserPos] = useState(null);
  const [viewportCenter, setViewportCenter] = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(null);
  const [addMode, setAddMode] = useState(false);
  const [pendingLatlng, setPendingLatlng] = useState(null);
  const [resumingDraft, setResumingDraft] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const { closeSpot, openSpot, spotFocus } = useSpotOpenFocus({ selectedSpot, setSelectedSpot });
  const openMarkerSpot = useCallback((spot) => {
    if (openSpot(spot, { source: 'marker' })) navigate(`/spot/${encodeURIComponent(spot.id)}`);
  }, [navigate, openSpot]);
  const [editingSpot, setEditingSpot] = useState(null);
  const [navigationDestination, setNavigationDestination] = useState(null);
  const [flyTo, setFlyTo] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showMySpots, setShowMySpots] = useState(false);
  const [showNearbySpots, setShowNearbySpots] = useState(false);
  const [showNearbyFilter, setShowNearbyFilter] = useState(false);
  const [nearbyFilters, setNearbyFilters] = useState({ maxDistance: NEARBY_DEFAULT_KM, minRating: 0 });
  const [nearbyFilterPreset, setNearbyFilterPreset] = useState(null);
  const [nearbyMode, setNearbyMode] = useState('gps');
  const [nearbyOrigin, setNearbyOrigin] = useState(null);
  const [nearbyLocationError, setNearbyLocationError] = useState('');
  const [nearbyLocating, setNearbyLocating] = useState(false);
  const [nearbyComplete, setNearbyComplete] = useState(true);
  const [nearbySpots, setNearbySpots] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbySearchError, setNearbySearchError] = useState('');
  const nearbyRequestGate = useRef(null);
  if (!nearbyRequestGate.current) nearbyRequestGate.current = createNearbyRequestGate();
  const nearbyFixRef = useRef(null);
  const nearbyCacheRef = useRef(null);
  useEffect(() => () => { nearbyRequestGate.current.cancel(); nearbyCacheRef.current = null; }, []);
  const [terrainEnabled, setTerrainEnabled] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mapExploreEnabled, setMapExploreEnabled] = useState(() => getMapExploreEnabled());
  const [mapExploreDismissed, setMapExploreDismissed] = useState(false);
  const [featuredOpen, setFeaturedOpen] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [liveTracking, setLiveTracking] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => {
    if (spotIdFromLocation(window.location.pathname, window.location.search).isSpotLink) return false;
    try { return localStorage.getItem('spotfinder_welcome_dismissed_v1') !== '1'; }
    catch { return true; }
  });
  const [guestDraftCount, setGuestDraftCount] = useState(0);
  const [guestDraftOwnerKey] = useState(() => {
    try { return getGuestDraftOwnerKey(localStorage); } catch { return ''; }
  });

  useEffect(() => {
    const refreshDraftCount = () => {
      if (!guestDraftOwnerKey || isAuthenticated || isLoadingAuth) { setGuestDraftCount(0); return; }
      try { setGuestDraftCount(listGuestDrafts(localStorage, guestDraftOwnerKey).length); }
      catch { setGuestDraftCount(0); }
    };
    refreshDraftCount();
    window.addEventListener('spotfinder:drafts-changed', refreshDraftCount);
    return () => window.removeEventListener('spotfinder:drafts-changed', refreshDraftCount);
  }, [guestDraftOwnerKey, isAuthenticated, isLoadingAuth]);
  const [consentDecided, setConsentDecided] = useState(() => getConsent().decided);

  useEffect(() => {
    const handleConsent = event => setConsentDecided(Boolean(event.detail?.decided));
    window.addEventListener('spotfinder:consent-changed', handleConsent);
    return () => window.removeEventListener('spotfinder:consent-changed', handleConsent);
  }, []);

  const [showSpots, setShowSpots] = useState(true);
  const [zoomToArea, setZoomToArea] = useState(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
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
  const spotRequestSequence = useRef(0);
  const moveEndMapRef = useRef(null);
  const viewportCacheRef = useRef(null);

  const refreshSpotsInViewport = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    setViewportCenter({ lat: center.lat, lng: center.lng });
    if (spotRefreshTimer.current) clearTimeout(spotRefreshTimer.current);
    const sequence = ++spotRequestSequence.current;
    spotRefreshTimer.current = setTimeout(async () => {
      const b = map.getBounds();
      const view = { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
      const cachedRows = cachedViewportRows(viewportCacheRef.current, view);
      if (cachedRows) {
        setSpots(cachedRows);
        setSpotsLoading(false);
        return;
      }
      setSpotsLoading(true);
      try {
        const latPad = Math.min(10, (view.north - view.south) * 0.25);
        const lngPad = Math.min(10, (view.east - view.west) * 0.25);
        const bounds = { south: Math.max(-90, view.south - latPad), north: Math.min(90, view.north + latPad), west: view.west - lngPad, east: view.east + lngPad };
        let rows = await getPublicSpotsInBounds(bounds, 500);
        // Padding must never crowd visible records out of the bounded page.
        if (rows.length >= 500) {
          rows = await getPublicSpotsInBounds(view, 500);
          Object.assign(bounds, view);
        }
        if (sequence === spotRequestSequence.current) {
          viewportCacheRef.current = { bounds, rows, at: Date.now() };
          setSpots(filterViewportRows(rows, view));
        }
      } catch (err) {
        console.error('Failed to load visible spots:', err);
      } finally {
        if (sequence === spotRequestSequence.current) setSpotsLoading(false);
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
    spotRequestSequence.current += 1;
    if (spotRefreshTimer.current) clearTimeout(spotRefreshTimer.current);
    moveEndMapRef.current?.off('moveend', refreshSpotsInViewport);
    moveEndMapRef.current = null;
  }, [refreshSpotsInViewport]);
 
  const locationControllerRef = useRef(null);
  if (!locationControllerRef.current) locationControllerRef.current = createLiveLocationController({
    geolocation: navigator.geolocation, document,
    onFix: fix => {
      nearbyFixRef.current = fix;
      setUserPos(fix.position);
      setUserAccuracy(fix.accuracy);
      setLocationStatus('granted');
    },
    onError: error => {
      setLocationStatus(error?.code === 1 ? 'denied' : 'unavailable');
      if (error?.code === 1 || error?.code === 2) setLiveTracking(false);
      if (error?.code === 1) {
        nearbyFixRef.current = null;
        setUserPos(null);
        setUserAccuracy(null);
      }
    },
  });
  const requestLocation = useCallback(async () => {
    setLocationStatus('requesting');
    const fix = await locationControllerRef.current.start();
    if (!fix) return null;
    setLiveTracking(true);
    setLocationStatus('granted');
    return fix.position;
  }, []);
  useEffect(() => {
    const onVisibility = () => {
      locationControllerRef.current.onVisibilityChange();
      if (!document.hidden && !freshNearbyFix(nearbyFixRef.current)) {
        setUserPos(null);
        setUserAccuracy(null);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { document.removeEventListener('visibilitychange', onVisibility); locationControllerRef.current?.stop(); };
  }, []);
  const stopLiveLocation = () => {
    locationControllerRef.current.stop();
    nearbyFixRef.current = null;
    setUserPos(null);
    setUserAccuracy(null);
    setLocationStatus('idle');
    setLiveTracking(false);
  };

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    try { localStorage.setItem('spotfinder_welcome_dismissed_v1', '1'); } catch { /* no-op */ }
  }, []);
 
  const handleMapClick = useCallback((latlng) => {
    setResumingDraft(null);
    setPendingLatlng(latlng);
    setAddMode(false);
  }, []);
 
  const handleSaveSpot = async (data, socialUrl = '') => {
    try {
      let spot = await createSpot(data);
      if (socialUrl) {
        try {
          await addSocialPost({ url: socialUrl, targetType: 'spot', targetId: String(spot.id), targetName: getSpotDisplayName(spot) });
          spot = { ...spot, has_social: true };
        } catch (socialError) {
          console.error('Spot saved but social post attachment failed:', socialError);
          toast.error('Spot saved, but the social post could not be attached. You can add it from the spot details.');
        }
      }
      setSpots(prev => [spot, ...prev.filter(item => item.id !== spot.id)]);
      viewportCacheRef.current = null;
      nearbyCacheRef.current = null;
      window.dispatchEvent(new CustomEvent('spotfinder:collection-changed', { detail: { tabs: ['created', 'drafts'] } }));
      return spot;
    } catch (err) {
      console.error('Failed to create spot:', err);
      throw err; // AddSpotModal maps this to its inline, field-associated error UI.
    }
  };

  useEffect(() => {
    let active = true;
    if (!linkedSpot.isSpotLink) {
      setSharedSpotError(false);
      if (selectedSpot) closeSpot();
      return () => { active = false; };
    }
    setShowWelcome(false);
    try { localStorage.setItem('spotfinder_welcome_dismissed_v1', '1'); } catch { /* storage unavailable */ }
    setFeaturedOpen(false);
    if (!validSpotId(linkedSpot.id)) {
      setSharedSpotError(true);
      closeSpot();
      return () => { active = false; };
    }
    if (String(selectedSpot?.id) === linkedSpot.id) {
      setSharedSpotError(false);
      return () => { active = false; };
    }
    const cached = spots.find(item => String(item.id) === linkedSpot.id);
    const request = cached ? Promise.resolve(cached) : getPublicSpotById(linkedSpot.id);
    request.then(found => {
      if (!active) return;
      if (!found) { setSharedSpotError(true); closeSpot(); return; }
      setSharedSpotError(false);
      openSpot(found, { source: 'shared-link' });
    }).catch(() => { if (active) { setSharedSpotError(true); closeSpot(); } });
    return () => { active = false; };
  // Only URL changes initiate a link lookup. Viewport refreshes cannot repeat it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  const openLinkedSpot = useCallback((spot, source) => {
    if (!openSpot(spot, { source })) return;
    if (spot.is_public && ['published', 'pending_trust'].includes(spot.status)) {
      navigate(`/spot/${encodeURIComponent(spot.id)}`);
    }
  }, [navigate, openSpot]);

  const closeLinkedSpot = useCallback(() => {
    closeSpot();
    if (linkedSpot.isSpotLink) navigate('/');
  }, [closeSpot, linkedSpot.isSpotLink, navigate]);

  useEffect(() => {
    if (!featuredOpen) return;
    let active = true;
    setFeaturedLoading(true);
    getFeaturedSpotCandidates().then(rows => {
      if (active) { setFeaturedSpots(selectFeaturedSpots(rows)); setFeaturedError(false); }
    }).catch(() => { if (active) setFeaturedError(true); })
      .finally(() => { if (active) setFeaturedLoading(false); });
    return () => { active = false; };
  }, [featuredOpen]);

  useEffect(() => {
    if (!spotsLoading && spots.length === 0 && mapExploreEnabled && !mapExploreDismissed && !showWelcome && !linkedSpot.isSpotLink) {
      setFeaturedOpen(true);
    }
  }, [spotsLoading, spots.length, mapExploreEnabled, mapExploreDismissed, showWelcome, linkedSpot.isSpotLink]);
 
  const handleDeleteSpot = async (spot) => {
    await deleteSpot(spot.id);
    setSpots(prev => prev.filter(s => s.id !== spot.id));
    viewportCacheRef.current = null;
    nearbyCacheRef.current = null;
    closeSpot();
    window.dispatchEvent(new CustomEvent('spotfinder:collection-changed', { detail: { tabs: ['created', 'saved', 'liked'] } }));
    toast.success('Spot deleted');
  };

  const handleEditSpot = async (updatedSpot) => {
    await updateSpot(updatedSpot.id, updatedSpot);
    setSpots(prev => prev.map(s => s.id === updatedSpot.id ? updatedSpot : s));
    viewportCacheRef.current = null;
    nearbyCacheRef.current = null;
    setEditingSpot(null);
    closeSpot();
    window.dispatchEvent(new CustomEvent('spotfinder:collection-changed', { detail: { tabs: ['created', 'saved', 'liked'] } }));
    toast.success('Changes saved');
  };
 
  const openNavigation = (destination) => {
    if (!navigationCoordinates(destination)) return toast.error('This place has no valid map location.');
    setNavigationDestination({ ...destination, title: destination.title || destination.label || getSpotDisplayName(destination, language) });
  };
 
  const handleSearchSelect = ({ lat, lng, label }) => {
    setFlyTo([lat, lng]);
    setTimeout(() => setFlyTo(null), 1000);
  };

  const openNearbyFilters = (preset = null) => {
    setNearbyFilterPreset(preset);
    setNearbyLocationError('');
    setShowNearbyFilter(true);
  };

  const runNearby = async (filters, mode) => {
    const requestId = nearbyRequestGate.current.next();
    setNearbyLocationError('');
    setNearbyLocating(true);
    let origin = null;
    if (mode === 'map') {
      const center = mapRef.current?.getCenter();
      origin = normalizeLatLng(center ? { lat: center.lat, lng: center.lng } : viewportCenter);
      if (!origin) setNearbyLocationError('Move the map to a place first, then try again.');
    } else {
      origin = freshNearbyFix(nearbyFixRef.current);
      if (!origin && !navigator.geolocation) setNearbyLocationError(nearbyLocationFailure(0, Boolean(nearbyFixRef.current)));
      if (!origin && navigator.geolocation) {
        const hadStaleFix = Boolean(nearbyFixRef.current);
        try {
          const fix = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false, maximumAge: 120000, timeout: 10000,
          }));
          if (!nearbyRequestGate.current.isCurrent(requestId)) return;
          const validFix = normalizeDeviceFix(fix);
          origin = validFix ? freshNearbyFix(validFix) : null;
          if (origin) {
            nearbyFixRef.current = validFix;
            setUserPos(origin);
            setUserAccuracy(validFix.accuracy);
            setLocationStatus('granted');
          } else setNearbyLocationError('The device returned an invalid or out-of-date location. Try again or choose the map center.');
        } catch (error) {
          if (!nearbyRequestGate.current.isCurrent(requestId)) return;
          setNearbyLocationError(nearbyLocationFailure(error.code, hadStaleFix));
        }
      }
    }
    if (!nearbyRequestGate.current.isCurrent(requestId)) return;
    setNearbyLocating(false);
    if (!origin) return;

    setNearbyFilters(filters);
    setNearbyMode(mode);
    setNearbyOrigin(origin);
    setShowNearbyFilter(false);
    setShowNearbySpots(true);
    setNearbyLoading(true);
    setNearbySearchError('');
    setNearbySpots([]);
    try {
      const cached = nearbyCacheRef.current;
      const radius = filters.maxDistance;
      const canReuse = canReuseNearby(cached, origin, radius);
      const coverageRadius = mode === 'gps' && Number.isFinite(radius) ? radius + Math.min(1, Math.max(0.25, radius * 0.1)) : radius;
      const result = canReuse ? cached.result : await getPublicSpotsNear(origin, coverageRadius);
      if (!nearbyRequestGate.current.isCurrent(requestId)) return;
      if (!canReuse) nearbyCacheRef.current = { origin, radius: coverageRadius, at: Date.now(), result };
      setNearbySpots(filterAndSortNearbySpots(result.spots, { origin, maxDistance: radius, sort: 'distance' }));
      setNearbyComplete(result.complete);
    } catch (error) {
      if (!nearbyRequestGate.current.isCurrent(requestId)) return;
      console.error('Failed to load nearby spots:', error);
      setNearbySearchError('Nearby spots could not be loaded. Check your connection and try again.');
    } finally {
      if (nearbyRequestGate.current.isCurrent(requestId)) setNearbyLoading(false);
    }
  };
 
  const handleSignOut = async () => {
    stopLiveLocation();
    await logout();
  };
 
  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE' || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await reauthenticateForAccountDeletion(deletePassword);
      await requestAccountDeletion({ confirmation: 'DELETE' });
      setShowDeleteConfirm(false);
      setDeleteInput('');
      setDeletePassword('');
      toast.success('Your account was deleted. Public contributions were retained under a former-contributor label.');
      await logout().catch(() => {});
    } catch (error) {
      const code = String(error?.code || '');
      setDeleteError(code.includes('wrong-password') || code.includes('invalid-credential')
        ? 'Your current password is incorrect.'
        : code.includes('popup-closed')
          ? 'Reauthentication was cancelled. Your account was not deleted.'
          : error?.message?.replace(/^Firebase:\s*/i, '') || 'Account deletion could not be completed. Your account remains available; retry or contact support.');
    } finally {
      setDeleteBusy(false);
    }
  };
 
  const mapCenter = viewportCenter || (userPos
    ? { lat: userPos[0], lng: userPos[1] }
    : { lat: 50.0755, lng: 14.4378 });
 
  return (
    <div className="relative w-full h-full" style={{ touchAction: addMode ? 'none' : undefined }}>
      <h1 className="sr-only">SpotFinder community map</h1>
      {shouldShowWelcome({ dismissed: !showWelcome, consentDecided }) && (
        <WelcomeDiscoveryCard
          onDismiss={dismissWelcome}
          onFeatured={() => { dismissWelcome(); setMapExploreDismissed(false); setFeaturedOpen(true); }}
          onChooseLocation={() => { dismissWelcome(); setNearbyMode('map'); openNearbyFilters(); }}
        />
      )}
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
        spotFocus={spotFocus}
        selectedSpotId={selectedSpot?.id}
        zoomToArea={zoomToArea}
        setMapRef={handleMapReady}
        addMode={addMode}
        onMapClick={handleMapClick}
        spots={spots}
        showSpots={showSpots}
        onSelectSpot={openMarkerSpot}
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
        onOpenNearbyFilters={openNearbyFilters}
        onSelectSpot={(spot) => openLinkedSpot(spot, 'search')}
        onNavigate={openNavigation}
        onSelectCategory={async (category) => {
          const position = await requestLocation();
          if (!position) return toast.error(t('home.locationRequestFailed', 'Location is unavailable. Check browser permissions or search the map instead.'));
          setSelectedPOICategory(category);
          setShowPOIPanel(true);
          if (mapRef.current) {
            const [lat, lng] = position;
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

      {mapExploreEnabled && !mapExploreDismissed && !showWelcome && !selectedSpot && !selectedPOI && !showNearbySpots && !pendingLatlng && (featuredOpen || (!spotsLoading && spots.length === 0)) && (
        <FeaturedDiscoveryPanel
          spots={featuredSpots}
          language={language}
          loading={featuredLoading}
          error={featuredError}
          emptyView={!spotsLoading && spots.length === 0}
          onSelectSpot={(spot) => { setFeaturedOpen(false); openLinkedSpot(spot, 'featured'); }}
          onSearch={() => document.querySelector('input[aria-label="Search places and community spots"]')?.focus()}
          onDismiss={() => { setMapExploreDismissed(true); setFeaturedOpen(false); }}
        />
      )}
      {sharedSpotError && <div role="alert" className="absolute left-1/2 top-[max(5rem,calc(env(safe-area-inset-top)+4rem))] z-[1100] w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl dark:border-white/10 dark:bg-slate-950 dark:text-white">
        <h2 className="text-lg font-bold">This spot isn't available.</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">You can still explore other places on SpotFinder.</p>
        <button type="button" onClick={() => { setSharedSpotError(false); navigate('/'); setFeaturedOpen(true); }} className="mt-4 min-h-11 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2">Explore featured places</button>
      </div>}
 
      {/* Profile menu — top right */}
      <ProfileMenu
        user={user}
        isAuthenticated={isAuthenticated}
        showMenu={showAccountMenu}
        onToggleMenu={() => setShowAccountMenu(v => !v)}
        onShowMySpots={() => setShowMySpots(true)}
        onShowDrafts={() => setShowMySpots(true)}
        onShowNearby={() => openNearbyFilters()}
        onShowSettings={() => setShowSettings(true)}
        guestDraftCount={guestDraftCount}
        onSignOut={handleSignOut}
        onShowDeleteConfirm={() => setShowDeleteConfirm(true)}
        onShowAuth={() => setShowAuth(true)}
        onShowSubscription={() => setShowSubscription(true)}
        isSuperAdmin={isSuperAdmin}
      />

      {/* Mobile map tools — a thumb-friendly vertical rail that leaves the bottom navigation clear. */}
      <div className="absolute left-3 top-[max(7rem,calc(env(safe-area-inset-top)+6rem))] z-[1000] sm:hidden transition-all duration-300">
        <div className="flex flex-col overflow-visible rounded-2xl border border-white/70 bg-white/90 p-1.5 text-slate-700 shadow-[0_10px_32px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-100">
          <MapLayerSwitcher activeLayer={mapLayer} onLayerChange={setMapLayer} menuPlacement="right" />
          <div className="mx-1.5 my-1 h-px bg-slate-200/80 dark:bg-white/10" />
          <button
            type="button"
            onClick={async () => { const position = await requestLocation(); if (position) setFlyTo([...position]); }}
            className="grid h-11 w-11 place-items-center rounded-xl transition-colors hover:bg-slate-100 active:scale-95 dark:hover:bg-white/10"
            aria-label="Center on my location"
            title="Center location"
          >
            <Crosshair className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setTerrainEnabled(value => !value)}
            className={`grid h-11 w-11 place-items-center rounded-xl text-xs font-black italic transition-all active:scale-95 ${terrainEnabled ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-slate-100 dark:hover:bg-white/10'}`}
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
                  {liveTracking && <button type="button" onClick={() => { stopLiveLocation(); setShowMobileMore(false); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium hover:bg-accent"><Crosshair className="h-5 w-5 text-muted-foreground" /> Stop live location</button>}
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => setShowMobileMore(value => !value)}
              className={`grid h-11 w-11 place-items-center rounded-xl transition-all active:scale-95 ${showMobileMore ? 'bg-primary text-primary-foreground' : 'hover:bg-slate-100 dark:hover:bg-white/10'}`}
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
          origin={nearbyOrigin}
          originMode={nearbyMode}
          loading={nearbyLoading}
          complete={nearbyComplete}
          error={nearbySearchError}
          filters={nearbyFilters}
          onOpenFilters={() => openNearbyFilters()}
          onExploreMap={() => { nearbyRequestGate.current.cancel(); setShowNearbySpots(false); }}
          onIncreaseRadius={() => openNearbyFilters({ maxDistance: nearbyFilters.maxDistance === Infinity ? Infinity : nearbyFilters.maxDistance >= 50 ? Infinity : Math.min(50, nearbyFilters.maxDistance + 10) })}
          onSelectSpot={(spot) => openLinkedSpot(spot, 'nearby')}
          onNavigate={openNavigation}
          onClose={() => { nearbyRequestGate.current.cancel(); setShowNearbySpots(false); }}
        />
      )}

      <NearbySpotsFilterModal
        isOpen={showNearbyFilter}
        currentFilters={nearbyFilters}
        currentMode={nearbyMode}
        suggestedFilters={nearbyFilterPreset}
        locationError={nearbyLocationError}
        busy={nearbyLocating}
        onApply={runNearby}
        onClose={() => { nearbyRequestGate.current.cancel(); setNearbyLocating(false); setShowNearbyFilter(false); setNearbyFilterPreset(null); setNearbyLocationError(''); }}
      />
 
 

 
 
 
      {/* Zoom half-circle slider — right edge (removed, file missing) */}

      {/* Bottom bar — hidden during active navigation (drawer replaces it) */}
      <div className="absolute bottom-0 inset-x-0 z-[1000] transition-transform duration-300">
        {/* FAB — green + floating above bar */}
        <div className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none" style={{ bottom: '100%', marginBottom: '-36px' }}>
          <button
            onClick={() => setAddMode(a => !a)}
            aria-label={addMode ? 'Cancel adding spot' : 'Add a spot'}
            aria-pressed={addMode}
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
              onClick={async () => { const position = await requestLocation(); if (position) setFlyTo([...position]); }}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition-all hover:bg-gray-200 active:scale-95 dark:bg-accent/60 dark:text-foreground dark:hover:bg-accent"
              title="Center location"
              aria-label="Center map on my location"
            >
              <Crosshair className="w-5 h-5" />
            </button>
            {liveTracking && <button type="button" onClick={stopLiveLocation} className="min-h-11 rounded-xl px-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:text-foreground dark:hover:bg-accent" aria-label="Stop live location">Stop GPS</button>}

            {/* 3D Terrain toggle */}
            <button
              onClick={() => setTerrainEnabled(v => !v)}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-95 ${
                terrainEnabled
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-gray-100 dark:bg-accent/60 text-gray-600 dark:text-foreground hover:bg-gray-200 dark:hover:bg-accent'
              }`}
              title="3D terrain"
              aria-label="Toggle 3D terrain"
              aria-pressed={terrainEnabled}
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
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition-all hover:bg-gray-200 active:scale-95 dark:bg-accent/60 dark:text-foreground dark:hover:bg-accent"
              title="FAQ"
              aria-label="Open help and FAQ"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition-all hover:bg-gray-200 active:scale-95 dark:bg-accent/60 dark:text-foreground dark:hover:bg-accent"
              title="Settings"
              aria-label="Open settings"
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
          draft={resumingDraft}
          onClose={() => { setPendingLatlng(null); setResumingDraft(null); }}
          onSave={handleSaveSpot}
          user={user}
        />
      )}
 
      {selectedSpot && !editingSpot && (
        <SpotDetailModal
          spot={selectedSpot}
          user={user}
          isAdmin={isAdmin}
          onClose={closeLinkedSpot}
          onNavigate={openNavigation}
          onEdit={() => { setEditingSpot(selectedSpot); closeSpot(); }}
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
 
      <NavigationProviderSheet destination={navigationDestination} onClose={() => setNavigationDestination(null)} />
 
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
 
      {showMySpots && !isLoadingAuth && ((isAuthenticated && user) || (!isAuthenticated && guestDraftOwnerKey)) && (
        <MySpotsPanel
          key={user?.id || `guest:${guestDraftOwnerKey}`}
          user={user}
          draftOwnerKey={guestDraftOwnerKey}
          draftOnly={!isAuthenticated}
          initialTab={!isAuthenticated ? 'drafts' : undefined}
          onClose={() => setShowMySpots(false)}
          onSelectSpot={(spot) => openLinkedSpot(spot, 'my-spots')}
          onResumeDraft={(spotDraft) => {
            setResumingDraft(spotDraft);
            setPendingLatlng({ lat: spotDraft.lat, lng: spotDraft.lng });
          }}
        />
      )}

      {showPOIPanel && selectedPOICategory && (
        <POIPanel
          pois={currentPOIs}
          category={selectedPOICategory}
          userPos={userPos}
          loading={poiLoading}
          onFlyTo={(pos) => setFlyTo(pos)}
          onNavigate={(poi) => openNavigation({ lat: poi.lat, lng: poi.lon, label: poi.name })}
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
          onNavigate={openNavigation}
          onBlockPOI={handleBlockAmbientPOI}
        />
      )}
 
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          mapExploreEnabled={mapExploreEnabled}
          onMapExploreEnabledChange={(enabled) => {
            setMapExploreEnabled(enabled);
            persistMapExploreEnabled(enabled);
            if (enabled) setMapExploreDismissed(false);
          }}
          onRequestDeleteAccount={isAuthenticated ? () => { setShowSettings(false); setShowDeleteConfirm(true); } : undefined}
        />
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
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]" role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title" aria-describedby="delete-account-description" onKeyDown={event => { if (event.key === 'Escape' && !deleteBusy) { setShowDeleteConfirm(false); setDeleteInput(''); setDeletePassword(''); setDeleteError(''); } }}>
          <div className="sf-sheet w-full max-w-sm rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 id="delete-account-title" className="text-lg font-bold text-gray-900 dark:text-foreground">{t('home.deleteAccountTitle')}</h3>
            </div>
            
            <p id="delete-account-description" className="text-gray-600 dark:text-muted-foreground text-sm mb-4">
              This removes your sign-in account, private profile (including date of birth and enrolled SMS factors), drafts, saves, likes, and individual ratings. Public spots, reviews, social links, and photos are retained under a former-contributor label to preserve the community map and moderation record; public photo URLs may keep a pseudonymous storage path. Active subscriptions must be cancelled through support first. This cannot be undone.
            </p>
            
            <p className="text-gray-500 dark:text-muted-foreground text-xs mb-4">
              Reauthentication is required. Type DELETE to confirm:
            </p>

            {getFirebaseServices().auth.currentUser?.providerData.some(provider => provider.providerId === 'password') && (
              <input
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                placeholder="Current password"
                aria-label="Current password"
                autoComplete="current-password"
                className="sf-control mb-3 w-full focus-visible:ring-red-500"
              />
            )}
            
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="Type DELETE"
              aria-label="Type DELETE to confirm account deletion"
              autoFocus
              className="sf-control mb-4 w-full focus-visible:ring-red-500"
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); setDeletePassword(''); setDeleteError(''); }}
                disabled={deleteBusy}
                className="sf-button-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'DELETE' || deleteBusy}
                className="sf-button-danger flex-1"
              >
                {deleteBusy ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
            {deleteError && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
            <p className="mt-3 text-xs text-muted-foreground">If cleanup fails, the account remains available so you can retry. Contact spotfinder@icloud.com if a retry does not complete.</p>
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
