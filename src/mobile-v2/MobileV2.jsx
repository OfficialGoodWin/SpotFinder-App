import React, { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bookmark, ChevronDown, ChevronLeft, ChevronRight, Compass, Crosshair, Heart, Layers, List, Map as MapIcon, MapPin, Mic, Minus, Plus, Search, Settings, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';
import { LANGUAGES, LANGUAGE_VARIANTS } from '@/locales/translations';
import { getTextScale, saveTextScale } from '@/lib/textScale';
import { getPublicSpotsInBounds, getPublicSpotsNear, getPublicSpotById, getDiscoverSpotsPage, getSavedSpots, getLikedSpots, getUserSpots, getCloudSpotDrafts, deleteCloudSpotDraft, getSpotSocialState, toggleSpotSave, createSpot, deleteSpot, updateSpot, addSocialPost, resendVerificationEmail } from '@/api/firebaseClient';
import { cachedViewport, rememberViewport } from '@/new/viewportCache';
import { loadFullSnapshotSpot, readSnapshotSpots } from '@/new/publicSpotSnapshotClient';
import { getSpotDisplayName, getSpotLocationLabel, resolveSpotTitle, spotMatchesSearch } from '@/lib/spotPresentation';
import { filterAndSortNearbySpots, getSpotRating, normalizeLatLng } from '@/lib/spotDiscovery';
import { getConsent, acknowledgeCurrentPrivacyNotice } from '@/lib/consent';
import { searchPlaces } from '@/lib/placeSearch';
import { getGuestDraftOwnerKey, listGuestDrafts, deleteGuestDraft } from '@/lib/spotDrafts';
import { deleteGuestDraftPhotos } from '@/lib/guestDraftPhotos';
import { NEARBY_DEFAULT_KM } from '@/lib/nearbyFilters';
import MobileZoomSlider from './MobileZoomSlider';
import { appendDiscoverPage, isDiscoverEligible } from './discoverSpots';
import DiscoverCard from './DiscoverCard';
import { categoryOf, SpotPhoto } from './spotDisplay';
import SignOutDialog from './SignOutDialog';
import NewMapHome from '@/new/NewMapHome';
import NewWelcome from '@/new/NewWelcome';
import NewAuth from '@/new/NewAuth';
import NewSettings, { settingsBackRoute } from '@/new/NewSettings';
import NewSkeleton from '@/new/NewSkeleton';
import NewDiscover from '@/new/NewDiscover';
import { newMotion, reducedTransition } from '@/new/motion';
import { useNewSwipeNavigation } from '@/new/useNewSwipeNavigation';
import NewVoiceButton, { NewVoiceStatus } from '@/new/NewVoiceButton';
import { appendSpeechText, useVoiceInput } from '@/new/useVoiceInput';
import { fitMySpotsOnMap, publicMySpots } from '@/new/myMapCollection';
import { NewLegalLink } from '@/new/legalRoutes';
import { getNewZoomControlsPreference, saveNewZoomControlsPreference } from '@/new/zoomControlPreference';
import { DEFAULT_NEW_POI_LAYERS, getNewPoiLayersPreference, saveNewPoiLayersPreference } from '@/new/poiLayers';
import NewConsent from '@/new/NewConsent';
import QuickAddFlow, { quickAddRecoveryKey } from '@/new/QuickAddFlow';
import { mapHomeCategoryOf } from '@/new/mapHomeData';
import { APP_VERSION } from '@/config/appVersion';
import { toast } from 'sonner';
import { recoverableLazy } from '@/components/ChunkLoadRecovery';
import './mobile-v2.css';

const MapLibreMap = recoverableLazy(() => import('@/components/map/MapLibreMap'));
const SpotDetailModal = recoverableLazy(() => import('@/components/spots/SpotDetailModal'));
const AddSpotModal = recoverableLazy(() => import('@/components/spots/AddSpotModal'));
const AuthModal = recoverableLazy(() => import('@/components/auth/AuthModal'));
const SettingsModal = recoverableLazy(() => import('@/components/SettingsModal'));
const POIDetailPanel = recoverableLazy(() => import('@/components/spots/POIDetailPanel'));
const NearbySpotsFilterModal = recoverableLazy(() => import('@/components/spots/NearbySpotsFilterModal'));
const EditSpotModal = recoverableLazy(() => import('@/components/spots/EditSpotModal'));
const NavigationProviderSheet = recoverableLazy(() => import('@/components/navigation/NavigationProviderSheet'));

const LOGO = '/app-icon-v2-192.png?v=3';
// Prototype is intentionally development-only until moderation invalidation is deployed.
// Explicitly disabled in production until a trusted publisher and takedown process are approved.
const PUBLIC_SNAPSHOT_PREVIEW = (import.meta.env.DEV || import.meta.env.MODE === 'snapshot-staging')
  && import.meta.env.VITE_PUBLIC_SPOT_SNAPSHOTS === 'true';
const START = { lat: 50.0755, lng: 14.4378 };
const TABS = [
  ['map', 'Mapa', MapIcon], ['discover', 'Objevit', Compass], ['add', 'Přidat', Plus],
  ['collection', 'Uložené', Bookmark], ['profile', 'Profil', UserRound],
];
const CATEGORIES = ['Vše', 'Vyhlídky', 'Hrady', 'Zříceniny', 'Příroda', 'Kavárny'];

function spotTitle(spot, language = 'cs') {
  const resolved = resolveSpotTitle(spot, language);
  if (!resolved.source.endsWith('fallback')) return resolved.title;
  return ({ 'Community spot': 'Komunitní místo', Viewpoint: 'Vyhlídka', Castle: 'Hrad',
    'Historic ruin': 'Zřícenina', 'Historic site': 'Historické místo', Mountain: 'Hora', Waterfall: 'Vodopád' })[resolved.title] || resolved.title;
}
const spotLocation = spot => {
  const label = getSpotLocationLabel(spot);
  return label === 'Location unavailable' ? 'Poloha neuvedena' : label;
};

function SpotRow({ spot, onOpen, onMap, trailing }) {
  const rating = getSpotRating(spot);
  return <div className="v2-spot-row">
    <button className="v2-spot-main" onClick={() => onOpen(spot)}>
      <SpotPhoto spot={spot} className="v2-spot-thumb" />
      <span className="v2-spot-copy">
        <strong>{spotTitle(spot)}</strong>
        <small>{Number.isFinite(spot._km) ? `${spot._km < 1 ? `${Math.round(spot._km * 1000)} m` : `${spot._km.toFixed(1)} km`} · ` : ''}{spotLocation(spot)} · {categoryOf(spot)}</small>
        {rating !== null && <small className="v2-rating">★ {rating.toFixed(1)}{Number(spot.rating_count) > 0 ? ` (${spot.rating_count})` : ''}</small>}
      </span>
    </button>
    {trailing || <button className="v2-row-icon" onClick={() => onMap(spot)} aria-label={`Zobrazit na mapě: ${spotTitle(spot)}`}><MapPin size={19} /></button>}
  </div>;
}


function StateMessage({ children, retry }) {
  return <div className="v2-state"><p>{children}</p>{retry && <button className="v2-secondary" onClick={retry}>Zkusit znovu</button>}</div>;
}

function draftDate(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium' }).format(date) : '';
}
const draftTitle = item => item?.title?.trim() || 'Nepojmenované místo';

function SearchPanel({ spots, center, voiceQuery, onClose, onSpot, onPlace, redesigned = false, searchQuery = '', onSearchQueryChange, voiceInput }) {
  const [localQuery, setLocalQuery] = useState('');
  const query = redesigned ? searchQuery : localQuery;
  const setQuery = redesigned ? onSearchQueryChange : setLocalQuery;
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle');
  const [attempt, setAttempt] = useState(0);
  const [voiceError, setVoiceError] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (!redesigned && voiceQuery) setLocalQuery(voiceQuery); }, [redesigned, voiceQuery]);
  useEffect(() => {
    if (!query.trim()) { setResults([]); setStatus('idle'); return; }
    const controller = new AbortController();
    setStatus('loading');
    const timer = setTimeout(() => searchPlaces(query, { center, language: 'cs', signal: controller.signal, limit: 10 })
      .then(rows => { if (!controller.signal.aborted) { setResults(rows); setStatus('done'); } })
      .catch(error => { if (!controller.signal.aborted && error?.name !== 'AbortError') setStatus('error'); }), 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, center?.lat, center?.lng, attempt]);
  const matches = useMemo(() => spots.filter(spot => spotMatchesSearch(spot, query, 'cs')).slice(0, 8), [spots, query]);
  const voice = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setVoiceError('Hlasové vyhledávání není v tomto prohlížeči dostupné.'); return; }
    const recognition = new Recognition(); recognition.lang = 'cs-CZ';
    recognition.onresult = event => setQuery(event.results[0][0].transcript);
    recognition.onerror = () => setVoiceError('Mikrofon není dostupný. Zadejte místo ručně.');
    recognition.start();
  };
  return <section className="v2-page v2-search" aria-label="Hledání míst">
    <div className="v2-search-field"><button aria-label="Zavřít hledání" onClick={onClose}><ChevronLeft /></button><Search size={19} /><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Hledat místa…" />{redesigned ? <NewVoiceButton voice={voiceInput} field="search" label="Hledat hlasem" /> : <button onClick={voice} aria-label="Hledat hlasem"><Mic size={19} /></button>}</div>
    {redesigned ? <NewVoiceStatus voice={voiceInput} field="search" /> : voiceError && <p className="v2-inline-error">{voiceError}</p>}
    {!query.trim() && <StateMessage>Hledejte místo, oblast nebo komunitní spot.</StateMessage>}
    {query.trim() && <div className="v2-scroll">
      {matches.length > 0 && <><h2 className="v2-section-title">Komunitní místa na mapě</h2>{matches.map(spot => <SpotRow key={spot.id} spot={spot} onOpen={onSpot} onMap={onSpot} />)}</>}
      {status === 'loading' && <StateMessage>Hledám místa…</StateMessage>}
      {status === 'error' && <StateMessage retry={() => setAttempt(value => value + 1)}>Vyhledávání nyní není dostupné.</StateMessage>}
      {status === 'done' && results.length > 0 && <><h2 className="v2-section-title">Další výsledky</h2>{results.map((place, index) => <button className="v2-result-row" key={`${place.name || place.label}-${index}`} onClick={() => onPlace(place)}><MapPin size={19} /><span>{place.name || place.label}</span><ChevronRight size={17} /></button>)}</>}
      {status === 'done' && !matches.length && !results.length && <StateMessage>Pro „{query}“ jsme nic nenašli.</StateMessage>}
    </div>}
  </section>;
}

