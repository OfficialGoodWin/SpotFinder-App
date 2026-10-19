import { useEffect, useMemo, useState } from 'react';
import { MapPin, Navigation, SlidersHorizontal, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { isDefaultNearbyFilters } from '@/lib/nearbyFilters';
import { filterAndSortNearbySpots, getSpotRating } from '@/lib/spotDiscovery';
import { nearbyPage } from '@/lib/nearbySearch';
import { getSpotDisplayName, getSpotLocationLabel } from '@/lib/spotPresentation';
import SmoothSelect from '../ui/SmoothSelect';

const RESULT_PAGE_SIZE = 20;
const TYPE_LABEL = { parking: 'typeParking', food: 'typeFood', toilet: 'typeToilet', general: 'typeGeneral' };

function SpotRow({ spot, onSelectSpot, onNavigate, onClose, language }) {
  const { t } = useLanguage();
  const title = getSpotDisplayName(spot, language);
  const location = getSpotLocationLabel(spot);
  const rating = getSpotRating(spot);
  const ratingCount = Number(spot.rating_count);
  const category = TYPE_LABEL[spot.spot_type] ? t(`nearbyUi.${TYPE_LABEL[spot.spot_type]}`) : spot.resolved_category || spot.spot_type || t('nearbyUi.typeGeneral');
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });
  const distance = spot._km < 1 ? `${number.format(Math.round(spot._km * 1000))} m` : `${number.format(spot._km)} km`;
  return (
    <div className="flex items-stretch border-b border-border/50 transition-colors hover:bg-primary/5">
      <button type="button" onClick={() => { onSelectSpot?.(spot); onClose(); }} className="flex min-h-20 min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-label={t('nearbyUi.openSpot', { name: title, distance })}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true"><MapPin className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold leading-snug text-foreground" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{title}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{category}{location && location !== 'Location unavailable' && !/^-?\d+[.,]\d+\s*,/.test(location) ? ` · ${location}` : ''}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{rating === null ? t('nearbyUi.unrated') : `★ ${number.format(rating)} · ${t('nearbyUi.rating', { count: ratingCount })}`}</span>
        </span>
        <span className="shrink-0 self-start whitespace-nowrap pt-1 text-xs font-semibold text-primary">{distance}</span>
      </button>
      {onNavigate && <button type="button" onClick={() => { onNavigate(spot); onClose(); }} className="mr-2 grid min-h-11 min-w-11 place-items-center self-center rounded-xl text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary" aria-label={t('nearbyUi.navigateTo', { name: title })}><Navigation className="h-4 w-4" /></button>}
    </div>
  );
}

