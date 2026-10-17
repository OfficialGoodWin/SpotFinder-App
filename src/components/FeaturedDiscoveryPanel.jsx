import React from 'react';
import { Compass, Search, X } from 'lucide-react';
import SpotImage from './spots/SpotImage';
import { getSpotDisplayName, getSpotImageInfo, getSpotLocationLabel } from '@/lib/spotPresentation';

export default function FeaturedDiscoveryPanel({ spots, language, loading, error, emptyView, onSelectSpot, onSearch, onDismiss }) {
  return (
    <aside aria-label="Discover community places" className="absolute bottom-[calc(8.5rem+env(safe-area-inset-bottom))] left-[4.5rem] right-3 z-[900] max-h-[min(44vh,22rem)] overflow-y-auto rounded-2xl border border-white/70 bg-white/95 p-3 text-slate-900 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 dark:text-white sm:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:left-1/2 sm:right-auto sm:w-[min(92vw,46rem)] sm:-translate-x-1/2">
      <div className="flex items-center gap-2">
        <Compass className="h-5 w-5 text-green-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold">Featured community places</h2>
          {emptyView && <p className="text-xs text-slate-600 dark:text-slate-300">No community spots in this view yet. Explore these places or search another area.</p>}
        </div>
        <button type="button" onClick={onDismiss} aria-label="Close featured places" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
      </div>
      {loading && <p role="status" className="py-3 text-sm">Loading community places…</p>}
      {!loading && error && <p role="status" className="py-3 text-sm">Featured places are unavailable right now. You can still explore the map.</p>}
      {!loading && !error && spots.length > 0 && <div className="mt-2 flex snap-x gap-3 overflow-x-auto pb-1" aria-label="Featured places">
        {spots.map(spot => {
          const image = getSpotImageInfo(spot);
          return <button key={spot.id} type="button" onClick={() => onSelectSpot(spot)} className="group w-40 shrink-0 snap-start overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:border-white/10 dark:bg-white/10 sm:w-44" aria-label={`Open ${getSpotDisplayName(spot, language)}`}>
            <div className="h-24 overflow-hidden"><SpotImage spot={spot} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none" fallbackClassName="h-full" /></div>
            <div className="px-2 py-2"><span className="line-clamp-1 text-xs font-bold">{getSpotDisplayName(spot, language)}</span><span className="mt-0.5 line-clamp-1 text-[11px] text-slate-600 dark:text-slate-300">{getSpotLocationLabel(spot, 2)}</span></div>
            {(image?.attribution || image?.creator) && <span className="block truncate px-2 pb-2 text-[10px] text-slate-500 dark:text-slate-400" title={image.attribution || image.creator}>Photo: {image.attribution || image.creator}</span>}
          </button>;
        })}
      </div>}
      {!loading && !error && spots.length === 0 && <p className="py-2 text-xs text-slate-600 dark:text-slate-300">Explore the map or search for a place to find community spots.</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <button type="button" onClick={onSearch} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-green-700 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:text-green-400 dark:hover:bg-white/10"><Search className="h-4 w-4" />Search a place</button>
        <button type="button" onClick={onDismiss} className="min-h-11 rounded-xl px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:text-slate-300 dark:hover:bg-white/10">Continue map</button>
      </div>
    </aside>
  );
}