function NewBottomNav({ selectedNav, language, chooseTab }) {
  const reduced = useReducedMotion();
  const navRef = useRef(null);
  const tabRefs = useRef({});
  const [indicator, setIndicator] = useState(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const active = tabRefs.current[selectedNav];
    if (!nav || !active) { setIndicator(null); return undefined; }
    const measure = () => {
      const navRect = nav.getBoundingClientRect();
      const tabRect = active.getBoundingClientRect();
      if (!navRect.width || !tabRect.width) return;
      const width = Math.max(0, tabRect.width - 14);
      setIndicator({ x: tabRect.left - navRect.left + nav.scrollLeft + (tabRect.width - width) / 2, y: tabRect.top - navRect.top + 3, width, height: Math.max(0, tabRect.height - 6) });
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(nav);
    observer?.observe(active);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [selectedNav]);
  return <nav ref={navRef} className="v2-nav sf-new-motion-nav" aria-label="Hlavní navigace">
    {indicator && <motion.span aria-hidden="true" className="sf-new-nav-highlight" initial={false} animate={indicator} transition={reduced ? reducedTransition : newMotion.selection} />}
    {TABS.map(([id, label, Icon]) => id === 'add'
    ? <button key={id} type="button" className="v2-add-tab" aria-label={language?.startsWith('cs') ? 'Přidat místo' : 'Add spot'} onClick={() => chooseTab(id)}><span aria-hidden="true"><Icon size={27} strokeWidth={2.2} /></span></button>
    : <button ref={node => { tabRefs.current[id] = node; }} key={id} type="button" className={selectedNav === id ? 'active' : ''} aria-current={selectedNav === id ? 'page' : undefined} onClick={() => chooseTab(id)}><span><Icon size={19} strokeWidth={1.8} /></span><small>{label}</small></button>)}</nav>;
}

const MAIN_DESTINATIONS = ['map', 'discover', 'collection', 'profile'];
const routeSection = path => {
  const section = path.split('/')[2] || 'map';
  return ['settings', 'drafts', 'about'].includes(section) ? 'profile' : section;
};
const routeDepth = path => path.split('/').filter(Boolean).length + (path === '/new/profile' ? 0 : path.startsWith('/new/settings') ? 1 : 0);
const pageVariants = {
  enter: direction => ({ x: direction > 0 ? '100%' : '-28%', opacity: 0.96 }),
  center: { x: 0, opacity: 1 },
  exit: direction => ({ x: direction > 0 ? '-28%' : '100%', opacity: 0.96 }),
};

export default function MobileV2({ redesigned = false }) {
  const reducedMotion = useReducedMotion();
  const { user, logout, isLoadingAuth } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const tab = location.pathname.split('/')[2] || 'map';
  const settingsPage = tab === 'settings';
  const draftsPage = tab === 'drafts';
  const aboutPage = tab === 'about';
  const activeTab = settingsPage || draftsPage || aboutPage ? 'profile' : TABS.some(item => item[0] === tab) ? tab : 'map';
  const searchOpen = tab === 'search';
  const authPage = redesigned && tab === 'auth';
  const unknownPage = !['map', 'discover', 'collection', 'profile', 'settings', 'drafts', 'about', 'search', 'spot', ...(redesigned ? ['auth'] : [])].includes(tab);
  const [spots, setSpots] = useState([]);
  const [searchSourceSpots, setSearchSourceSpots] = useState([]);
  const [mapActivated, setMapActivated] = useState(activeTab === 'map');
  const [spotsLoading, setSpotsLoading] = useState(true);
  const [spotsError, setSpotsError] = useState(false);
  const [center, setCenter] = useState(START);
  const [flyTo, setFlyTo] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [selectedMapSpotId, setSelectedMapSpotId] = useState(null);
  const [previewSpot, setPreviewSpot] = useState(null);
  const [editingSpot, setEditingSpot] = useState(null);
  const [selectedPoi, setSelectedPoi] = useState(null);
  const [navigationDestination, setNavigationDestination] = useState(null);
  const [addAt, setAddAt] = useState(null);
  const [draft, setDraft] = useState(null);
  const [addMode, setAddMode] = useState(false);
  const [quickAdd, setQuickAdd] = useState(null);
  const [choosingQuickPosition, setChoosingQuickPosition] = useState(false);
  const [nearbySize, setNearbySize] = useState('collapsed');
  const [nearbyMode, setNearbyMode] = useState('map');
  const [nearbyOrigin, setNearbyOrigin] = useState(null);
  const [nearbyFilters, setNearbyFilters] = useState({ maxDistance: NEARBY_DEFAULT_KM, minRating: 0 });
  const [nearbyResults, setNearbyResults] = useState(null);
  const [nearbyComplete, setNearbyComplete] = useState(true);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [showNearbyFilter, setShowNearbyFilter] = useState(false);
  const [filterLocationError, setFilterLocationError] = useState('');
  const [nearbySort, setNearbySort] = useState('distance');
  const [nearbyCount, setNearbyCount] = useState(20);
  const [category, setCategory] = useState('Vše');
  const [mapCategory, setMapCategory] = useState('Vše');
  const [voiceQuery, setVoiceQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchVoice = useVoiceInput(language, (_field, transcript) => setSearchQuery(current => appendSpeechText(current, transcript)));
  const [mapLayer, setMapLayer] = useState('basic');
  const [mapInstance, setMapInstance] = useState(null);
  const [layerMenu, setLayerMenu] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [terrain, setTerrain] = useState(false);
  const [userPos, setUserPos] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [showWelcome, setShowWelcome] = useState(() => { try { return localStorage.getItem('spotfinder_mobile_v2_welcome') !== '1'; } catch { return true; } });
  const [consent, setConsent] = useState(() => getConsent().decided);
  const [showAuth, setShowAuth] = useState(false);
  const closeNewAuth = () => {
    setShowAuth(false);
    if (authPage) {
      const from = location.state?.from;
      navigate(typeof from === 'string' && from.startsWith('/new') ? from : '/new', { replace: true });
    }
  };
  const [showSettings, setShowSettings] = useState(false);
  const [textScale, setTextScale] = useState(() => getTextScale());
  const [showNewZoomButtons, setShowNewZoomButtons] = useState(() => redesigned && getNewZoomControlsPreference());
  const [newPoiLayers, setNewPoiLayers] = useState(() => redesigned ? getNewPoiLayersPreference() : { ...DEFAULT_NEW_POI_LAYERS });
  const changeNewZoomButtons = enabled => setShowNewZoomButtons(saveNewZoomControlsPreference(enabled));
  const changeNewPoiLayers = layers => setNewPoiLayers(saveNewPoiLayersPreference(layers));
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [draftRows, setDraftRows] = useState(null);
  const [draftsError, setDraftsError] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState(null);
  const [draftDeleteBusy, setDraftDeleteBusy] = useState(false);
  const [featured, setFeatured] = useState(null);
  const [featuredError, setFeaturedError] = useState(false);
  const [discoverCursor, setDiscoverCursor] = useState(null);
  const [discoverMore, setDiscoverMore] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [savedRefresh, setSavedRefresh] = useState(0);
  const [savingSpotId, setSavingSpotId] = useState('');
  const [unsaveSpot, setUnsaveSpot] = useState(null);
  const [unsaveBusy, setUnsaveBusy] = useState(false);
  const [collectionTab, setCollectionTab] = useState('saved');
  const [collection, setCollection] = useState({});
  const [collectionErrors, setCollectionErrors] = useState({});
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [myMapSpots, setMyMapSpots] = useState(null);
  const [myMapBusy, setMyMapBusy] = useState(false);
  const [myMapError, setMyMapError] = useState('');
  const mapRef = useRef(null);
  const layerMenuRef = useRef(null);
  const layerTriggerRef = useRef(null);
  const zoomDraggingRef = useRef(false);
  const requestRef = useRef(0);
  const cacheRef = useRef(null);
  const pendingBoundsRef = useRef(null);
  const mapRefreshTimerRef = useRef(null);
  useEffect(() => {
    if (!redesigned) return undefined;
    const linked = event => {
      const { spotId, link } = event.detail || {};
      if (!spotId || !link) return;
      const update = rows => rows.map(spot => spot.id === spotId ? { ...spot, osm_poi_link: link } : spot);
      setSpots(update);
      setMyMapSpots(rows => rows === null ? null : update(rows));
      cacheRef.current = null;
    };
    window.addEventListener('spotfinder:poi-linked', linked);
    return () => window.removeEventListener('spotfinder:poi-linked', linked);
  }, [redesigned]);
  const nearbyRequestRef = useRef(0);
  const selectedSpotRef = useRef(null);
  const collectionRequestRef = useRef(0);
  const myMapRequestRef = useRef(0);
  const draftRequestRef = useRef(0);
  const quickRecoveryRef = useRef(0);
  const quickBootRecoveryRef = useRef(false);
  const savedLoadedForRef = useRef('');
  const nearbyTouchYRef = useRef(null);
  const nearbySwipedRef = useRef(false);

  useEffect(() => {
    const oldTitle = document.title;
    document.title = 'SpotFinder – mobilní verze';
    let meta = document.querySelector('meta[name="robots"]');
    const created = !meta;
    if (!meta) { meta = document.createElement('meta'); meta.name = 'robots'; document.head.appendChild(meta); }
    const old = meta.content;
    meta.content = 'noindex,nofollow,noarchive';
    return () => { document.title = oldTitle; if (created) meta.remove(); else meta.content = old; };
  }, []);
  useEffect(() => { const listener = () => setConsent(getConsent().decided); window.addEventListener('spotfinder:consent-changed', listener); return () => window.removeEventListener('spotfinder:consent-changed', listener); }, []);
  useEffect(() => { if (!searchOpen) searchVoice.stop(); }, [searchOpen, searchVoice.stop]);
  useEffect(() => { const update = () => setOnline(navigator.onLine !== false); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);
  useEffect(() => {
    if (!redesigned || isLoadingAuth || quickBootRecoveryRef.current) return;
    quickBootRecoveryRef.current = true;
    if (location.pathname !== '/new/map') return;
    const request = ++quickRecoveryRef.current;
    void (async () => {
      try {
        const recoveryId = localStorage.getItem(quickAddRecoveryKey(user));
        if (!recoveryId) return;
        const rows = user ? await getCloudSpotDrafts() : listGuestDrafts(localStorage, getGuestDraftOwnerKey(localStorage));
        const recovered = rows.find(item => item.id === recoveryId);
        const coords = normalizeLatLng(recovered);
        if (coords && request === quickRecoveryRef.current) setQuickAdd({ coords: { lat: coords[0], lng: coords[1] }, draft: recovered });
      } catch (error) { console.warn('Quick add startup recovery failed', { code: error?.code || error?.name || 'unknown' }); }
    })();
  }, [redesigned, isLoadingAuth, location.pathname, user]);

  const refreshMap = useCallback(async () => {
    if (zoomDraggingRef.current) return;
    const map = mapRef.current;
    if (!map) return;
    const current = map.getCenter(); setCenter({ lat: current.lat, lng: current.lng });
    const bounds = map.getBounds();
    const view = { south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() };
    const key = Object.values(view).map(value => value.toFixed(2)).join(':');
    const request = ++requestRef.current;
    const cachedRows = PUBLIC_SNAPSHOT_PREVIEW && redesigned ? null : redesigned
      ? cachedViewport(cacheRef.current, key)
      : cacheRef.current?.key === key && Date.now() - cacheRef.current.at < 120000 ? cacheRef.current.rows : null;
    if (cachedRows) {
      setSpots(cachedRows); setSpotsLoading(false); setSpotsError(false); return;
    }
    setSpotsLoading(true); setSpotsError(false);
    const pending = pendingBoundsRef.current;
    const queryPromise = pending?.key === key ? pending.promise : PUBLIC_SNAPSHOT_PREVIEW && redesigned
      ? readSnapshotSpots(view, 300)
      : getPublicSpotsInBounds(view, 300);
    if (pending?.key !== key) pendingBoundsRef.current = { key, promise: queryPromise };
    try {
      const rows = await queryPromise;
      if (request === requestRef.current) {
        setSpots(rows);
        cacheRef.current = redesigned ? rememberViewport(cacheRef.current, key, rows) : { key, rows, at: Date.now() };
      }
    } catch { if (request === requestRef.current) { setSpotsError(true); if (PUBLIC_SNAPSHOT_PREVIEW && redesigned) { setSpots([]); cacheRef.current = null; } } }
    finally { if (pendingBoundsRef.current?.promise === queryPromise) pendingBoundsRef.current = null; if (request === requestRef.current) setSpotsLoading(false); }
  }, [redesigned]);
  const scheduleMapRefresh = useCallback(() => {
    if (mapRefreshTimerRef.current) clearTimeout(mapRefreshTimerRef.current);
    requestRef.current += 1;
    mapRefreshTimerRef.current = setTimeout(() => {
      mapRefreshTimerRef.current = null;
      void refreshMap();
    }, 120);
  }, [refreshMap]);
  useEffect(() => {
    if (PUBLIC_SNAPSHOT_PREVIEW && redesigned) setSearchSourceSpots(spots);
  }, [redesigned, spots]);
  const handleZoomDragStart = useCallback(() => {
    zoomDraggingRef.current = true;
    requestRef.current += 1;
  }, []);
  const handleZoomDragEnd = useCallback(() => {
    zoomDraggingRef.current = false;
    scheduleMapRefresh();
  }, [scheduleMapRefresh]);
  const handleMapReady = useCallback(map => {
    if (mapRef.current) mapRef.current.off('moveend', scheduleMapRefresh);
    mapRef.current = map;
    setMapInstance(map);
    if (map) { map.on('moveend', scheduleMapRefresh); scheduleMapRefresh(); }
  }, [scheduleMapRefresh]);
  useEffect(() => () => {
    requestRef.current += 1;
    if (mapRefreshTimerRef.current) clearTimeout(mapRefreshTimerRef.current);
    mapRef.current?.off('moveend', scheduleMapRefresh);
  }, [scheduleMapRefresh]);
  useEffect(() => { if (activeTab === 'map') { setMapActivated(true); setTimeout(() => mapRef.current?.resize(), 50); } }, [activeTab]);
  useEffect(() => { if (!redesigned || activeTab !== 'map') return undefined; const frame = requestAnimationFrame(() => mapRef.current?.resize()); return () => cancelAnimationFrame(frame); }, [redesigned, activeTab, choosingQuickPosition, Boolean(quickAdd)]);
  useEffect(() => {
    const match = /^\/new\/spot\/([^/]+)$/.exec(location.pathname);
    if (!match) { selectedSpotRef.current = null; setSelectedSpot(null); return; }
    let id;
    try { id = decodeURIComponent(match[1]); } catch { navigate('/new', { replace: true }); return; }
    if (selectedSpotRef.current?.id === id) return;
    let alive = true;
    getPublicSpotById(id).then(spot => {
      if (!alive) return;
      if (spot) { selectedSpotRef.current = spot; setSelectedSpot(spot); setSelectedMapSpotId(spot.id); if (redesigned) setPreviewSpot(spot); const coords = normalizeLatLng(spot); if (coords) setFlyTo(coords); }
      else { toast.error('Místo nebylo nalezeno.'); navigate('/new', { replace: true }); }
    }).catch(() => { if (alive) toast.error('Místo se nepodařilo načíst.'); });
    return () => { alive = false; };
  }, [location.pathname, navigate, redesigned]);

  const loadDiscover = useCallback(async (more = false) => {
    if (discoverLoading) return;
    setDiscoverLoading(true); setFeaturedError(false);
    try {
      const page = await getDiscoverSpotsPage(more ? discoverCursor : null);
      const eligible = page.spots.filter(isDiscoverEligible);
      setFeatured(current => more ? appendDiscoverPage(current, eligible) : eligible);
      setDiscoverCursor(page.cursor);
      setDiscoverMore(page.hasMore);
    } catch { setFeaturedError(true); }
    finally { setDiscoverLoading(false); }
  }, [discoverCursor, discoverLoading]);
  useEffect(() => { if (!redesigned && activeTab === 'discover' && featured === null && !discoverLoading && !featuredError) loadDiscover(); }, [redesigned, activeTab, featured, discoverLoading, featuredError, loadDiscover]);
  const loadCollection = useCallback(async () => {
    if (!user?.id) return;
    const request = ++collectionRequestRef.current;
    setCollectionLoading(true); setCollectionErrors({});
    const entries = await Promise.allSettled([
      getSavedSpots(user.id, 100), getLikedSpots(user.id, 100), getUserSpots(user.email, 100, user.id),
    ]);
    if (request !== collectionRequestRef.current) return;
    const keys = ['saved', 'liked', 'created'];
    const rows = {}, errors = {};
    entries.forEach((entry, index) => {
      if (entry.status === 'fulfilled') rows[keys[index]] = entry.value;
      else errors[keys[index]] = 'Seznam se nepodařilo načíst.';
    });
    setCollection(rows); setCollectionErrors(errors); setCollectionLoading(false);
  }, [user?.email, user?.id]);
  useEffect(() => { if (activeTab === 'collection' && user?.id && !collection.saved && !collectionLoading && !Object.keys(collectionErrors).length) loadCollection(); }, [activeTab, user?.id, collection, collectionLoading, collectionErrors, loadCollection]);
  useEffect(() => { const clear = () => { collectionRequestRef.current += 1; savedLoadedForRef.current = ''; setSavedRefresh(value => value + 1); setCollection({}); setCollectionErrors({}); setCollectionLoading(false); }; window.addEventListener('spotfinder:collection-changed', clear); return () => window.removeEventListener('spotfinder:collection-changed', clear); }, []);
  useEffect(() => { collectionRequestRef.current += 1; setCollection({}); setCollectionErrors({}); setCollectionLoading(false); }, [user?.id]);
  useEffect(() => { myMapRequestRef.current += 1; setMyMapSpots(null); setMyMapBusy(false); setMyMapError(''); }, [user?.id]);
  useEffect(() => { if (redesigned && location.pathname.startsWith('/new/settings/legal/')) setShowAuth(false); }, [redesigned, location.pathname]);
  useEffect(() => { savedLoadedForRef.current = ''; setSavedIds(new Set()); }, [user?.id]);
  useEffect(() => {
    if (!['map', 'discover'].includes(activeTab) || !user?.id || savedLoadedForRef.current === user.id) return;
    let alive = true;
    let completed = false;
    savedLoadedForRef.current = user.id;
    getSavedSpots(user.id, 100).then(rows => { completed = true; if (alive) setSavedIds(new Set(rows.map(item => item.id))); }).catch(() => { savedLoadedForRef.current = ''; });
    return () => { alive = false; if (!completed) savedLoadedForRef.current = ''; };
  }, [activeTab, user?.id, savedRefresh]);

  const loadDrafts = useCallback(async () => {
    const request = ++draftRequestRef.current;
    setDraftRows(null); setDraftsError(false);
    try {
      const rows = user ? await getCloudSpotDrafts() : listGuestDrafts(localStorage, getGuestDraftOwnerKey(localStorage));
      if (request === draftRequestRef.current) setDraftRows(rows);
    } catch { if (request === draftRequestRef.current) setDraftsError(true); }
  }, [user?.id]);
  useEffect(() => { if (draftsPage) loadDrafts(); return () => { draftRequestRef.current += 1; }; }, [draftsPage, loadDrafts]);
  useEffect(() => { const refresh = () => { if (draftsPage) loadDrafts(); }; window.addEventListener('spotfinder:drafts-changed', refresh); return () => window.removeEventListener('spotfinder:drafts-changed', refresh); }, [draftsPage, loadDrafts]);
  const confirmDeleteDraft = async () => {
    if (!draftToDelete || draftDeleteBusy) return;
    setDraftDeleteBusy(true);
    try {
      let photoCleanupFailed = false;
      if (user) ({ photoCleanupFailed } = await deleteCloudSpotDraft(draftToDelete.id));
      else {
        const ownerKey = getGuestDraftOwnerKey(localStorage);
        deleteGuestDraft(localStorage, ownerKey, draftToDelete.id);
        try { await deleteGuestDraftPhotos(ownerKey, draftToDelete.id); }
        catch { photoCleanupFailed = true; }
      }
      setDraftRows(rows => rows?.filter(item => item.id !== draftToDelete.id) || []);
      try { if (localStorage.getItem(quickAddRecoveryKey(user)) === draftToDelete.id) localStorage.removeItem(quickAddRecoveryKey(user)); } catch { /* Draft deletion already succeeded. */ }
      setDraftToDelete(null);
      window.dispatchEvent(new CustomEvent('spotfinder:drafts-changed'));
      if (photoCleanupFailed) toast.warning('Návrh byl smazán, ale odstranění některých fotografií se nezdařilo.');
      else toast.success('Rozpracované místo bylo smazáno.');
    } catch { toast.error('Rozpracované místo se nepodařilo smazat.'); }
    finally { setDraftDeleteBusy(false); }
  };

  const sourceSpots = nearbyResults || spots;
  const visibleSpots = useMemo(() => myMapSpots !== null ? myMapSpots : filterAndSortNearbySpots(sourceSpots, {
    origin: nearbyResults ? nearbyOrigin : null,
    maxDistance: nearbyResults ? nearbyFilters.maxDistance : Infinity,
    minRating: nearbyResults ? nearbyFilters.minRating : 0,
    sort: nearbyResults ? nearbySort : 'newest',
  }).filter(spot => redesigned ? mapCategory === 'Vše' || mapHomeCategoryOf(spot) === mapCategory : category === 'Vše' || categoryOf(spot) === category), [sourceSpots, category, mapCategory, redesigned, nearbyResults, nearbyOrigin, nearbyFilters, nearbySort, myMapSpots]);
  const mapSpots = useMemo(() => redesigned && previewSpot && String(previewSpot.id) === String(selectedMapSpotId) && !visibleSpots.some(spot => String(spot.id) === String(previewSpot.id))
    ? [...visibleSpots, previewSpot] : visibleSpots, [redesigned, previewSpot, selectedMapSpotId, visibleSpots]);
  useEffect(() => setNearbyCount(20), [category, nearbyResults, nearbySort]);
  const featuredVisible = useMemo(() => (featured || []).filter(spot => category === 'Vše' || categoryOf(spot) === category), [featured, category]);
  const openSpot = async selected => {
    let spot = selected;
    if (PUBLIC_SNAPSHOT_PREVIEW && redesigned && spot._public_snapshot) {
      try { spot = await loadFullSnapshotSpot(spot, getPublicSpotById); }
      catch { toast.error('Místo se nepodařilo načíst. Zkus to znovu.'); return; }
      if (!spot) { cacheRef.current = null; setSpots(rows => rows.filter(row => row.id !== selected.id)); setPreviewSpot(null); toast.error('Místo už není veřejně dostupné.'); return; }
    }
    setNearbySize('collapsed'); setSelectedPoi(null); setSelectedMapSpotId(spot.id);
    if (redesigned) setPreviewSpot(spot);
    selectedSpotRef.current = spot; setSelectedSpot(spot);
    const coords = normalizeLatLng(spot); if (coords) setFlyTo(coords);
    navigate(`/new/spot/${encodeURIComponent(spot.id)}`);
  };
  const selectMapSpot = spot => {
    if (!redesigned || String(selectedMapSpotId) === String(spot.id)) { openSpot(spot); return; }
    setNearbySize('collapsed'); setSelectedPoi(null); setSelectedMapSpotId(spot.id); setPreviewSpot(spot);
    const coords = normalizeLatLng(spot);
    const map = mapRef.current;
    if (!coords || !map) return;
    const point = map.project([coords[1], coords[0]]);
    const height = map.getContainer().clientHeight;
    if (map.getZoom() >= 15.5 && point.x > 80 && point.x < map.getContainer().clientWidth - 80 && point.y > 110 && point.y < height - 190) return;
    map.stop();
    map.easeTo({ center: [coords[1], coords[0]], zoom: Math.max(16.2, map.getZoom()), offset: [0, -Math.min(105, height * 0.15)], duration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 380 });
  };
  const openOnMap = spot => { if (redesigned) { setMyMapSpots(null); setPreviewSpot(spot); } setSelectedSpot(null); selectedSpotRef.current = null; setSelectedMapSpotId(spot.id); setNearbySize('collapsed'); navigate('/new/map'); const coords = normalizeLatLng(spot); if (coords) setFlyTo(coords); };
  const showMySpotsOnMap = async () => {
    if (!redesigned || !user?.id || myMapBusy) return;
    const request = ++myMapRequestRef.current;
    setMyMapBusy(true); setMyMapError('');
    try {
      const groups = await Promise.all([
        getUserSpots(user.email, Infinity, user.id),
        getSavedSpots(user.id, Infinity),
        getLikedSpots(user.id, Infinity),
      ]);
      if (request !== myMapRequestRef.current) return;
      setMyMapSpots(publicMySpots(groups));
      setNearbyResults(null); setNearbySize('collapsed'); setMapCategory('Vše');
      setSelectedMapSpotId(null); setSelectedSpot(null); selectedSpotRef.current = null;
      navigate('/new/map');
    } catch {
      if (request === myMapRequestRef.current) setMyMapError('Tvoje místa se nepodařilo načíst. Zkus to znovu.');
    } finally {
      if (request === myMapRequestRef.current) setMyMapBusy(false);
    }
  };
  useEffect(() => {
    if (!redesigned || activeTab !== 'map' || myMapSpots === null || !mapInstance) return undefined;
    const timer = window.setTimeout(() => fitMySpotsOnMap(mapInstance, myMapSpots), 230);
    return () => window.clearTimeout(timer);
  }, [redesigned, activeTab, myMapSpots, mapInstance]);
  const saveDiscoverSpot = async spot => {
    if (!user) { setShowAuth(true); return; }
    if (!user.emailVerified) { toast.error('Nejdřív ověř e-mailovou adresu.'); return; }
    if (savingSpotId) return;
    setSavingSpotId(spot.id);
    try {
      const state = await getSpotSocialState(spot.id, user);
      if (!state.saved) await toggleSpotSave(spot.id, user, false);
      setSavedIds(current => new Set(current).add(spot.id));
      if (!state.saved) { window.dispatchEvent(new CustomEvent('spotfinder:collection-changed', { detail: { tabs: ['saved'] } })); toast.success('Místo bylo uloženo.'); }
      else toast.info('Místo už máš uložené.');
    } catch { toast.error('Místo se nepodařilo uložit.'); }
    finally { setSavingSpotId(''); }
  };
  const confirmUnsave = async () => {
    if (!user || !unsaveSpot || unsaveBusy) return;
    setUnsaveBusy(true);
    try {
      await toggleSpotSave(unsaveSpot.id, user, true);
      setCollection(current => ({ ...current, saved: current.saved?.filter(item => item.id !== unsaveSpot.id) || [] }));
      setSavedIds(current => { const next = new Set(current); next.delete(unsaveSpot.id); return next; });
      setUnsaveSpot(null);
      window.dispatchEvent(new CustomEvent('spotfinder:collection-changed', { detail: { tabs: ['saved'] } }));
      toast.success('Místo bylo odebráno ze sbírky.');
    } catch { toast.error('Místo se nepodařilo odebrat.'); }
    finally { setUnsaveBusy(false); }
  };
  const closeSpot = () => { setSelectedSpot(null); selectedSpotRef.current = null; setNavigationDestination(null); if (location.pathname.startsWith('/new/spot/')) navigate(location.key === 'default' ? '/new' : -1); };
  const runNearby = async (filters, mode) => {
    const request = ++nearbyRequestRef.current;
    setFilterLocationError('');
    setNearbyError('');
    setNearbyLoading(true);
    let origin = [center.lat, center.lng];
    if (mode === 'gps') {
      if (!navigator.geolocation) { setFilterLocationError('Poloha není dostupná. Vyberte střed mapy.'); setNearbyLoading(false); return; }
      try {
        const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 }));
        origin = [position.coords.latitude, position.coords.longitude];
        setUserPos(origin);
      } catch { if (request === nearbyRequestRef.current) { setFilterLocationError('Přístup k poloze nebyl povolen. Vyberte střed mapy.'); setNearbyLoading(false); } return; }
    }
    if (request !== nearbyRequestRef.current) return;
    setShowNearbyFilter(false);
    setNearbySize(redesigned ? 'expanded' : 'full');
    setNearbyFilters(filters);
    setNearbyMode(mode);
    setNearbyOrigin(origin);
    try {
      const result = await getPublicSpotsNear(origin, filters.maxDistance);
      if (request === nearbyRequestRef.current) {
        setNearbyResults(filterAndSortNearbySpots(result.spots, { origin, maxDistance: filters.maxDistance, minRating: filters.minRating }));
        setNearbyComplete(result.complete);
      }
    } catch { if (request === nearbyRequestRef.current) setNearbyError('Místa se nepodařilo načíst.'); }
    finally { if (request === nearbyRequestRef.current) setNearbyLoading(false); }
  };
  const dismissWelcome = () => { setShowWelcome(false); try { localStorage.setItem('spotfinder_mobile_v2_welcome', '1'); } catch { /* storage disabled */ } };
  const requestGps = () => {
    setGeoError('');
    if (!navigator.geolocation) { setGeoError('Poloha není v tomto zařízení dostupná.'); return; }
    navigator.geolocation.getCurrentPosition(position => { const point = [position.coords.latitude, position.coords.longitude]; setUserPos(point); setFlyTo(point); }, () => setGeoError('Přístup k poloze nebyl povolen. Mapu můžete používat ručně.'), { enableHighAccuracy: true, timeout: 10000 });
  };
  const startVoiceSearch = () => { setSearchQuery(''); searchVoice.start('search'); navigate('/new/search'); };
  const chooseTab = id => {
    if (id === 'add') {
      if (redesigned) {
        const recoveryRequest = ++quickRecoveryRef.current;
        setChoosingQuickPosition(true); setNearbySize('collapsed'); navigate('/new/map');
        void (async () => {
          try {
            const recoveryId = localStorage.getItem(quickAddRecoveryKey(user));
            if (!recoveryId) return;
            const rows = user ? await getCloudSpotDrafts() : listGuestDrafts(localStorage, getGuestDraftOwnerKey(localStorage));
            const recovered = rows.find(item => item.id === recoveryId);
            const coords = normalizeLatLng(recovered);
            if (coords && recoveryRequest === quickRecoveryRef.current) { setQuickAdd({ coords: { lat: coords[0], lng: coords[1] }, draft: recovered }); setChoosingQuickPosition(false); toast.message('Pokračuješ v rozpracovaném místě.', { action: { label: 'Nové místo', onClick: () => { quickRecoveryRef.current += 1; setQuickAdd(null); setChoosingQuickPosition(true); } } }); }
          } catch (error) { console.warn('Quick add recovery failed', { code: error?.code || error?.name || 'unknown' }); }
        })();
        return;
      }
      setAddMode(true); navigate('/new/map'); toast.message('Klepněte na mapu, kam chcete přidat místo.'); return;
    }
    if (redesigned) { quickRecoveryRef.current += 1; setChoosingQuickPosition(false); setQuickAdd(null); }
    setAddMode(false); setNearbySize('collapsed'); navigate(id === 'map' ? '/new' : `/new/${id}`);
  };
  const selectSearchPlace = place => { const point = place.position || place.regionalStructure?.[0]; const coords = normalizeLatLng(point); if (coords) { setFlyTo(coords); navigate('/new'); } else toast.error('Toto místo nemá platnou polohu.'); };
  const selectedNav = addMode || addAt || choosingQuickPosition || quickAdd ? 'add' : activeTab;
  const previousRoute = useRef(location.pathname);
  const previousDirection = useRef(1);
  if (previousRoute.current !== location.pathname) {
    const oldSection = routeSection(previousRoute.current);
    const newSection = routeSection(location.pathname);
    previousDirection.current = oldSection !== newSection
      ? Math.sign(MAIN_DESTINATIONS.indexOf(newSection) - MAIN_DESTINATIONS.indexOf(oldSection)) || 1
      : routeDepth(location.pathname) >= routeDepth(previousRoute.current) ? 1 : -1;
    previousRoute.current = location.pathname;
  }
  const swipeBackPath = settingsPage ? settingsBackRoute(location.pathname, location.state) : draftsPage || aboutPage ? '/new/profile' : null;
  const swipeHandlers = useNewSwipeNavigation({
    enabled: redesigned && !searchOpen,
    tab: activeTab,
    backPath: swipeBackPath,
    blocked: Boolean(selectedSpot || selectedPoi || editingSpot || quickAdd || choosingQuickPosition || addMode || showAuth || authPage || showSignOut || draftToDelete || unsaveSpot || navigationDestination || showNearbyFilter || showWelcome || !consent),
    onTab: chooseTab,
    onBack: path => navigate(path, { replace: true }),
  });

  useEffect(() => {
    if (!layerMenu) return undefined;
    layerMenuRef.current?.querySelector('button')?.focus();
    const closeOutside = event => { if (!layerMenuRef.current?.parentElement?.contains(event.target)) setLayerMenu(false); };
    const closeEscape = event => { if (event.key === 'Escape') { setLayerMenu(false); layerTriggerRef.current?.focus(); } };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape); };
  }, [layerMenu]);
  useEffect(() => { if (activeTab !== 'map' || nearbySize !== 'collapsed') setLayerMenu(false); }, [activeTab, nearbySize]);

  const confirmSignOut = async () => {
    if (signOutBusy) return;
    setSignOutBusy(true);
    try { await logout(); setShowSignOut(false); }
    catch { toast.error(t('signOutFailed')); }
    finally { setSignOutBusy(false); }
  };

  return <div className={`mobile-v2 ${isDark ? 'v2-dark' : ''} ${redesigned && myMapSpots !== null && activeTab === 'map' ? 'sf-new-my-map' : ''} ${redesigned && (quickAdd || choosingQuickPosition || editingSpot) ? 'sf-new-adding' : ''} ${redesigned && settingsPage ? 'sf-new-settings-open' : ''} ${redesigned && showNewZoomButtons ? 'sf-new-zoom-visible' : ''}`} {...swipeHandlers}>
    <div className={`v2-map-layer ${activeTab === 'map' ? '' : 'v2-map-hidden'}`} aria-hidden={activeTab !== 'map'}>
      {mapActivated && <Suspense fallback={redesigned ? <NewSkeleton kind="map" /> : <div className="v2-map-loading" role="status">Načítám mapu…</div>}><MapLibreMap center={START} flyTo={flyTo} selectedSpotId={selectedSpot?.id || selectedMapSpotId} setMapRef={handleMapReady} addMode={addMode} onMapClick={point => { setAddMode(false); setAddAt(point); }} spots={redesigned ? mapSpots : spots} showSpots={!redesigned || !choosingQuickPosition && newPoiLayers.community} compactSpotMarkers={redesigned} poiLayers={redesigned ? newPoiLayers : null} onSelectSpot={selectMapSpot} userPos={userPos} selectedPOICategory={null} onSelectPOI={(poi, cat) => { if (redesigned && activeTab !== 'map') return; setNearbySize('collapsed'); setSelectedSpot(null); setSelectedMapSpotId(null); setPreviewSpot(null); setSelectedPoi({ poi, cat }); }} isDark={isDark} mapLayer={mapLayer} terrainEnabled={terrain} showZoomControls={false} /></Suspense>}
    </div>
    {activeTab === 'map' && (redesigned ? <>
      {!choosingQuickPosition && !quickAdd && !selectedPoi && <NewMapHome category={mapCategory} setCategory={setMapCategory} spots={visibleSpots} language={language} loading={myMapSpots === null && (spotsLoading || nearbyLoading)} error={myMapSpots === null && (spotsError || Boolean(nearbyError))} onRetry={() => nearbyResults ? runNearby(nearbyFilters, nearbyMode) : refreshMap()} onSearch={() => { searchVoice.stop(); setSearchQuery(''); navigate('/new/search'); }} onVoiceSearch={startVoiceSearch} onGps={requestGps} geoError={geoError} onDismissGeoError={() => setGeoError('')} map={mapInstance} mapLayer={mapLayer} onMapLayer={setMapLayer} poiLayers={newPoiLayers} onPoiLayers={changeNewPoiLayers} terrain={terrain} onTerrain={() => setTerrain(value => !value)} showZoomButtons={showNewZoomButtons} nearbySize={nearbySize} onNearbySize={setNearbySize} onOpen={openSpot} onSave={saveDiscoverSpot} savedIds={savedIds} savingSpotId={savingSpotId} collectionMode={myMapSpots !== null} onExitCollection={() => setMyMapSpots(null)} />}
      {choosingQuickPosition && <div className="sf-new-position"><header className="sf-new-position-top"><strong>Vyber polohu místa</strong><span>Posuň mapu tak, aby značka ukazovala na místo.</span></header><div className="sf-new-position-pin"><MapPin size={42} fill="currentColor" /></div><div className="sf-new-position-controls"><button type="button" onClick={() => mapInstance?.zoomIn()} aria-label="Přiblížit mapu"><Plus size={19} /></button><button type="button" onClick={() => mapInstance?.zoomOut()} aria-label="Oddálit mapu"><Minus size={19} /></button><button type="button" onClick={requestGps} aria-label="Moje poloha"><Crosshair size={19} /></button></div><div className="sf-new-position-panel"><span>POLOHA MÍSTA</span><strong>{center.lat.toFixed(5)}, {center.lng.toFixed(5)}</strong><p>Souřadnice potvrdíš, až bude značka na správném místě.</p><div><button onClick={() => { quickRecoveryRef.current += 1; setChoosingQuickPosition(false); if (!quickAdd) setDraft(null); }}>Zrušit</button><button onClick={() => { quickRecoveryRef.current += 1; const point = mapRef.current?.getCenter(); if (!point) { toast.error('Počkejte, až se mapa načte.'); return; } const coords = { lat: point.lat, lng: point.lng }; if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return; setQuickAdd(current => ({ ...current, coords, draft: current?.draft || null })); setChoosingQuickPosition(false); }}>Potvrdit polohu</button></div></div></div>}
      {quickAdd && <QuickAddFlow key={quickAdd.draft?.id || 'new'} coords={quickAdd.coords} draft={quickAdd.draft} hidden={choosingQuickPosition} user={user} onMove={() => setChoosingQuickPosition(true)} onClose={() => { setQuickAdd(null); setChoosingQuickPosition(false); setDraft(null); }} onAuth={() => setShowAuth(true)} onViewSpot={async spot => { try { const saved = await getPublicSpotById(spot.id); if (!saved) { toast.error('Místo se zatím nepodařilo načíst. Zkus to znovu.'); return; } setQuickAdd(null); setChoosingQuickPosition(false); openSpot(saved); } catch { toast.error('Místo se nepodařilo načíst. Zkus to znovu.'); } }} onCreated={created => { if (created.status === 'published' && created.is_public) setSpots(rows => [created, ...rows.filter(row => row.id !== created.id)]); cacheRef.current = null; window.dispatchEvent(new CustomEvent('spotfinder:collection-changed')); }} />}
      {addMode && <div className="v2-add-hint"><span>Klepněte na mapu a vyberte polohu místa.</span><button onClick={() => setAddMode(false)} aria-label="Zrušit přidání"><X size={18} /></button></div>}
      {showWelcome && consent && !authPage && <NewWelcome onExplore={dismissWelcome} onGps={requestGps} onSignIn={() => setShowAuth(true)} />}
      {!consent && <NewConsent onNecessary={() => { acknowledgeCurrentPrivacyNotice(); setConsent(true); }} />}
    </> : <>
      <div className="v2-map-top"><button className="v2-search-pill" onClick={() => navigate('/new/search')}><img src={LOGO} alt="SpotFinder" /><span>Hledat místa…</span><Mic size={17} /></button></div>
      <div className={`v2-map-controls${nearbySize !== 'collapsed' ? ' v2-map-controls--sheet-open' : ''}${addMode || geoError ? ' v2-map-controls--message' : ''}`}>
      <div className="v2-map-actions">
        <div className="v2-layer-anchor"><button ref={layerTriggerRef} type="button" onClick={() => setLayerMenu(value => !value)} aria-label="Mapové vrstvy" aria-haspopup="menu" aria-expanded={layerMenu} aria-controls="v2-layer-menu"><Layers size={19} /></button>{layerMenu && <div ref={layerMenuRef} id="v2-layer-menu" className="v2-layer-menu" role="menu" aria-label="Mapové vrstvy" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => { const buttons = [...event.currentTarget.querySelectorAll('button')]; const index = buttons.indexOf(document.activeElement); const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length : event.key === 'ArrowUp' ? (index - 1 + buttons.length) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : null; if (next !== null) { event.preventDefault(); buttons[next].focus(); } }}>{[['basic','Základní'],['outdoor','Turistická'],['aerial','Letecká'],['winter','Zimní'],['traffic','Doprava']].map(([id, label]) => <button type="button" role="menuitemradio" aria-checked={mapLayer === id} key={id} onClick={() => { setMapLayer(id); setLayerMenu(false); layerTriggerRef.current?.focus(); }}>{label}</button>)}</div>}</div>
        <button onClick={() => setTerrain(value => !value)} aria-label="Přepnout 3D mapu" aria-pressed={terrain}>3D</button>
        <button onClick={requestGps} aria-label="Moje poloha"><Crosshair size={19} /></button>
      </div>
      <MobileZoomSlider map={mapInstance} onDragStart={handleZoomDragStart} onDragEnd={handleZoomDragEnd} />
      </div>
      {addMode && <div className="v2-add-hint"><span>Klepněte na mapu a vyberte polohu místa.</span><button onClick={() => setAddMode(false)} aria-label="Zrušit přidání"><X size={18} /></button></div>}
      {geoError && <div className="v2-geo-error" role="status">{geoError}<button onClick={() => setGeoError('')} aria-label="Zavřít"><X size={16} /></button></div>}
      {showWelcome && <div className="v2-welcome"><button className="v2-close" onClick={dismissWelcome} aria-label="Zavřít uvítání"><X size={18} /></button><h2>Objevuj místa, která stojí za návštěvu.</h2><p>Vyhlídky, kavárny a další objevy sdílené komunitou. Mapu můžeš prozkoumat hned, bez účtu.</p><div><button className="v2-primary" onClick={dismissWelcome}>Prozkoumat bez účtu</button><button className="v2-link" onClick={() => { dismissWelcome(); setShowAuth(true); }}>Přihlásit se</button></div></div>}
      {!consent && <div className="v2-consent"><p>Používáme jen nezbytné úložiště. Analytika a reklama jsou vypnuté. <a href="/PrivacyPolicy">Podrobnosti</a></p><button onClick={() => { acknowledgeCurrentPrivacyNotice(); setConsent(true); }}>Pokračovat</button></div>}
      <section className={`v2-nearby v2-nearby-${nearbySize}`} aria-label="Poblíž">
        <button className="v2-nearby-handle" onTouchStart={event => { nearbyTouchYRef.current = event.touches[0]?.clientY ?? null; }} onTouchEnd={event => { if (nearbyTouchYRef.current == null) return; const delta = event.changedTouches[0]?.clientY - nearbyTouchYRef.current; nearbyTouchYRef.current = null; if (Math.abs(delta) < 35) return; nearbySwipedRef.current = true; window.setTimeout(() => { nearbySwipedRef.current = false; }, 500); setNearbySize(value => delta < 0 ? value === 'collapsed' ? 'partial' : 'full' : value === 'full' ? 'partial' : 'collapsed'); }} onClick={() => { if (nearbySwipedRef.current) { nearbySwipedRef.current = false; return; } setNearbySize(value => value === 'collapsed' ? 'partial' : value === 'partial' ? 'full' : 'collapsed'); }} aria-label={nearbySize === 'collapsed' ? 'Rozbalit Poblíž' : 'Změnit velikost Poblíž'}><span /></button>
        <div className="v2-nearby-heading"><button onClick={() => setNearbySize(value => value === 'collapsed' ? 'partial' : 'collapsed')}><strong>{nearbySize === 'collapsed' ? 'Poblíž' : nearbyMode === 'gps' && nearbyResults ? 'Poblíž tebe' : 'Poblíž na mapě'}</strong><small>{nearbyLoading || spotsLoading && !nearbyResults ? 'Načítám místa…' : `${visibleSpots.length}${(!nearbyComplete && nearbyResults || !nearbyResults && spots.length === 300) ? '+' : ''} míst ${nearbyResults ? nearbyMode === 'gps' ? 'u tebe' : 'od středu mapy' : 'v zobrazené mapě'}`}</small></button>{nearbySize === 'collapsed' ? <ChevronDown size={18} /> : <button className="v2-filter-button" onClick={() => setShowNearbyFilter(true)}><SlidersHorizontal size={15} /> Filtry</button>}</div>
        {nearbySize !== 'collapsed' && <><div className="v2-chips" role="group" aria-label="Kategorie">{CATEGORIES.map(name => <button key={name} className={category === name ? 'active' : ''} onClick={() => setCategory(name)}>{name}</button>)}</div>{nearbyResults && <div className="v2-nearby-context"><span>Komunitní místa · {nearbyFilters.maxDistance === Infinity ? 'širší oblast' : `do ${nearbyFilters.maxDistance} km`}{nearbyFilters.minRating ? ` · ${nearbyFilters.minRating}★+` : ''}</span><select aria-label="Řadit místa" value={nearbySort} onChange={event => setNearbySort(event.target.value)}><option value="distance">Nejbližší</option><option value="rating">Hodnocení</option><option value="newest">Nejnovější</option></select></div>}<div className="v2-nearby-list">{nearbyError ? <StateMessage retry={() => runNearby(nearbyFilters, nearbyMode)}>{nearbyError}</StateMessage> : nearbyLoading || spotsLoading && !nearbyResults ? <StateMessage>Načítám místa…</StateMessage> : spotsError && !nearbyResults ? <StateMessage retry={refreshMap}>Místa se nepodařilo načíst.</StateMessage> : visibleSpots.length ? <>{visibleSpots.slice(0, nearbyCount).map(spot => <SpotRow key={spot.id} spot={spot} onOpen={openSpot} onMap={openOnMap} />)}{visibleSpots.length > nearbyCount && <button className="v2-load-more" onClick={() => setNearbyCount(value => value + 20)}>Načíst další místa</button>}</> : <StateMessage>{nearbyResults ? nearbyComplete ? 'V této vzdálenosti nejsou místa podle vybraných filtrů.' : 'V načtené oblasti nejsou odpovídající místa.' : 'V zobrazené oblasti nejsou místa v této kategorii. Posuňte mapu nebo změňte filtr.'}</StateMessage>}</div><button className="v2-expand-control" onClick={() => setNearbySize(value => value === 'full' ? 'partial' : 'full')}>{nearbySize === 'full' ? 'Zmenšit seznam' : 'Zobrazit více'}</button></>}
      </section>
    </>)}
    <AnimatePresence initial={false} custom={previousDirection.current}>
      {(activeTab !== 'map' || searchOpen || unknownPage) && <motion.div key={location.pathname} className={`sf-new-route-surface${settingsPage ? ' is-settings' : ''}`} custom={previousDirection.current} variants={pageVariants} initial={redesigned && !reducedMotion ? 'enter' : false} animate="center" exit={redesigned && !reducedMotion ? 'exit' : 'center'} transition={redesigned && !reducedMotion ? newMotion.page : reducedTransition}>
    {activeTab === 'discover' && (redesigned
      ? <NewDiscover language={language} titleOf={spotTitle} locationOf={spotLocation} savedIds={savedIds} savingSpotId={savingSpotId} onSave={saveDiscoverSpot} onOpen={openSpot} onMap={openOnMap} />
      : <section className="v2-page"><header className="v2-page-header"><h1>Objevit</h1><p>Místa sdílená komunitou</p></header><div className="v2-chips" role="group" aria-label="Kategorie">{CATEGORIES.map(name => <button key={name} className={category === name ? 'active' : ''} onClick={() => setCategory(name)}>{name}</button>)}</div><div className="v2-scroll v2-discover-list">{featuredError && featured === null ? <StateMessage retry={() => loadDiscover()}>Místa se nepodařilo načíst.</StateMessage> : featured === null ? <StateMessage>Načítám místa…</StateMessage> : <>{featuredVisible.length ? featuredVisible.map(spot => <DiscoverCard key={spot.id} spot={spot} title={spotTitle(spot, language)} location={spotLocation(spot)} savingSpotId={savingSpotId} savedIds={savedIds} onSave={saveDiscoverSpot} onOpen={openSpot} onMap={openOnMap} />) : <StateMessage>V načtených místech tato kategorie zatím není.</StateMessage>}{featuredError && <StateMessage retry={() => loadDiscover(true)}>Další místa se nepodařilo načíst.</StateMessage>}{discoverMore && !featuredError && <button className="v2-load-more" disabled={discoverLoading} onClick={() => loadDiscover(true)}>{discoverLoading ? 'Načítám…' : 'Načíst další místa'}</button>}</>}</div></section>)}
    {activeTab === 'collection' && <section className="v2-page"><header className="v2-page-header v2-collection-header"><img src={LOGO} alt="" /><h1>Moje sbírka</h1></header>{!user ? <div className="v2-guest"><Bookmark size={30} /><h2>Ulož si svá oblíbená místa</h2><p>Pro uložená a oblíbená místa se přihlas. Veřejnou mapu můžeš procházet bez účtu.</p><button className="v2-primary" onClick={() => setShowAuth(true)}>Přihlásit se</button><button className="v2-secondary" onClick={() => chooseTab('map')}>Prozkoumat mapu</button></div> : <><div className="v2-segments" role="tablist" aria-label="Moje sbírka">{[['saved','Uložená'],['liked','Líbí se mi'],['created','Vytvořená']].map(([id,label]) => <button role="tab" aria-selected={collectionTab === id} className={collectionTab === id ? 'active' : ''} key={id} onClick={() => setCollectionTab(id)}>{label}{collection[id] && <span> {collection[id].length >= 100 ? '100+' : collection[id].length}</span>}</button>)}</div><div className="v2-collection-tools"><span>{collection[collectionTab] ? `${collection[collectionTab].length >= 100 ? '100+' : collection[collectionTab].length} míst` : 'Načítám…'}</span><button disabled={redesigned && myMapBusy} onClick={redesigned ? showMySpotsOnMap : () => chooseTab('map')}><MapIcon size={16} /> {redesigned && myMapBusy ? 'Načítám místa…' : 'Zobrazit na mapě'}</button></div>{redesigned && myMapError && <p className="sf-new-collection-error" role="alert">{myMapError}</p>}<div className="v2-scroll v2-collection-list">{collectionErrors[collectionTab] ? <StateMessage retry={loadCollection}>{collectionErrors[collectionTab]}</StateMessage> : collectionLoading && !collection[collectionTab] ? (redesigned ? <NewSkeleton kind="nearbyRows" /> : <StateMessage>Načítám sbírku…</StateMessage>) : collection[collectionTab]?.length ? collection[collectionTab].map(spot => <SpotRow key={spot.id} spot={spot} onOpen={openSpot} onMap={openOnMap} trailing={<button className="v2-row-icon" onClick={() => collectionTab === 'saved' ? setUnsaveSpot(spot) : openSpot(spot)} aria-label={`${collectionTab === 'saved' ? 'Odebrat ze sbírky:' : 'Otevřít:'} ${spotTitle(spot)}`}>{collectionTab === 'liked' ? <Heart size={19} fill="currentColor" /> : collectionTab === 'saved' ? <Bookmark size={19} fill="currentColor" /> : <ChevronRight size={19} />}</button>} />) : <StateMessage>{collectionTab === 'saved' ? 'Zatím nemáš uložená místa.' : collectionTab === 'liked' ? 'Zatím se ti nelíbí žádná místa.' : 'Zatím jsi nevytvořil žádné místo.'}</StateMessage>}</div></>}</section>}
    {activeTab === 'profile' && !settingsPage && !draftsPage && !aboutPage && <section className="v2-page"><header className="v2-page-header"><h1>Profil</h1></header><div className="v2-profile-top">{user?.photoURL ? <img src={user.photoURL} alt="" /> : <UserRound size={28} />}<div><strong>{user?.displayName || 'Objevuj jako host'}</strong><small>{user?.email || 'Přihlas se a ukládej oblíbená místa.'}</small></div></div>{user && !user.emailVerified && <div className="v2-verification"><strong>Ověř e-mailovou adresu</strong><p>Pro hodnocení a ukládání míst je potřeba ověřit e-mail.</p><button disabled={verificationBusy} onClick={async () => { setVerificationBusy(true); try { await resendVerificationEmail(); toast.success('Ověřovací e-mail byl odeslán.'); } catch { toast.error('E-mail se nepodařilo odeslat.'); } finally { setVerificationBusy(false); } }}>{verificationBusy ? 'Odesílám…' : 'Poslat ověřovací e-mail'}</button></div>}{!user && <div className="v2-profile-actions"><button className="v2-primary" onClick={() => setShowAuth(true)}>Přihlásit se / vytvořit účet</button><button className="v2-secondary" onClick={() => chooseTab('map')}>Pokračovat jako host</button></div>}<div className="v2-group">{user && <><button onClick={() => chooseTab('collection')}><Bookmark /> Moje sbírka <ChevronRight /></button><button onClick={() => { setCollectionTab('created'); chooseTab('collection'); }}><MapPin /> Vytvořená místa <ChevronRight /></button></>}<button onClick={() => navigate('/new/drafts')}><List /> Rozpracovaná místa <ChevronRight /></button><button onClick={() => navigate('/new/settings')}><Settings /> Nastavení <ChevronRight /></button>{redesigned ? <button onClick={() => navigate('/new/settings/support/faq')}><Compass /> Nápověda <ChevronRight /></button> : <a href="/FAQ"><Compass /> Nápověda <ChevronRight /></a>}<button onClick={() => navigate('/new/about')}><MapPin /> O aplikaci <ChevronRight /></button>{redesigned ? <NewLegalLink document="/PrivacyPolicy"><Layers /> Soukromí a podmínky <ChevronRight /></NewLegalLink> : <a href="/PrivacyPolicy"><Layers /> Soukromí a podmínky <ChevronRight /></a>}{user && <button onClick={() => setShowSignOut(true)}><UserRound /> Odhlásit se <ChevronRight /></button>}</div></section>}
    {settingsPage && (redesigned ? <NewSettings onSignIn={() => setShowAuth(true)} onSignOut={() => setShowSignOut(true)} mapLayer={mapLayer} onMapLayer={setMapLayer} terrain={terrain} onTerrain={setTerrain} showZoomButtons={showNewZoomButtons} onZoomButtons={changeNewZoomButtons} /> : <section className="v2-page"><header className="v2-page-header v2-subpage-header"><button onClick={() => navigate('/new/profile')} aria-label="Zpět na profil"><ChevronLeft /></button><h1>Nastavení</h1></header><div className="v2-scroll v2-settings-body"><h2>Vzhled a jazyk</h2><label className="v2-setting-row"><span>Tmavý režim<small>Přepnout vzhled aplikace a mapy.</small></span><input type="checkbox" checked={isDark} onChange={toggleTheme} /></label><label className="v2-setting-row"><span>Velikost textu<small>{textScale} %</small></span><input type="range" min="75" max="250" step="5" value={textScale} onChange={event => setTextScale(saveTextScale(event.target.value))} /></label><label className="v2-setting-row"><span>Jazyk</span><select value={language} onChange={event => setLanguage(event.target.value)}>{[...LANGUAGES, ...LANGUAGE_VARIANTS].map(item => <option key={item.code} value={item.code}>{item.nativeName}</option>)}</select></label><h2>Mapa</h2><label className="v2-setting-row"><span>Vzhled mapy</span><select value={mapLayer} onChange={event => setMapLayer(event.target.value)}><option value="basic">Základní</option><option value="outdoor">Turistická</option><option value="aerial">Letecká</option><option value="winter">Zimní</option><option value="traffic">Doprava</option></select></label><label className="v2-setting-row"><span>3D mapa</span><input type="checkbox" checked={terrain} onChange={event => setTerrain(event.target.checked)} /></label><h2>Účet a aplikace</h2><button className="v2-setting-link" onClick={() => setShowSettings(true)}>Účet a zabezpečení <ChevronRight /></button><a className="v2-setting-link" href="/FAQ">Nápověda <ChevronRight /></a><a className="v2-setting-link" href="/updates">Aktualizace <ChevronRight /></a><a className="v2-setting-link" href="/PrivacyPolicy">Soukromí a právní informace <ChevronRight /></a></div></section>)}
    {aboutPage && <section className="v2-page"><header className="v2-page-header v2-subpage-header"><button onClick={() => navigate('/new/profile')} aria-label="Zpět na profil"><ChevronLeft /></button><h1>O aplikaci</h1></header><div className="v2-about"><img src={LOGO} alt="SpotFinder" /><h2>SpotFinder</h2><p>Objevuj skutečná místa sdílená komunitou a ukládej si ta, ke kterým se chceš vrátit.</p><small>Verze {APP_VERSION}</small>{redesigned ? <><button onClick={() => navigate('/new/settings/support/faq')}>Nápověda</button><NewLegalLink document="/PrivacyPolicy">Soukromí</NewLegalLink><NewLegalLink document="/TermsAndConditions">Podmínky používání</NewLegalLink></> : <><a href="/FAQ">Nápověda</a><a href="/PrivacyPolicy">Soukromí</a><a href="/TermsAndConditions">Podmínky používání</a></>}</div></section>}
    {draftsPage && <section className="v2-page"><header className="v2-page-header v2-subpage-header"><button onClick={() => navigate('/new/profile')} aria-label="Zpět na profil"><ChevronLeft /></button><h1>Rozpracovaná místa</h1></header><div className="v2-scroll v2-drafts-list">{draftsError ? <StateMessage retry={loadDrafts}>Rozpracovaná místa se nepodařilo načíst.</StateMessage> : draftRows === null ? (redesigned ? <NewSkeleton kind="nearbyRows" /> : <StateMessage>Načítám rozpracovaná místa…</StateMessage>) : draftRows.length ? draftRows.map(item => <article className="v2-draft-row" key={item.id}><div className="v2-draft-icon"><MapPin size={23} /></div><div className="v2-draft-copy"><strong>{draftTitle(item)}</strong><small>{draftDate(item.updated_at || item.created_at)}</small></div><button className="v2-draft-resume" onClick={() => { const coords = normalizeLatLng(item); if (!coords) { toast.error('Návrh nemá platnou polohu.'); return; } if (redesigned) setQuickAdd({ coords: { lat: coords[0], lng: coords[1] }, draft: item }); else { setDraft(item); setAddAt({ lat: coords[0], lng: coords[1] }); } navigate('/new/map'); }}>Pokračovat</button><button className="v2-draft-delete" aria-label={`Smazat ${draftTitle(item)}`} onClick={() => setDraftToDelete(item)}><X size={18} /></button></article>) : <StateMessage>Nemáš žádná rozpracovaná místa.</StateMessage>}</div></section>}
    {unknownPage && <section className="v2-page v2-not-found"><MapPin size={34} /><h1>Stránka nebyla nalezena</h1><p>Požadovaná stránka není dostupná.</p><button className="v2-primary" onClick={() => navigate('/new')}>Zpět na mapu</button></section>}
    {searchOpen && <SearchPanel spots={PUBLIC_SNAPSHOT_PREVIEW && redesigned ? searchSourceSpots : spots} center={center} voiceQuery={voiceQuery} redesigned={redesigned} searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} voiceInput={searchVoice} onClose={() => { searchVoice.stop(); setSearchQuery(''); setVoiceQuery(''); navigate(location.key === 'default' ? '/new' : -1); }} onSpot={openSpot} onPlace={selectSearchPlace} />}
      </motion.div>}
    </AnimatePresence>
    {!online && <div className="v2-offline" role="status">Jsi offline. Některá místa a mapové podklady nemusí být dostupné.</div>}
    {redesigned ? <NewBottomNav selectedNav={selectedNav} language={language} chooseTab={chooseTab} /> : <nav className="v2-nav" aria-label="Hlavní navigace">{TABS.map(([id,label,Icon]) => <button key={id} type="button" className={`${selectedNav === id ? 'active' : ''} ${id === 'add' ? 'v2-add-tab' : ''}`} aria-current={selectedNav === id ? 'page' : undefined} onClick={() => chooseTab(id)}><span><Icon size={id === 'add' ? 21 : 19} strokeWidth={1.8} /></span><small>{label}</small></button>)}</nav>}
    {showSignOut && <SignOutDialog busy={signOutBusy} onCancel={() => setShowSignOut(false)} onConfirm={confirmSignOut} />}
    {draftToDelete && <div className="v2-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDraftToDelete(null); }}><section className="v2-confirm" role="alertdialog" aria-modal="true" aria-labelledby="v2-delete-draft-title" onKeyDown={event => { if (event.key === 'Escape') setDraftToDelete(null); }}><h2 id="v2-delete-draft-title">Smazat rozpracované místo?</h2><p>„{draftTitle(draftToDelete)}“ a jeho soukromé fotografie budou odstraněny.</p><div><button autoFocus className="v2-secondary" onClick={() => setDraftToDelete(null)}>Ponechat</button><button className="v2-danger" disabled={draftDeleteBusy} onClick={confirmDeleteDraft}>{draftDeleteBusy ? 'Mažu…' : 'Smazat'}</button></div></section></div>}
    {unsaveSpot && <div className="v2-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setUnsaveSpot(null); }}><section className="v2-confirm" role="alertdialog" aria-modal="true" aria-labelledby="v2-unsave-title" onKeyDown={event => { if (event.key === 'Escape') setUnsaveSpot(null); }}><h2 id="v2-unsave-title">Odebrat uložené místo?</h2><p>„{getSpotDisplayName(unsaveSpot, language)}“ zmizí ze seznamu uložených míst.</p><div><button autoFocus className="v2-secondary" onClick={() => setUnsaveSpot(null)}>Ponechat</button><button className="v2-secondary" disabled={unsaveBusy} onClick={confirmUnsave}>{unsaveBusy ? 'Odebírám…' : 'Odebrat'}</button></div></section></div>}
    <Suspense fallback={redesigned && selectedPoi ? <NewSkeleton kind="poiPreview" /> : redesigned && selectedSpot ? <NewSkeleton kind="detail" /> : null}>
      {selectedSpot && !editingSpot && <SpotDetailModal spot={selectedSpot} user={user} redesigned={redesigned} onClose={closeSpot} onNavigate={setNavigationDestination} onShowAuth={() => setShowAuth(true)} onEdit={() => { setEditingSpot(selectedSpot); setSelectedSpot(null); }} onDelete={async () => { await deleteSpot(selectedSpot.id); setSpots(rows => rows.filter(row => row.id !== selectedSpot.id)); setCollection({}); cacheRef.current = null; window.dispatchEvent(new CustomEvent('spotfinder:collection-changed')); closeSpot(); }} onSpotUpdate={updated => { selectedSpotRef.current = updated; setSelectedSpot(updated); setSpots(rows => rows.map(row => row.id === updated.id ? updated : row)); }} />}
      {editingSpot && (redesigned ? <QuickAddFlow key={`edit-${editingSpot.id}`} mode="edit" spot={editingSpot} coords={(() => { const pair = normalizeLatLng(editingSpot); return pair ? { lat: pair[0], lng: pair[1] } : null; })()} user={user} onClose={() => { setSelectedSpot(editingSpot); setEditingSpot(null); }} onUpdate={async patch => { await updateSpot(editingSpot.id, patch); const updated = { ...editingSpot, ...patch }; setSpots(rows => rows.map(row => row.id === updated.id ? updated : row)); setSelectedSpot(updated); selectedSpotRef.current = updated; setCollection({}); cacheRef.current = null; window.dispatchEvent(new CustomEvent('spotfinder:collection-changed')); setEditingSpot(null); }} /> : <EditSpotModal spot={editingSpot} user={user} onClose={() => { setEditingSpot(null); closeSpot(); }} onSave={async updated => { await updateSpot(updated.id, updated); setSpots(rows => rows.map(row => row.id === updated.id ? updated : row)); setCollection({}); cacheRef.current = null; window.dispatchEvent(new CustomEvent('spotfinder:collection-changed')); setEditingSpot(null); closeSpot(); }} />)}
      {selectedPoi && <POIDetailPanel poi={selectedPoi.poi} category={selectedPoi.cat} user={user} redesigned={redesigned} onClose={() => setSelectedPoi(null)} onNavigate={setNavigationDestination} />}
      {navigationDestination && <NavigationProviderSheet destination={navigationDestination} redesigned={redesigned} onClose={() => setNavigationDestination(null)} />}
      {addAt && <AddSpotModal mobileV2 redesigned={redesigned} latlng={addAt} draft={draft} user={user} onClose={() => { setAddAt(null); setDraft(null); }} onSave={async (data, socialUrl = '') => { let created = await createSpot(data); if (socialUrl) { try { await addSocialPost({ url: socialUrl, targetType: 'spot', targetId: String(created.id), targetName: getSpotDisplayName(created, language) }); created = { ...created, has_social: true }; } catch { toast.error('Místo bylo uloženo, ale mediální příspěvek se nepodařilo připojit.'); } } setSpots(rows => [created, ...rows]); cacheRef.current = null; window.dispatchEvent(new CustomEvent('spotfinder:collection-changed')); return created; }} />}
      {showNearbyFilter && <NearbySpotsFilterModal isOpen onClose={() => { setShowNearbyFilter(false); setFilterLocationError(''); }} onApply={runNearby} currentFilters={nearbyFilters} currentMode={nearbyMode} locationError={filterLocationError} busy={nearbyLoading} />}
      {redesigned && (showAuth || authPage) ? <NewAuth initialScreen={location.pathname.endsWith('/register') ? 'register' : 'login'} onClose={closeNewAuth} /> : showAuth && <AuthModal mobileV2 onClose={() => setShowAuth(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </Suspense>
  </div>;
}
