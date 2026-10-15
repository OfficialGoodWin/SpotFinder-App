import { useEffect, useMemo, useState } from 'react';
import { MapPin, Navigation, SlidersHorizontal, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { formatMaxDistance, isDefaultNearbyFilters } from '@/lib/nearbyFilters';
import { filterAndSortNearbySpots, getSpotRating } from '@/lib/spotDiscovery';
import { nearbyEmptyTitle, nearbyPage } from '@/lib/nearbySearch';
import { getSpotDisplayName, getSpotLocationLabel } from '@/lib/spotPresentation';
import SmoothSelect from '../ui/SmoothSelect';

const RESULT_PAGE_SIZE = 20;
const TYPE_LABEL = { parking: 'Parking', food: 'Food', toilet: 'Toilet', general: 'Spot' };

function SpotRow({ spot, onSelectSpot, onNavigate, onClose, language }) {
  const title = getSpotDisplayName(spot, language);
  const location = getSpotLocationLabel(spot);
  const rating = getSpotRating(spot);
  const ratingCount = Number(spot.rating_count);
  const category = TYPE_LABEL[spot.spot_type] || spot.resolved_category || spot.spot_type || 'Spot';
  const distance = spot._km < 1 ? `${Math.round(spot._km * 1000)} m` : `${spot._km.toFixed(1)} km`;
  return (
    <div className="flex items-stretch border-b border-border/50 transition-colors hover:bg-primary/5">
      <button type="button" onClick={() => { onSelectSpot?.(spot); onClose(); }} className="flex min-h-20 min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label={`Open ${title}, ${distance} away`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true"><MapPin className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold leading-snug text-foreground" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{title}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{category}{location && location !== 'Location unavailable' && !/^-?\d+[.,]\d+\s*,/.test(location) ? ` · ${location}` : ''}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{rating === null ? 'Unrated' : `★ ${rating.toFixed(1)} · ${ratingCount} ${ratingCount === 1 ? 'rating' : 'ratings'}`}</span>
        </span>
        <span className="shrink-0 self-start whitespace-nowrap pt-1 text-xs font-semibold text-primary">{distance}</span>
      </button>
      {onNavigate && <button type="button" onClick={() => { onNavigate(spot); onClose(); }} className="mr-2 grid min-h-11 min-w-11 place-items-center self-center rounded-xl text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Navigate to ${title}`}><Navigation className="h-4 w-4" /></button>}
    </div>
  );
}

export default function NearbySpotsPanel({ spots, origin, originMode, loading = false, complete = true, error = '', filters, onOpenFilters, onIncreaseRadius, onExploreMap, onSelectSpot, onNavigate, onClose }) {
  const { language } = useLanguage();
  const [sort, setSort] = useState('distance');
  const [visibleCount, setVisibleCount] = useState(RESULT_PAGE_SIZE);
  const nearby = useMemo(() => filterAndSortNearbySpots(spots, {
    origin, maxDistance: filters.maxDistance, minRating: filters.minRating, sort,
  }), [spots, origin, filters.maxDistance, filters.minRating, sort]);
  useEffect(() => setVisibleCount(RESULT_PAGE_SIZE), [spots, filters.maxDistance, filters.minRating, sort]);
  const { displayed, remaining } = nearbyPage(nearby, visibleCount);
  const countLabel = complete ? `${nearby.length} ${nearby.length === 1 ? 'match' : 'matches'}` : nearby.length ? `At least ${nearby.length} matches loaded` : 'Search incomplete';
  const radiusLabel = filters.maxDistance === Infinity ? 'in the searched area' : `within ${formatMaxDistance(filters.maxDistance)}`;

  const header = (
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div><h2 className="text-sm font-bold text-foreground">Nearby spots</h2><p className="text-xs text-muted-foreground">From {originMode === 'map' ? 'the selected map center' : 'your current GPS location'} · straight-line distance</p></div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={onOpenFilters} className={`flex min-h-11 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-primary ${isDefaultNearbyFilters(filters) ? 'border-border text-foreground' : 'border-primary bg-primary text-primary-foreground'}`} aria-label="Change nearby filters"><SlidersHorizontal className="h-4 w-4" /> Filter</button>
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary" aria-label="Close nearby spots"><X className="h-4 w-4" /></button>
        </div>
      </div>
      {!loading && !error && nearby.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{countLabel} {radiusLabel}{nearby.length > RESULT_PAGE_SIZE ? ` · showing ${displayed.length}` : ''}</p>}
    </div>
  );

  const content = (
    <div className="max-h-[calc(70dvh-7rem)] overflow-y-auto overscroll-contain md:max-h-[calc(100vh-14rem)]" style={{ WebkitOverflowScrolling: 'touch' }}>
      {!loading && !error && nearby.length > 1 && <div className="border-b border-border/50 px-4 py-2"><SmoothSelect value={sort} onChange={setSort} ariaLabel="Sort nearby spots" options={[{ value: 'distance', label: 'Nearest' }, { value: 'rating', label: 'Highest rated' }, { value: 'newest', label: 'Newest' }]} /></div>}
      {loading && <div role="status" aria-label="Finding nearby spots" className="space-y-3 p-4">{[1, 2, 3].map(item => <div key={item} className="h-16 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />)}</div>}
      {!loading && error && <div role="alert" className="space-y-3 p-5 text-sm"><p>{error}</p><button type="button" onClick={onOpenFilters} className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground">Try again</button></div>}
      {!loading && !error && nearby.length === 0 && (
        <div className="space-y-3 p-5">
          <h3 className="font-semibold text-foreground">{nearbyEmptyTitle(filters.maxDistance, complete)}</h3>
          <p className="text-sm text-muted-foreground">Try a larger search area, lower the minimum rating, or explore other places on the map.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onOpenFilters} className="min-h-11 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">Change filters</button>
            {filters.maxDistance !== Infinity && <button type="button" onClick={onIncreaseRadius} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold">Increase radius</button>}
            <button type="button" onClick={onExploreMap} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold">Explore map</button>
          </div>
          {!complete && <p className="text-xs text-muted-foreground">This search shows a bounded sample. Narrow the area to check more thoroughly.</p>}
        </div>
      )}
      {!loading && !error && displayed.map(spot => <SpotRow key={spot.id} spot={spot} onSelectSpot={onSelectSpot} onNavigate={onNavigate} onClose={onClose} language={language} />)}
      {!loading && !error && remaining > 0 && <div className="p-4 text-center"><button type="button" onClick={() => setVisibleCount(count => count + RESULT_PAGE_SIZE)} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">Load more ({remaining} remaining)</button></div>}
    </div>
  );

  return <>
    <div className="sf-sheet fixed inset-x-2 bottom-0 z-[1500] overflow-hidden rounded-t-3xl md:hidden" style={{ maxHeight: '70dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}>{header}{content}</div>
    <div className="sf-sheet absolute left-4 top-20 z-[1002] hidden w-[350px] overflow-hidden rounded-2xl md:block">{header}{content}</div>
  </>;
}
