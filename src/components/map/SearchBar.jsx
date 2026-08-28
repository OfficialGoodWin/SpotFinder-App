import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Navigation, Mic, Compass } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { filterCategories, getCategoryName } from '@/lib/POICategories';


const LANG_TO_BCP47 = {
  en: 'en-US', cs: 'cs-CZ', pl: 'pl-PL', de: 'de-DE', sk: 'sk-SK',
  it: 'it-IT', fr: 'fr-FR', ru: 'ru-RU', uk: 'uk-UA', hu: 'hu-HU',
  ro: 'ro-RO', es: 'es-ES', bg: 'bg-BG',
};

export default function SearchBar({ onSelect, mapCenter, onNavigate, onSelectCategory, spots = [], onSelectSpot, userPos, onNearby }) {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [spotResults, setSpotResults] = useState([]);
  const [poiCategories, setPoiCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState('');
  const [showNearbyFilter, setShowNearbyFilter] = useState(false);
  const [nearbyDraft, setNearbyDraft] = useState({ maxDistance: 50, minRating: 0 });
  const debounce = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const containerRef = useRef(null);
  const bcp47 = LANG_TO_BCP47[language] || 'en-US';

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
    if (!query.trim()) {
      setResults([]);
      setSpotResults([]);
      setPoiCategories([]);
      return;
    }
    setPoiCategories(filterCategories(query, language));

    // Search spots by title, description, and hashtag tags (e.g. "#viewpoint")
    const q = query.toLowerCase().replace(/^#/, '');
    const matched = (spots || []).filter(s => {
      if (s.title?.toLowerCase().includes(q)) return true;
      if (s.description?.toLowerCase().includes(q)) return true;
      if ((s.tags || []).some(tag => String(tag).toLowerCase().includes(q))) return true;
      return false;
    }).slice(0, 5);
    setSpotResults(matched);

    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        // OSM Nominatim — search with local language names.
        // We request both the user's language AND no language preference so
        // Nominatim returns local names (Plzeň, not Pilsen).
        // Also send a second request for the user's query language so searching
        // "Pilsen" still finds Plzeň via Nominatim's name matching.
        const near = mapCenter
          ? `&lat=${mapCenter.lat}&lon=${mapCenter.lng}&bounded=0`
          : '';
        // Use /nominatim proxy (defined in vercel.json) to avoid CORS issues
        const base = `/nominatim/search?format=json&limit=6&addressdetails=1&namedetails=1${near}`;

        // Two parallel fetches: local language + fallback for cross-language search
        const [res1, res2] = await Promise.all([
          fetch(`${base}&q=${encodeURIComponent(query)}&accept-language=cs,sk,de,pl,en`),
          fetch(`${base}&q=${encodeURIComponent(query)}&accept-language=${language}`),
        ]);

        const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

        // Merge and deduplicate by place_id, preferring local names
        const seen = new Set();
        const merged = [...(data1 || []), ...(data2 || [])].filter(item => {
          if (seen.has(item.place_id)) return false;
          seen.add(item.place_id);
          return true;
        });

        setResults(merged.map(item => {
          // Prefer local name over English name
          const localName = item.namedetails?.name
            || item.namedetails?.['name:cs']
            || item.namedetails?.['name:sk']
            || item.display_name?.split(',')[0]
            || item.name
            || '';
          const country  = item.address?.country || '';
          const state    = item.address?.state || item.address?.county || '';
          const subtitle = [state, country].filter(Boolean).join(', ');
          return {
            name:     localName,
            label:    localName,
            location: subtitle,
            position: { lat: parseFloat(item.lat), lon: parseFloat(item.lon) },
          };
        }));
      } catch { setResults([]); }
      setLoading(false);
    }, 400);
  }, [query]);

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
    if (!SpeechRecognition) { alert(t('addSpot.voiceNotSupported')); return; }
    if (recognitionRef.current) recognitionRef.current.abort();
    setMicError('');
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some(d => d.kind === 'audioinput');
      if (!hasMic) { setMicError('Error: no microphone detected'); return; }
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setMicError(err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError'
        ? 'Error: no microphone detected'
        : 'Error: microphone permission was not allowed');
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
      if (e.error === 'no-speech') return;
      setMicError(e.error === 'not-allowed'
        ? 'Error: microphone permission was not allowed'
        : 'Error: no microphone detected');
    };
    rec.onresult = (e) => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setQuery(transcript);
      inputRef.current?.focus();
    };
    recognitionRef.current = rec;
    rec.start();
  }, [bcp47, t]);

  const toggleMic = () => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); }
    else startListening();
  };

  const showDropdown = focused && (poiCategories.length > 0 || results.length > 0 || spotResults.length > 0 || (loading && !!query));
  const isExpanded = showDropdown || listening || (micError && !listening);

  return (
    <div ref={containerRef} className="absolute top-4 left-4 z-[1002]" style={{ right: '3.75rem' }}>
      <div className={`bg-white dark:bg-card shadow-lg border transition-all ${isExpanded ? 'rounded-t-2xl' : 'rounded-full'} ${focused ? 'border-blue-400 dark:border-blue-500' : 'border-gray-200 dark:border-border'}`}>
        <div className="flex items-center px-3 gap-1.5">
          <Search className="w-4 h-4 text-gray-400 dark:text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={t('search.placeholder')}
            className="flex-1 py-3 text-sm outline-none bg-transparent text-gray-800 dark:text-foreground placeholder-gray-400 dark:placeholder-muted-foreground min-w-0"
          />
          {query && (
            <button onClick={() => { setQuery(''); closeDropdown(); }} className="p-1 flex-shrink-0">
              <X className="w-3.5 h-3.5 text-gray-400 dark:text-muted-foreground" />
            </button>
          )}
          <button
            onMouseDown={e => { e.preventDefault(); toggleMic(); }}
            className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${listening ? 'bg-red-500 text-white' : 'text-gray-400 dark:text-muted-foreground hover:text-gray-600'}`}
          >
            <Mic className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-gray-200 dark:bg-border flex-shrink-0" />

          {/* Nearby spots — opens a quick filter popover on click */}
          <div className="relative">
            <button
              onClick={() => {
                if (!userPos) { alert(t('search.enableLocation') || 'Enable location to find nearby spots'); return; }
                setShowNearbyFilter(v => !v);
              }}
              className={`px-2 py-1.5 rounded-lg flex-shrink-0 transition-all active:scale-95 ${
                showNearbyFilter
                  ? 'text-purple-600 bg-purple-600/10'
                  : 'text-gray-500 dark:text-muted-foreground hover:text-gray-700'
              }`}
              title="Nearby spots"
            >
              <Compass className="w-5 h-5" />
            </button>
            {showNearbyFilter && (
              <>
                <div className="fixed inset-0 z-[1500]" onClick={() => setShowNearbyFilter(false)} />
                <div className="absolute top-full right-0 mt-3 z-[1600] w-64 rounded-2xl shadow-xl border border-gray-200 dark:border-border bg-white dark:bg-card p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-bold text-gray-900 dark:text-foreground">Filter Nearby</span>
                    <button onClick={() => setShowNearbyFilter(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-accent">
                      <X className="w-3.5 h-3.5 text-gray-400 dark:text-muted-foreground" />
                    </button>
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs font-semibold text-gray-600 dark:text-muted-foreground mb-1">
                      <span>Max Distance</span>
                      <span className="text-purple-600 dark:text-purple-400">{nearbyDraft.maxDistance} km</span>
                    </div>
                    <input
                      type="range" min="1" max="50" value={nearbyDraft.maxDistance}
                      onChange={(e) => setNearbyDraft(d => ({ ...d, maxDistance: Number(e.target.value) }))}
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-muted-foreground mb-1.5">Minimum Rating</label>
                    <div className="flex items-center gap-1.5">
                      {[0, 3, 3.5, 4, 4.5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setNearbyDraft(d => ({ ...d, minRating: rating }))}
                          className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition ${
                            nearbyDraft.minRating === rating
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white dark:bg-background text-gray-700 dark:text-foreground border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-accent'
                          }`}
                        >
                          {rating === 0 ? 'Any' : `${rating}★`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowNearbyFilter(false)}
                      className="flex-1 py-2 rounded-xl text-xs font-medium text-gray-500 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-accent border border-gray-200 dark:border-border"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { onNearby?.(nearbyDraft); setShowNearbyFilter(false); }}
                      className="flex-1 py-2 rounded-xl text-xs font-medium bg-purple-600 text-white hover:bg-purple-700"
                    >
                      Show Nearby
                    </button>
                  </div>
                </div>
              </>
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
          <div className="px-4 py-1.5 border-t border-gray-100 dark:border-border rounded-b-2xl">
            <span className="text-xs text-red-500 font-medium">{micError}</span>
          </div>
        )}

        {showDropdown && (
          <div className="border-t border-gray-100 dark:border-border max-h-64 overflow-y-auto rounded-b-2xl bg-white dark:bg-card">
            {poiCategories.map((cat, i) => (
              <div key={`cat-${i}`} className="flex items-center hover:bg-gray-50 dark:hover:bg-accent transition-colors">
                <button
                  onMouseDown={e => { e.preventDefault(); handleSelectCategory(cat); }}
                  onTouchEnd={e => { e.preventDefault(); handleSelectCategory(cat); }}
                  className="flex-1 text-left px-4 py-2.5 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${cat.color}20`, color: cat.color }}>
                    <span className="text-lg">{cat.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate">{getCategoryName(cat, language)}</p>
                    <p className="text-xs text-gray-400 dark:text-muted-foreground truncate">{cat.desc}</p>
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
                  </button>
                  {pos && onNavigate && (
                    <button
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onNavigate({ lat: pos.lat, lng: pos.lon || pos.lng, label: item.name || item.label }); closeDropdown(); }}
                      className="px-3 py-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-accent transition-colors"
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
                  onMouseDown={e => { e.preventDefault(); onSelectSpot?.(spot); setQuery(spot.title || ''); closeDropdown(); }}
                  onTouchEnd={e => { e.preventDefault(); onSelectSpot?.(spot); setQuery(spot.title || ''); closeDropdown(); }}
                  className="flex-1 text-left px-4 py-2.5 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-green-100 dark:bg-green-900/30">
                    <span className="text-lg">📍</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate">{spot.title || 'Spot'}</p>
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