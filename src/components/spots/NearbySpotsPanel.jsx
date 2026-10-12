import React, { useEffect, useState, useMemo } from 'react';
import { Navigation, X, SlidersHorizontal } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import NearbySpotsFilterModal from './NearbySpotsFilterModal';
import { NEARBY_DEFAULT_KM, isDefaultNearbyFilters } from '@/lib/nearbyFilters';
import { getSpotDisplayName, getSpotLocationLabel } from '@/lib/spotPresentation';
import { filterAndSortNearbySpots, getSpotRating } from '@/lib/spotDiscovery';
import SmoothSelect from '../ui/SmoothSelect';

const RESULT_PAGE_SIZE = 20;

const TYPE_EMOJI = { parking: '🅿️', food: '🍽️', toilet: '🚽' };
const TYPE_LABEL = { parking: 'Parking', food: 'Food', toilet: 'Toilet', general: 'Spot' };

function StarRow({ rating }) {
  if (rating === null) return <span className="text-xs text-muted-foreground">Unrated</span>;
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

function SpotRow({ spot, onSelectSpot, onNavigate, onClose, language }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-border/40 hover:bg-gray-50 dark:hover:bg-accent/60 active:bg-gray-100 dark:active:bg-accent transition-colors cursor-pointer"
      onClick={() => { onSelectSpot?.(spot); onClose(); }}
    >
      <span className="text-xl flex-shrink-0 w-7 text-center">{TYPE_EMOJI[spot.spot_type] || '📍'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{getSpotDisplayName(spot, language)}</p>
          {spot.spot_type && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-accent text-gray-500 dark:text-muted-foreground flex-shrink-0">
              {TYPE_LABEL[spot.spot_type] || spot.spot_type}
            </span>
          )}
        </div>
        {spot.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{spot.description}</p>
        )}
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{getSpotLocationLabel(spot)}</p>
        <div className="mt-0.5">
          <StarRow rating={getSpotRating(spot)} />
        </div>
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

export default function NearbySpotsPanel({ spots, userPos, loading = false, onSelectSpot, onNavigate, onClose, initialFilters, onFiltersChange }) {
  const { t, language } = useLanguage();
  const [filters, setFilters] = useState(initialFilters || { maxDistance: NEARBY_DEFAULT_KM, minRating: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sort, setSort] = useState('distance');
  const [visibleCount, setVisibleCount] = useState(RESULT_PAGE_SIZE);

  const nearby = useMemo(() => {
    return filterAndSortNearbySpots(spots, {
      origin: userPos,
      maxDistance: filters.maxDistance,
      minRating: filters.minRating,
      sort,
    });
  }, [spots, userPos, filters, sort]);
  const visibleNearby = nearby.slice(0, visibleCount);
  const resultCountLabel = nearby.length >= 500 ? '500+' : String(nearby.length);

  useEffect(() => setVisibleCount(RESULT_PAGE_SIZE), [filters.maxDistance, filters.minRating, sort]);

  const header = (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-sm font-bold text-foreground">
        {t('spotsPanel.nearby') || 'Nearby Spots'}
        {!userPos && <span className="font-normal text-muted-foreground"> · no location</span>}
        <span className="font-normal text-muted-foreground ml-1">({resultCountLabel})</span>
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setShowFilterModal(true)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            !isDefaultNearbyFilters(filters)
              ? 'bg-emerald-600 text-white border-emerald-600'
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
      {!loading && nearby.length > 1 && (
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2 dark:border-border/50">
          <span className="text-xs text-muted-foreground">Showing {Math.min(visibleCount, nearby.length)} of {resultCountLabel}</span>
          <SmoothSelect
            value={sort}
            onChange={setSort}
            ariaLabel="Sort nearby spots"
            className="max-w-[10rem]"
            options={[
              { value: 'distance', label: 'Nearest' },
              { value: 'rating', label: 'Highest rated' },
              { value: 'newest', label: 'Newest' },
            ]}
          />
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500/25 border-t-emerald-500" />
          Finding the nearest spots…
        </div>
      )}
      {!loading && nearby.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t('spotsPanel.noSpots') || 'No spots match your filters.'}
        </p>
      )}
      {!loading && visibleNearby.map(spot => (
        <SpotRow key={spot.id} spot={spot} onSelectSpot={onSelectSpot} onNavigate={onNavigate} onClose={onClose} language={language} />
      ))}
      {!loading && visibleCount < nearby.length && (
        <div className="p-4 text-center">
          <button type="button" onClick={() => setVisibleCount(count => count + RESULT_PAGE_SIZE)} className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold hover:bg-gray-50 dark:border-border dark:hover:bg-accent">
            Show more
          </button>
        </div>
      )}
      <div style={{ height: 16 }} />
    </>
  );

  return (
    <>
      {/* ── MOBILE ── */}
      <div className="md:hidden">
        <div
          className="sf-sheet fixed inset-x-0 bottom-0 z-[1500] mx-2 overflow-hidden rounded-t-3xl"
          style={{ maxHeight: '70dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="border-b border-gray-100 dark:border-border">{header}</div>
          <div style={{ maxHeight: 'calc(70vh - 56px)', overflowY: 'scroll', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
            {listContent}
          </div>
        </div>
      </div>

      {/* ─ DESKTOP ── */}
      <div
        className="sf-sheet absolute z-[1002] hidden overflow-hidden rounded-2xl md:block"
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
        onApply={(newFilters) => { setFilters(newFilters); onFiltersChange?.(newFilters); }}
        currentFilters={filters}
      />
    </>
  );
}
