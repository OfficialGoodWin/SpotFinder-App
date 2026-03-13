import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Navigation, Mic, MicOff } from 'lucide-react';

const MAPY_API_KEY = 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';

const SpotsBtnIcon = () => (
  <svg viewBox="0 0 44 20" width="38" height="17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="4" y1="18" x2="4" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <polygon points="4,3 0,13 8,13" fill="currentColor" opacity="0.9"/>
    <rect x="12" y="12" width="14" height="7" rx="1.5" fill="currentColor"/>
    <rect x="14" y="9" width="9" height="5" rx="1" fill="currentColor" opacity="0.8"/>
    <circle cx="15" cy="19.5" r="1.8" fill="currentColor" opacity="0.6"/>
    <circle cx="23" cy="19.5" r="1.8" fill="currentColor" opacity="0.6"/>
    <path d="M30 14 L38 14 M36 11 L39 14 L36 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function SearchBar({ onSelect, mapCenter, onNavigate, showSpots, onToggleSpots }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const debounce = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      const near = mapCenter ? `&preferNear=${mapCenter.lng},${mapCenter.lat}&preferNearPrecision=25000` : '';
      const url = `https://api.mapy.com/v1/suggest?apikey=${MAPY_API_KEY}&query=${encodeURIComponent(query)}&lang=en&limit=6${near}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        setResults(data.items || []);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
  }, [query]);

  const handleSelect = (item) => {
    const pos = item.position || item.regionalStructure?.[0];
    if (pos) onSelect({ lat: pos.lat, lng: pos.lon || pos.lng, label: item.name || item.label });
    setQuery(item.name || item.label || '');
    setResults([]);
    inputRef.current?.blur();
  };

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('Voice search requires Chrome or Edge.'); return; }
    if (recognitionRef.current) recognitionRef.current.abort();
    const rec = new SpeechRecognition();
    rec.lang = 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (e) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      setQuery(t);
      inputRef.current?.focus();
    };
    recognitionRef.current = rec;
    rec.start();
  }, []);

  const toggleMic = () => listening ? (recognitionRef.current?.stop(), setListening(false)) : startListening();

  return (
    <div className="absolute top-4 left-4 z-[1002]" style={{ right: '3.75rem' }}>
      <div className={`bg-white dark:bg-card rounded-2xl shadow-lg border transition-all ${focused ? 'border-blue-400 dark:border-blue-500' : 'border-gray-200 dark:border-border'}`}>
        <div className="flex items-center px-3 gap-1.5">
          <Search className="w-4 h-4 text-gray-400 dark:text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search places..."
            className="flex-1 py-3 text-sm outline-none bg-transparent text-gray-800 dark:text-foreground placeholder-gray-400 dark:placeholder-muted-foreground min-w-0"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }} className="p-1 flex-shrink-0">
              <X className="w-3.5 h-3.5 text-gray-400 dark:text-muted-foreground" />
            </button>
          )}
          <button
            onMouseDown={e => { e.preventDefault(); toggleMic(); }}
            className={`p-1.5 rounded-lg flex-shrink-0 transition-colors ${listening ? 'bg-red-500 text-white' : 'text-gray-400 dark:text-muted-foreground hover:text-gray-600'}`}
            title={listening ? 'Stop' : 'Voice search'}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <div className="w-px h-5 bg-gray-200 dark:bg-border flex-shrink-0" />
          <button
            onClick={onToggleSpots}
            title={showSpots ? 'Hide spots' : 'Show spots'}
            className={`px-2 py-1.5 rounded-lg flex-shrink-0 transition-all active:scale-95 ${showSpots ? 'text-primary bg-primary/10' : 'text-gray-500 dark:text-muted-foreground hover:text-gray-700'}`}
          >
            <SpotsBtnIcon />
          </button>
        </div>

        {listening && (
          <div className="px-4 py-1.5 border-t border-gray-100 dark:border-border flex items-center gap-2 rounded-b-2xl">
            <span className="flex gap-0.5 items-end h-4">
              {[1,2,3].map(i => (
                <span key={i} className="w-1 rounded-full bg-red-500 animate-bounce inline-block"
                  style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.12}s` }} />
              ))}
            </span>
            <span className="text-xs text-red-500 font-medium">Listening…</span>
          </div>
        )}

        {results.length > 0 && (
          <div className="border-t border-gray-100 dark:border-border max-h-64 overflow-y-auto rounded-b-2xl">
            {results.map((item, i) => {
              const pos = item.position || item.regionalStructure?.[0];
              return (
                <div key={i} className="flex items-center hover:bg-gray-50 dark:hover:bg-accent transition-colors">
                  <button onMouseDown={() => handleSelect(item)} className="flex-1 text-left px-4 py-2.5">
                    <p className="text-sm font-medium text-gray-800 dark:text-foreground truncate">{item.name || item.label}</p>
                    <p className="text-xs text-gray-400 dark:text-muted-foreground truncate">
                      {item.location || item.regionalStructure?.map(r => r.name).join(', ')}
                    </p>
                  </button>
                  {pos && onNavigate && (
                    <button onMouseDown={e => { e.stopPropagation(); onNavigate({ lat: pos.lat, lng: pos.lon || pos.lng, label: item.name || item.label }); }}
                      className="px-3 py-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-accent transition-colors" title="Navigate">
                      <Navigation className="w-5 h-5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {loading && query && !results.length && (
          <div className="px-4 py-2 text-xs text-gray-400 dark:text-muted-foreground border-t border-gray-100 dark:border-border rounded-b-2xl">Searching…</div>
        )}
      </div>
    </div>
  );
}