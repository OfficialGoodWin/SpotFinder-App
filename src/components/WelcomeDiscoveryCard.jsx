import React from 'react';
import { Compass, LocateFixed, X } from 'lucide-react';

export default function WelcomeDiscoveryCard({ onDismiss, onUseLocation, locationStatus }) {
  return (
    <aside className="absolute left-1/2 top-[max(5rem,calc(env(safe-area-inset-top)+4rem))] z-[1100] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-white/80 bg-white/95 p-4 text-slate-900 shadow-[0_16px_42px_rgba(15,23,42,.18)] backdrop-blur-lg dark:border-white/10 dark:bg-slate-950/95 dark:text-slate-50" aria-labelledby="welcome-title">
      <button type="button" onClick={onDismiss} className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:hover:bg-white/10" aria-label="Dismiss introduction"><X className="h-5 w-5" /></button>
      <div className="pr-10">
        <div className="mb-2 flex items-center gap-2 text-green-700 dark:text-green-400"><Compass className="h-5 w-5" aria-hidden="true" /><span className="text-xs font-bold uppercase tracking-wider">Explore beyond the obvious</span></div>
        <h2 id="welcome-title" className="text-xl font-bold leading-tight">Discover remarkable places shared by the SpotFinder community.</h2>
        <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">Explore without an account. Search an area, open a marker, or choose nearby discovery when you are ready to share your precise location.</p>
      </div>
      <div className="mt-4 flex flex-col gap-2 min-[380px]:flex-row">
        <button type="button" onClick={onUseLocation} disabled={locationStatus === 'requesting'} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2">
          <LocateFixed className="h-4 w-4" aria-hidden="true" />{locationStatus === 'requesting' ? 'Requesting location…' : 'Discover nearby spots'}
        </button>
        <button type="button" onClick={onDismiss} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:border-white/15 dark:hover:bg-white/10">Explore the map</button>
      </div>
      {locationStatus === 'denied' && <p role="status" className="mt-3 text-xs text-amber-700 dark:text-amber-300">Location was not shared. You can still search and explore the map, or enable location later in browser settings.</p>}
      {locationStatus === 'unsupported' && <p role="status" className="mt-3 text-xs text-amber-700 dark:text-amber-300">This browser cannot share your location. Explore the map or search for a place instead.</p>}
      {locationStatus === 'unavailable' && <p role="status" className="mt-3 text-xs text-amber-700 dark:text-amber-300">Your location is temporarily unavailable. Try again or explore by search and map.</p>}
    </aside>
  );
}