export default function NearbySpotsPanel({ spots, origin, originMode, loading = false, complete = true, error = '', filters, onOpenFilters, onIncreaseRadius, onExploreMap, onSelectSpot, onNavigate, onClose }) {
  const { language, t } = useLanguage();
  const [sort, setSort] = useState('distance');
  const [visibleCount, setVisibleCount] = useState(RESULT_PAGE_SIZE);
  const nearby = useMemo(() => filterAndSortNearbySpots(spots, {
    origin, maxDistance: filters.maxDistance, minRating: filters.minRating, sort,
  }), [spots, origin, filters.maxDistance, filters.minRating, sort]);
  useEffect(() => setVisibleCount(RESULT_PAGE_SIZE), [spots, filters.maxDistance, filters.minRating, sort]);
  const { displayed, remaining } = nearbyPage(nearby, visibleCount);
  const countLabel = complete ? t('nearbyUi.matches', { count: nearby.length }) : nearby.length ? t('nearbyUi.atLeast', { count: nearby.length }) : t('nearbyUi.incomplete');
  const radiusLabel = filters.maxDistance === Infinity ? t('nearbyUi.inArea') : t('nearbyUi.within', { distance: `${new Intl.NumberFormat(language).format(filters.maxDistance)} km` });

  const header = (
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div><h2 className="text-sm font-bold text-foreground">{t('nearbyUi.title')}</h2><p className="text-xs text-muted-foreground">{t('nearbyUi.from', { origin: t(originMode === 'map' ? 'nearbyUi.mapOrigin' : 'nearbyUi.gpsOrigin') })}</p></div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={onOpenFilters} className={`flex min-h-11 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-primary ${isDefaultNearbyFilters(filters) ? 'border-border text-foreground' : 'border-primary bg-primary text-primary-foreground'}`} aria-label={t('nearbyUi.changeFilters')}><SlidersHorizontal className="h-4 w-4" /> {t('nearbyUi.filter')}</button>
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary" aria-label={t('nearbyUi.close')}><X className="h-4 w-4" /></button>
        </div>
      </div>
      {!loading && !error && nearby.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{countLabel} {radiusLabel}{nearby.length > RESULT_PAGE_SIZE ? ` · ${t('nearbyUi.showing', { count: displayed.length })}` : ''}</p>}
    </div>
  );

  const content = (
    <div className="max-h-[calc(70dvh-7rem)] overflow-y-auto overscroll-contain md:max-h-[calc(100vh-14rem)]" style={{ WebkitOverflowScrolling: 'touch' }}>
      {!loading && !error && nearby.length > 1 && <div className="border-b border-border/50 px-4 py-2"><SmoothSelect value={sort} onChange={setSort} ariaLabel={t('nearbyUi.sort')} options={[{ value: 'distance', label: t('nearbyUi.nearest') }, { value: 'rating', label: t('nearbyUi.highestRated') }, { value: 'newest', label: t('nearbyUi.newest') }]} /></div>}
      {loading && <div role="status" aria-label={t('nearbyUi.finding')} className="space-y-3 p-4">{[1, 2, 3].map(item => <div key={item} className="h-16 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />)}</div>}
      {!loading && error && <div role="alert" className="space-y-3 p-5 text-sm"><p>{error}</p><button type="button" onClick={onOpenFilters} className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground">{t('nearbyUi.tryAgain')}</button></div>}
      {!loading && !error && nearby.length === 0 && (
        <div className="space-y-3 p-5">
          <h3 className="font-semibold text-foreground">{!complete ? t('nearbyUi.emptyLoaded') : filters.maxDistance === Infinity ? t('nearbyUi.emptyArea') : t('nearbyUi.emptyWithin', { distance: `${new Intl.NumberFormat(language).format(filters.maxDistance)} km` })}</h3>
          <p className="text-sm text-muted-foreground">{t('nearbyUi.emptyHint')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onOpenFilters} className="min-h-11 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">{t('nearbyUi.filters')}</button>
            {filters.maxDistance !== Infinity && <button type="button" onClick={onIncreaseRadius} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold">{t('nearbyUi.increaseRadius')}</button>}
            <button type="button" onClick={onExploreMap} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold">{t('nearbyUi.exploreMap')}</button>
          </div>
          {!complete && <p className="text-xs text-muted-foreground">{t('nearbyUi.sampleHint')}</p>}
        </div>
      )}
      {!loading && !error && displayed.map(spot => <SpotRow key={spot.id} spot={spot} onSelectSpot={onSelectSpot} onNavigate={onNavigate} onClose={onClose} language={language} />)}
      {!loading && !error && remaining > 0 && <div className="p-4 text-center"><button type="button" onClick={() => setVisibleCount(count => count + RESULT_PAGE_SIZE)} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">{t('nearbyUi.loadMore', { count: remaining })}</button></div>}
    </div>
  );

  return <>
    <div className="sf-sheet fixed inset-x-2 bottom-0 z-[1500] overflow-hidden rounded-t-3xl md:hidden" style={{ maxHeight: '70dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}>{header}{content}</div>
    <div className="sf-sheet absolute left-4 top-20 z-[1002] hidden w-[350px] overflow-hidden rounded-2xl md:block">{header}{content}</div>
  </>;
}
