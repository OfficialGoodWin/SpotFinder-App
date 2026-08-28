import React, { useState, useMemo } from 'react';
import { Navigation, X, SlidersHorizontal } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import NearbySpotsFilterModal from './NearbySpotsFilterModal';

function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const TYPE_EMOJI = { parking: '🅿️', food: '🍽️', toilet: '🚽' };

function StarRow({ rating }) {
  if (!rating) return <span className="text-xs text-muted-foreground">–</span>;
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} viewBox="0 0 12 12" width="11" height="11"
          className={i <= Math.round(rating) ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'} fill="currentColor">
          <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5" />
        </svg>
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

function SpotRow({ spot, onSelectSpot, onNavigate, onClose }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-border/40 hover:bg-gray-50 dark:hover:bg-accent/60 active:bg-gray-100 dark:active:bg-accent transition-colors cursor-pointer"
      onClick={() => { onSelectSpot?.(spot); onClose(); }}
    >
      <span className="text-xl flex-shrink-0 w-7 text-center">{TYPE_EMOJI[spot.spot_type] || '📍'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{spot.title || 'Spot'}</p>
        <StarRow rating={spot.rating} />
      </div>
      {spot._km != null && (
        <div className="flex-shrink-0 flex flex-col items-end gap-0.5 min-w-[44px]">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-border overflow-hidden">
            <div className="h-full bg-primary rounded-full"
              style={{ width: `${Math.max(4, Math.min(100, (1 - Math.min(spot._km, 40) / 40) * 100))}%` }} />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {spot._km < 1 ? `${Math.round(spot._km * 1000)} m` : `${spot._km.toFixed(1)} km`}
          </span>
        </div>
      )}
      {onNavigate && (
        <button
          onClick={e => { e.stopPropagation(); onNavigate(spot); onClose(); }}
          className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
          title="Navigate"
        >
          <Navigation className="w-4 h-4 text-primary" />
        </button>
      )}
    </div>
  );
}

export default function NearbySpotsPanel({ spots, userPos, onSelectSpot, onNavigate, onClose }) {
  const { t } = useLanguage();
  const [filters, setFilters] = useState({ maxDistance: 50, minRating: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);

  const nearby = useMemo(() => {
    const withDist = (spots || []).map(s => ({
      ...s,
      _km: userPos ? haversineKm(userPos, [s.lat, s.lng]) : null,
    }));

    return withDist
      .filter(s => {
        const ratingNum = s.rating || 0;
        if (ratingNum < filters.minRating) return false;
        // Distance filter only applies when we know the user's location
        if (userPos && s._km != null && s._km > filters.maxDistance) return false;
        return true;
      })
      .sort((a, b) => (a._km ?? Infinity) - (b._km ?? Infinity));
  }, [spots, userPos, filters]);

  const header = (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-sm font-bold text-foreground">
        {t('spotsPanel.nearby') || 'Nearby Spots'}
        {!userPos && <span className="font-normal text-muted-foreground"> · no location</span>}
        <span className="font-normal text-muted-foreground ml-1">({nearby.length})</span>
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setShowFilterModal(true)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            (filters.maxDistance < 50 || filters.minRating > 0)
              ? 'bg-purple-600 text-white border-purple-600'
              : 'bg-white dark:bg-background text-gray-600 dark:text-muted-foreground border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-accent'
          }`}
          title="Filter"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filter
        </button>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-gray-100 dark:bg-accent flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  const listContent = (
    <>
      {nearby.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t('spotsPanel.noSpots') || 'No spots match your filters.'}
        </p>
      )}
      {nearby.map(spot => (
        <SpotRow key={spot.id} spot={spot} onSelectSpot={onSelectSpot} onNavigate={onNavigate} onClose={onClose} />
      ))}
      <div style={{ height: 16 }} />
    </>
  );

  return (
    <>
      {/* ── MOBILE ── */}
      <div className="md:hidden">
        <div
          className="fixed inset-x-0 bottom-0 z-[1500] mx-2 rounded-t-3xl shadow-2xl border border-gray-100 dark:border-border bg-white dark:bg-card overflow-hidden"
          style={{ maxHeight: '70vh' }}
        >
          <div className="border-b border-gray-100 dark:border-border">{header}</div>
          <div style={{ maxHeight: 'calc(70vh - 56px)', overflowY: 'scroll', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
            {listContent}
          </div>
        </div>
      </div>

      {/* ─ DESKTOP ── */}
      <div
        className="hidden md:block absolute z-[1002] rounded-2xl shadow-2xl border border-gray-100 dark:border-border bg-white dark:bg-card overflow-hidden"
        style={{ top: '5rem', left: '1rem', width: 340 }}
      >
        <div className="border-b border-gray-100 dark:border-border">{header}</div>
        <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'scroll', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          {listContent}
        </div>
      </div>

      <NearbySpotsFilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={(newFilters) => setFilters(newFilters)}
        currentFilters={filters}
      />
    </>
  );
}
