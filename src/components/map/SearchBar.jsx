import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Navigation } from 'lucide-react';
import { searchPlaces } from '@/api/openrouteServiceClient';

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
      try {
        const results = await searchPlaces(query, mapCenter);
        setResults(results);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      }
      setLoading(false);
    }, 300);
  }, [query, mapCenter]);

  const handleSelect = (item) => {
    if (item.lat && item.lng) {
      onSelect({ lat: item.lat, lng: item.lng, label: item.name || item.label });
    }
    setQuery(item.name || item.label || '');
    setResults([]);
    inputRef.current?.blur();
  };

  return (
    <div className="absolute top-4 left-4 right-16 z-[1000] animate-fade-in">
      <div className={`bg-white rounded-2xl shadow-lg border transition-all duration-200 ${focused ? 'border-green-400 shadow-green-100' : 'border-gray-200'}`}>
        <div className="flex items-center px-3 gap-2">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search places..."
            className="flex-1 py-3 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400 transition-all duration-200"
          />
          {query && (
            <button 
              onClick={() => { setQuery(''); setResults([]); }} 
              className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {results.length > 0 && (
          <div className="border-t border-gray-100 max-h-64 overflow-y-auto rounded-b-2xl animate-slide-down">
            {results.map((item, i) => {
              const hasPosition = item.lat && item.lng;
              return (
                <div key={i} className="flex items-center hover:bg-gray-50 transition-colors">
                  <button
                    onMouseDown={() => handleSelect(item)}
                    className="flex-1 text-left px-4 py-2.5"
                  >
                    <p className="text-sm font-medium text-gray-800 truncate">{item.name || item.label}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {item.location || ''}
                    </p>
                  </button>
                  {hasPosition && onNavigate && (
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onNavigate({ lat: item.lat, lng: item.lng, label: item.name || item.label });
                      }}
                      className="px-3 py-2 text-green-500 hover:bg-green-50 transition-colors"
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