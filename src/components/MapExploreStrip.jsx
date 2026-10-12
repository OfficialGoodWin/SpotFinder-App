import React from 'react';
import { Compass, MapPin } from 'lucide-react';
import { getSpotDisplayName } from '@/lib/spotPresentation';
import { visibleExploreSpots } from '@/lib/discoveryExperience';

export default function MapExploreStrip({ spots = [], language, onSelectSpot }) {
  const visible = visibleExploreSpots(spots);

  return (
    <aside aria-label="Explore visible community spots" className="absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-[900] w-[min(92vw,34rem)] -translate-x-1/2 rounded-2xl border border-white/70 bg-white/95 p-2 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90">
      <div className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-200">
        <Compass className="h-4 w-4 text-green-600" aria-hidden="true" /> Explore this map
      </div>
      {visible.length ? (
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {visible.map(spot => (
            <button key={spot.id} type="button" onClick={() => onSelectSpot(spot)} className="flex min-h-11 min-w-[9rem] flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15">
              <MapPin className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
              <span className="line-clamp-2">{getSpotDisplayName(spot, language)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="px-2 pb-1 text-xs leading-5 text-slate-500 dark:text-slate-400">No community spots are visible here yet. Search for a place or zoom out to explore another area.</p>
      )}
    </aside>
  );
}
