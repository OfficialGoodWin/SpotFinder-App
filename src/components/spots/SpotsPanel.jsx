import React, { useState, useMemo } from 'react';
import { Navigation } from 'lucide-react';

// ── Minimalist "tree + car + route arrow" SVG icon ───────────────────────────
const SpotsBtnIcon = () => (
  <svg viewBox="0 0 44 20" width="44" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Tree */}
    <line x1="4" y1="18" x2="4" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <polygon points="4,3 0,13 8,13" fill="currentColor" opacity="0.9"/>
    {/* Car */}
    <rect x="12" y="12" width="14" height="7" rx="1.5" fill="currentColor"/>
    <rect x="14" y="9"  width="9"  height="5" rx="1"   fill="currentColor" opacity="0.8"/>
    <circle cx="15" cy="19.5" r="1.8" fill="currentColor" opacity="0.6"/>
    <circle cx="23" cy="19.5" r="1.8" fill="currentColor" opacity="0.6"/>
    {/* Route arrow */}
    <path d="M30 14 L38 14 M36 11 L39 14 L36 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const TYPE_LABEL = { parking: 'Parking', food: 'Food', toilet: 'Toilet' };
const TYPE_EMOJI = { parking: '🅿️', food: '🍽️', toilet: '🚽' };

function StarRow({ rating }) {
  if (!rating) return <span className="text-xs text-muted-foreground">No ratings</span>;
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} viewBox="0 0 12 12" width="11" height="11" className={i <= Math.round(rating) ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'} fill="currentColor">
          <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5"/>
        </svg>
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function SpotsPanel({ spots, userPos, showSpots, onToggleSpots, onFlyTo, onNavigate, onSelectSpot }) {
  const [open, setOpen] = useState(false);

  const nearby = useMemo(() => {
    if (!userPos || !spots.length) return spots.slice(0, 30);
    return [...spots]
      .map(s => ({ ...s, _km: haversineKm(userPos, [s.lat, s.lng]) }))
      .sort((a, b) => a._km - b._km)
      .slice(0, 50);
  }, [spots, userPos]);

  const handleToggle = () => {
    onToggleSpots();
    if (!showSpots) setOpen(true); // auto-open dropdown when showing spots
  };

  return (
    <div className="absolute top-4 z-[1001]" style={{ left: '50%', transform: 'translateX(-50%)' }}>
      {/* Toggle button */}
      <button
        onClick={handleToggle}
        title={showSpots ? 'Hide spots' : 'Show spots'}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-lg border transition-all active:scale-95 text-sm font-semibold
          ${showSpots
            ? 'bg-primary text-primary-foreground border-primary/60'
            : 'bg-white dark:bg-card text-gray-700 dark:text-foreground border-gray-200 dark:border-border'}`}
      >
        <SpotsBtnIcon />
      </button>

      {/* Dropdown — visible when showSpots is on */}
      {showSpots && open && (
        <div className="mt-2 w-80 max-h-[55vh] overflow-y-auto rounded-2xl shadow-2xl border border-gray-100 dark:border-border bg-white dark:bg-card">
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between px-4 py-2.5 bg-white dark:bg-card border-b border-gray-100 dark:border-border z-10">
            <span className="text-sm font-bold text-foreground">
              Nearby Spots {userPos ? '' : '(no location)'}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
            >
              Close
            </button>
          </div>

          {nearby.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No spots found</p>
          )}

          {nearby.map(spot => (
            <div
              key={spot.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-border/50 hover:bg-gray-50 dark:hover:bg-accent transition-colors cursor-pointer"
              onClick={() => { onFlyTo([spot.lat, spot.lng]); onSelectSpot(spot); setOpen(false); }}
            >
              {/* Emoji */}
              <span className="text-xl flex-shrink-0">{TYPE_EMOJI[spot.spot_type] || '📍'}</span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {spot.title || TYPE_LABEL[spot.spot_type] || 'Spot'}
                </p>
                <StarRow rating={spot.rating} />
              </div>

              {/* Distance */}
              {spot._km != null && (
                <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
                  {/* Minimalist distance line indicator */}
                  <div className="w-8 h-1 rounded-full bg-gray-200 dark:bg-border overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, (1 - Math.min(spot._km, 20)/20) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {spot._km < 1 ? `${Math.round(spot._km * 1000)} m` : `${spot._km.toFixed(1)} km`}
                  </span>
                </div>
              )}

              {/* Navigate button */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  onNavigate(spot);
                  setOpen(false);
                }}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                title="Navigate"
              >
                <Navigation className="w-4 h-4 text-primary" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Re-open button if closed while spots are visible */}
      {showSpots && !open && (
        <div className="mt-1 flex justify-center">
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground bg-white dark:bg-card border border-gray-200 dark:border-border px-3 py-1 rounded-full shadow"
          >
            Show list ▾
          </button>
        </div>
      )}
    </div>
  );
}
