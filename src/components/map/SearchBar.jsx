import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Navigation, Mic, Compass, SlidersHorizontal, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { filterCategories, getCategoryName } from '@/lib/POICategories';
import { iconGlyphSVG } from '@/lib/mapIcons';
import { searchPlaces } from '@/lib/placeSearch';
import { NEARBY_DEFAULT_KM, NEARBY_SLIDER_MAX, sliderToKm, kmToSlider, formatMaxDistance } from '@/lib/nearbyFilters';
import LiquidSegmentedControl from '@/components/ui/LiquidSegmentedControl';
import { getSpotDisplayName, spotMatchesSearch } from '@/lib/spotPresentation';
import { toast } from 'sonner';
import { searchFailureMessage, voiceErrorMessage } from '@/lib/contributionFlow';


const LANG_TO_BCP47 = {
  en: 'en-US', cs: 'cs-CZ', pl: 'pl-PL', de: 'de-DE', sk: 'sk-SK',
  it: 'it-IT', fr: 'fr-FR', ru: 'ru-RU', uk: 'uk-UA', hu: 'hu-HU',
  ro: 'ro-RO', es: 'es-ES', bg: 'bg-BG',
};

export default function SearchBar({ onSelect, mapCenter, onNavigate, onSelectCategory, spots = [], onSelectSpot, userPos, onNearby, onRequestLocation }) {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [spotResults, setSpotResults] = useState([]);
  const [poiCategories, setPoiCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [showNearbyFilter, setShowNearbyFilter] = useState(false);
  const [nearbyDraft, setNearbyDraft] = useState({ maxDistance: NEARBY_DEFAULT_KM, minRating: 0 });
  const debounce = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const searchAbortRef = useRef(null);
  const containerRef = useRef(null);
  const bcp47 = LANG_TO_BCP47[language] || 'en-US';

  // Close dropdown when clicking/touching outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeDropdown();
        setShowNearbyFilter(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, []);

  const closeDropdown = () => {
    setResults([]);
    setSpotResults([]);
    setPoiCategories([]);
    setFocused(false);
  };

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSpotResults([]);
      setPoiCategories([]);
      setSearchError('');
      return;
    }
    setPoiCategories(filterCategories(query, language));

    // Search spots by title, description, and hashtag tags (e.g. "#viewpoint")
    const matched = (spots || []).filter(spot => spotMatchesSearch(spot, query, language)).slice(0, 5);
    setSpotResults(matched);

    clearTimeout(debounce.current);
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    debounce.current = setTimeout(async () => {
      setLoading(true);
      setSearchError('');
      try {
        // Merge independent POI/place providers and request one selected UI language.
        const places = await searchPlaces(query, { center: mapCenter, language, signal: controller.signal, limit: 10 });
        if (!controller.signal.aborted) setResults(places);
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setResults([]);
          setSearchError(searchFailureMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(debounce.current); controller.abort(); };
  }, [query, language, mapCenter?.lat, mapCenter?.lng, spots]);

  const handleSelect = (item) => {
    const pos = item.position || item.regionalStructure?.[0];
    if (pos) onSelect({ lat: pos.lat, lng: pos.lon || pos.lng, label: item.name || item.label });
    setQuery(item.name || item.label || '');
    closeDropdown();
    inputRef.current?.blur();
  };

  const handleSelectCategory = (category) => {
    if (onSelectCategory) {
      onSelectCategory(category);
      setQuery('');
      closeDropdown();
      inputRef.current?.blur();
    }
  };

  const startListening = useCallback(async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setMicError(voiceErrorMessage('unsupported')); return; }
    if (recognitionRef.current) recognitionRef.current.abort();
    setMicError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
        setMicError(voiceErrorMessage('unsupported'));
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some(d => d.kind === 'audioinput');
      if (!hasMic) { setMicError(voiceErrorMessage('no-device')); return; }
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setMicError(voiceErrorMessage(err));
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = bcp47;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      setMicError(voiceErrorMessage(e));
    };
    rec.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setQuery(transcript);
      inputRef.current?.focus();
    };
    recognitionRef.current = rec;
    rec.start();
  }, [bcp47]);

  const toggleMic = () => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); }
    else startListening();
  };

  const showDropdown = focused && (poiCategories.length > 0 || results.length > 0 || spotResults.length > 0 || (loading && !!query));
  const isExpanded = showDropdown || listening || Boolean(searchError) || (micError && !listening);

  return (
    <div ref={containerRef} className="sf-map-search absolute left-4 z-[1002]" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
      <div className={`border bg-card/95 shadow-md backdrop-blur-xl transition-[border-radius,border-color] ${isExpanded ? 'rounded-t-2xl' : 'rounded-full'} ${focused ? 'border-primary ring-2 ring-primary/15' : 'border-border'}`}>
        <div className="flex items-center px-3 gap-1.5">
          <Search className="w-4 h-4 text-gray-400 dark:text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={t('search.placeholder')}
            aria-label="Search places and community spots"
            className="flex-1 py-3 text-sm outline-none bg-transparent text-gray-800 dark:text-foreground placeholder-gray-400 dark:placeholder-muted-foreground min-w-0"
          />
          {query && (
            <button onClick={() => { setQuery(''); closeDropdown(); }} className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg hover:bg-muted" aria-label="Clear search">
              <X className="w-3.5 h-3.5 text-gray-400 dark:text-muted-foreground" />
            </button>
          )}
          <button
            onMouseDown={e => { e.preventDefault(); toggleMic(); }}
            type="button"
            aria-label={listening ? 'Stop voice search' : 'Start voice search'}
            aria-pressed={listening}
            className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg transition-colors ${listening ? 'bg-red-500 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Mic className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-gray-200 dark:bg-border flex-shrink-0" />

          {/* Nearby spots — opens a quick filter popover on click */}
          <div className="relative">
            <button
              onClick={async () => {
                if (!userPos) {
                  const position = await onRequestLocation?.();
                  if (!position) toast.error(t('home.locationRequestFailed', 'Location is unavailable. Check browser permissions or search the map instead.'));
                  else setShowNearbyFilter(true);
                  return;
                }
                setShowNearbyFilter(v => !v);
              }}
              className={`px-2 py-1.5 rounded-lg flex-shrink-0 transition-all active:scale-95 ${
                showNearbyFilter
                  ? 'text-emerald-600 bg-emerald-500/15 ring-1 ring-emerald-500/20'
                  : 'text-gray-500 dark:text-muted-foreground hover:text-gray-700'
              }`}
              title="Nearby spots"
              aria-label="Nearby spots filters"
              aria-expanded={showNearbyFilter}
            >
              <Compass className="w-5 h-5" />
            </button>
            {showNearbyFilter && (
                <div className="sf-nearby-filter-card absolute top-full right-0 mt-3 z-[1600] w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain p-4 sm:p-5">
                  <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/20"><SlidersHorizontal className="h-5 w-5" /></span>
                      <div><p className="text-sm font-bold text-gray-900 dark:text-foreground">Nearby spots</p><p className="text-[11px] text-gray-500 dark:text-muted-foreground">Fine-tune what appears</p></div>
                    </div>
                    <button onClick={() => setShowNearbyFilter(false)} className="sf-filter-icon-button" aria-label="Close nearby filters">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="sf-nearby-filter-grid">
                  <div className="sf-filter-section">
                    <div className="flex justify-between items-center text-xs font-semibold text-gray-600 dark:text-muted-foreground mb-2">
                      <span>Maximum distance</span>
                      <output className="sf-filter-value">{formatMaxDistance(nearbyDraft.maxDistance)}</output>
                    </div>
                    <input
                      type="range" min="1" max={NEARBY_SLIDER_MAX} value={kmToSlider(nearbyDraft.maxDistance)}
                      onChange={(e) => setNearbyDraft(d => ({ ...d, maxDistance: sliderToKm(e.target.value) }))}
                      className="sf-glass-range w-full"
                      style={{ '--sf-range-progress': `${((kmToSlider(nearbyDraft.maxDistance) - 1) / (NEARBY_SLIDER_MAX - 1)) * 100}%` }}
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 dark:text-muted-foreground mt-1 px-0.5">
                      <span>1 km</span><span>50 km</span><span>∞</span>
                    </div>
                  </div>
                  <div className="sf-filter-section mt-3">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-muted-foreground mb-2">Minimum rating</label>
                    <LiquidSegmentedControl
                      ariaLabel="Minimum rating"
                      equal
                      tone="green"
                      value={String(nearbyDraft.minRating)}
                      onChange={rating => setNearbyDraft(d => ({ ...d, minRating: Number(rating) }))}
                      options={[0, 3, 3.5, 4, 4.5].map(rating => ({ value: String(rating), label: rating === 0 ? 'Any' : `${rating}★` }))}
                    />
                  </div>
                  </div>
                  <div className="sf-nearby-filter-actions grid grid-cols-[.8fr_1.2fr] gap-2 mt-4">
                    <button
                      onClick={() => setShowNearbyFilter(false)}
                      className="sf-filter-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { onNearby?.(nearbyDraft); setShowNearbyFilter(false); }}
                      className="sf-filter-primary"
                    >
                      Show Nearby
                    </button>
                  </div>
                </div>
            )}
          </div>
        </div>

        {listening && (
          <div className="px-4 py-1.5 border-t border-gray-100 dark:border-border flex items-center gap-2 rounded-b-2xl">
            <span className="flex gap-0.5 items-end h-4">
              {[1,2,3].map(i => (
                <span key={i} className="w-1 rounded-full bg-red-500 animate-bounce inline-block"
                  style={{ height: `${8 + i*4}px`, animationDelay: `${i*0.12}s` }} />
              ))}
            </span>
            <span className="text-xs text-red-500 font-medium">{t('search.listening')}</span>
          </div>
        )}
        {micError && !listening && (
          <div role="status" className="mx-2 mb-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-xs font-medium leading-5">{micError}</span>
          </div>
        )}
        {searchError && !loading && (
          <div role="status" className="mx-2 mb-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-xs font-medium leading-5">{searchError}</span>
          </div>
        )}

        {showDropdown && (
          <div className="sf-menu-motion border-t border-gray-100 dark:border-border max-h-[min(26rem,65dvh)] overflow-y-auto rounded-b-2xl bg-white/95 dark:bg-card/95 backdrop-blur-xl">
            {poiCategories.map((cat, i) => (
              <div key={`cat-${i}`} className="flex items-center hover:bg-gray-50 dark:hover:bg-accent transition-colors">
                <button
                  onMouseDown={e => { e.preventDefault(); handleSelectCategory(cat); }}
                  onTouchEnd={e => { e.preventDefault(); handleSelectCategory(cat); }}
                  className="flex-1 text-left px-4 py-2.5 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${cat.color}20`, color: cat.color }}>
                    <span dangerouslySetInnerHTML={{ __html: iconGlyphSVG(cat.key, 18, cat.color) }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate">{getCategoryName(cat, language)}</p>
                  </div>
                </button>
              </div>
            ))}

            {results.map((item, i) => {
              const pos = item.position || item.regionalStructure?.[0];
              return (
                <div key={`geo-${i}`} className="flex items-center hover:bg-gray-50 dark:hover:bg-accent transition-colors">
                  <button
                    onMouseDown={e => { e.preventDefault(); handleSelect(item); }}
                    onTouchEnd={e => { e.preventDefault(); handleSelect(item); }}
                    className="flex-1 text-left px-4 py-2.5"
                  >
                    <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate">{item.name || item.label}</p>
                    <p className="text-xs text-gray-400 dark:text-muted-foreground truncate">
                      {item.location || item.regionalStructure?.map(r => r.name).join(', ')}
                    </p>
                    {item.provider && <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600/80 dark:text-emerald-400/80">{item.provider}</p>}
                  </button>
                  {pos && onNavigate && (
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onNavigate({ lat: pos.lat, lng: pos.lon ?? pos.lng, label: item.name || item.label }); closeDropdown(); }}
                      onTouchEnd={e => { e.preventDefault(); e.stopPropagation(); onNavigate({ lat: pos.lat, lng: pos.lon ?? pos.lng, label: item.name || item.label }); closeDropdown(); }}
                      onClick={e => { if (e.detail === 0) { onNavigate({ lat: pos.lat, lng: pos.lon ?? pos.lng, label: item.name || item.label }); closeDropdown(); } }}
                      className="grid min-h-11 min-w-11 place-items-center text-primary hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-accent"
                      aria-label={`Navigate to ${item.name || item.label}`}
                    >
                      <Navigation className="w-5 h-5" />
                    </button>
                  )}
                </div>
              );
            })}

            {spotResults.map((spot, i) => (
              <div key={`spot-${i}`} className="flex items-center hover:bg-gray-50 dark:hover:bg-accent transition-colors">
                <button
                  onMouseDown={e => { e.preventDefault(); onSelectSpot?.(spot); setQuery(getSpotDisplayName(spot, language)); closeDropdown(); }}
                  onTouchEnd={e => { e.preventDefault(); onSelectSpot?.(spot); setQuery(getSpotDisplayName(spot, language)); closeDropdown(); }}
                  className="flex-1 text-left px-4 py-2.5 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-green-100 dark:bg-green-900/30">
                    <span className="text-lg">📍</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate">{getSpotDisplayName(spot, language)}</p>
                    {spot.description && (
                      <p className="text-xs text-gray-400 dark:text-muted-foreground truncate">{spot.description}</p>
                    )}
                  </div>
                </button>
              </div>
            ))}

            {loading && !!query && !results.length && !poiCategories.length && !spotResults.length && (
              <div className="px-4 py-2 text-xs text-gray-400 dark:text-muted-foreground">{t('search.searching')}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
