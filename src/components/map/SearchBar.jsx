import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Navigation } from 'lucide-react';

const MAPY_API_KEY = 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';

export default function SearchBar({ onSelect, mapCenter, onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounce = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      const near = mapCenter ? `&preferNear=${mapCenter.lng},${mapCenter.lat}&preferNearPrecision=25000` : '';
      const url = `https://api.mapy.com/v1/suggest?apikey=${MAPY_API_KEY}&query=${encodeURIComponent(query)}&lang=en&limit=6${near}`;
      const res = await fetch(url);
      const data = await res.json();
      setResults(data.items || []);
      setLoading(false);
    }, 300);
  }, [query]);

  const handleSelect = (item) => {
    const pos = item.position || (item.regionalStructure?.[0]);
    if (pos) {
      onSelect({ lat: pos.lat, lng: pos.lon || pos.lng, label: item.name || item.label });
    }
    setQuery(item.name || item.label || '');
    setResults([]);
    inputRef.current?.blur();
  };

  return (
    <div className="absolute top-4 left-4 right-16 z-[1000]">
      <div className={`bg-white rounded-2xl shadow-lg border transition-all ${focused ? 'border-blue-400 shadow-blue-100' : 'border-gray-200'}`}>
        <div className="flex items-center px-3 gap-2">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search places..."
            className="flex-1 py-3 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }} className="p-1">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {results.length > 0 && (
          <div className="border-t border-gray-100 max-h-64 overflow-y-auto rounded-b-2xl">
            {results.map((item, i) => {
              const pos = item.position || (item.regionalStructure?.[0]);
              const hasPosition = !!pos;
              return (
                <div key={i} className="flex items-center hover:bg-gray-50 transition-colors">
                  <button
                    onMouseDown={() => handleSelect(item)}
                    className="flex-1 text-left px-4 py-2.5"
                  >
                    <p className="text-sm font-medium text-gray-800 truncate">{item.name || item.label}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {item.location || item.regionalStructure?.map(r => r.name).join(', ')}
                    </p>
                  </button>
                  {hasPosition && onNavigate && (
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onNavigate({ lat: pos.lat, lng: pos.lon || pos.lng, label: item.name || item.label });
                      }}
                      className="px-3 py-2 text-blue-500 hover:bg-blue-50 transition-colors"
                      title="Navigate here"
                    >
                      <Navigation className="w-5 h-5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {loading && query && <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">Searching...</div>}
      </div>
    </div>
  );
}