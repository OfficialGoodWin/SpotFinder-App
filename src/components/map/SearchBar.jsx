import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Navigation, Mic, Compass, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { filterCategories, getCategoryName } from '@/lib/POICategories';
import { iconGlyphSVG } from '@/lib/mapIcons';
import { searchPlaces } from '@/lib/placeSearch';
import { getSpotDisplayName, spotMatchesSearch } from '@/lib/spotPresentation';
import { voiceErrorMessage } from '@/lib/contributionFlow';


const LANG_TO_BCP47 = {
  en: 'en-US', cs: 'cs-CZ', pl: 'pl-PL', de: 'de-DE', sk: 'sk-SK',
  it: 'it-IT', fr: 'fr-FR', ru: 'ru-RU', uk: 'uk-UA', hu: 'hu-HU',
  ro: 'ro-RO', es: 'es-ES', bg: 'bg-BG',
};

export default function SearchBar({ onSelect, mapCenter, onNavigate, onSelectCategory, spots = [], onSelectSpot, onOpenNearbyFilters }) {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [spotResults, setSpotResults] = useState([]);
  const [poiCategories, setPoiCategories] = useState([]);
  const [focused, setFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchPhase, setSearchPhase] = useState('idle');
  const [retryCount, setRetryCount] = useState(0);
  const debounce = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const searchAbortRef = useRef(null);
  const containerRef = useRef(null);
  const bcp47 = language.includes('-') ? language : (LANG_TO_BCP47[language] || language || 'en-US');

  // Close dropdown when clicking/touching outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeDropdown();
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
    clearTimeout(debounce.current);
    searchAbortRef.current?.abort();
    if (!query.trim() || !focused) {
      setResults([]);
      setSpotResults([]);
      setPoiCategories([]);
      setSearchError('');
      setSearchPhase('idle');
      return;
    }
    const categories = filterCategories(query, language);
    setPoiCategories(categories);

    // Search spots by title, description, and hashtag tags (e.g. "#viewpoint")
    const matched = (spots || []).filter(spot => spotMatchesSearch(spot, query, language)).slice(0, 5);
    setSpotResults(matched);
    setResults([]);
    setSearchError('');
    setSearchPhase('searching');
    const controller = new AbortController();
    searchAbortRef.current = controller;
    debounce.current = setTimeout(async () => {
      try {
        // Merge independent POI/place providers and request one selected UI language.
        const places = await searchPlaces(query, { center: mapCenter, language, signal: controller.signal, limit: 10 });
        if (!controller.signal.aborted) {
          setResults(places);
          setSearchPhase(places.length || categories.length || matched.length ? 'results' : 'empty');
        }
      } catch (error) {
        if (!controller.signal.aborted && error?.name !== 'AbortError') {
          setResults([]);
          setSearchError(t('searchUi.unavailable'));
          setSearchPhase('error');
        }
      }
    }, 350);
    return () => { clearTimeout(debounce.current); controller.abort(); };
  }, [query, language, mapCenter?.lat, mapCenter?.lng, spots, focused, retryCount]);

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

  const showDropdown = focused && !!query.trim() && searchPhase !== 'idle';
  const isExpanded = showDropdown || listening || (micError && !listening);

  return (
    <div ref={containerRef} className="sf-map-search absolute left-4 z-[1002]" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
      <div className={`border bg-card/95 shadow-md backdrop-blur-xl transition-[border-radius,border-color] ${isExpanded ? 'rounded-t-2xl' : 'rounded-full'} ${focused ? 'border-primary ring-2 ring-primary/15' : 'border-border'}`}>
        <div className="flex items-center px-3 gap-1.5">
          <Search className="w-4 h-4 text-gray-400 dark:text-muted-foreground flex-shrink-0" />
          <input
            data-spotfinder-search
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={t('search.placeholder')}
            aria-label={t('searchUi.searchLabel')}
            className="flex-1 py-3 text-sm outline-none bg-transparent text-gray-800 dark:text-foreground placeholder-gray-400 dark:placeholder-muted-foreground min-w-0"
          />
          {query && (
            <button onClick={() => { setQuery(''); closeDropdown(); }} className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg hover:bg-muted" aria-label={t('searchUi.clear')}>
              <X className="w-3.5 h-3.5 text-gray-400 dark:text-muted-foreground" />
            </button>
          )}
          <button
            onMouseDown={e => { e.preventDefault(); toggleMic(); }}
            type="button"
            aria-label={t(listening ? 'searchUi.voiceStop' : 'searchUi.voiceStart')}
            aria-pressed={listening}
            className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg transition-colors ${listening ? 'bg-red-500 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Mic className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-gray-200 dark:bg-border flex-shrink-0" />

          <button type="button" onClick={() => onOpenNearbyFilters?.()} className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary" title={t('nearbyUi.title')} aria-label={t('searchUi.nearbyFilters')}>
            <Compass className="h-5 w-5" />
          </button>
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
                      aria-label={t('searchUi.navigateTo', { name: item.name || item.label })}
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
                  aria-label={t('searchUi.openSpot', { name: getSpotDisplayName(spot, language) })}
                  className="flex-1 text-left px-4 py-2.5 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-green-100 dark:bg-green-900/30">
                    <span className="text-lg">📍</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-2 break-words text-sm font-medium text-gray-800 dark:text-foreground">{getSpotDisplayName(spot, language)}</p>
                    {spot.description && (
                      <p className="text-xs text-gray-400 dark:text-muted-foreground truncate">{spot.description}</p>
                    )}
                  </div>
                </button>
              </div>
            ))}

            {searchPhase === 'searching' && (
              <div role="status" className="px-4 py-2 text-xs text-gray-500 dark:text-muted-foreground">{t('search.searching')}</div>
            )}
            {searchPhase === 'empty' && (
              <div role="status" className="px-4 py-3 text-xs text-gray-600 dark:text-muted-foreground">
                {t('searchUi.noResults')}
                <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="ml-2 font-semibold text-primary underline underline-offset-2">{t('searchUi.clear')}</button>
              </div>
            )}
            {searchPhase === 'error' && (
              <div role="status" className="flex items-center gap-2 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{searchError}</span>
                <button type="button" onClick={() => setRetryCount(count => count + 1)} className="min-h-9 rounded-lg px-2 font-semibold text-primary hover:bg-primary/10">{t('searchUi.retry')}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
