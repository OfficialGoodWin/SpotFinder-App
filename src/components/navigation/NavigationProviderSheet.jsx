import { ExternalLink, Map, Navigation, X } from 'lucide-react';

const PREFERENCE_KEY = 'spotfinder_navigation_provider';

const PROVIDERS = {
  google: {
    label: 'Google Maps',
    build: (lat, lng) => {
      const url = new URL('https://www.google.com/maps/dir/');
      url.searchParams.set('api', '1');
      url.searchParams.set('destination', `${lat},${lng}`);
      url.searchParams.set('dir_action', 'navigate');
      return url.toString();
    },
  },
  mapy: {
    label: 'Mapy.com',
    build: (lat, lng) => {
      const url = new URL('https://mapy.com/fnc/v1/route');
      url.searchParams.set('end', `${lng},${lat}`);
      url.searchParams.set('routeType', 'car_fast_traffic');
      url.searchParams.set('navigate', 'true');
      return url.toString();
    },
  },
  apple: {
    label: 'Apple Maps',
    build: (lat, lng) => {
      const url = new URL('https://maps.apple.com/directions');
      url.searchParams.set('destination', `${lat},${lng}`);
      return url.toString();
    },
  },
};

const preferredProvider = () => {
  try {
    const saved = localStorage.getItem(PREFERENCE_KEY);
    if (PROVIDERS[saved]) return saved;
  } catch {}
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'apple' : 'google';
};

export default function NavigationProviderSheet({ open, destination, onClose, onInternalNavigate }) {
  if (!open || !destination) return null;
  const lat = Number(destination.lat);
  const lng = Number(destination.lng ?? destination.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const preferred = preferredProvider();
  const ordered = Object.entries(PROVIDERS).sort(([a], [b]) =>
    Number(b === preferred) - Number(a === preferred));

  const launch = (id, provider) => {
    try { localStorage.setItem(PREFERENCE_KEY, id); } catch {}
    window.open(provider.build(lat, lng), '_blank', 'noopener,noreferrer');
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-white/20 bg-white/95 dark:bg-slate-900/95 shadow-2xl p-5" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }} aria-labelledby="navigation-provider-title">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div><h2 id="navigation-provider-title" className="text-lg font-bold">Choose navigation</h2><p className="text-sm text-muted-foreground mt-0.5">Directions to {destination.title || destination.label || 'this spot'}</p></div>
          <button onClick={onClose} className="w-11 h-11 -mr-2 -mt-2 grid place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="Close navigation choices"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-2">
          <button onClick={() => { onInternalNavigate?.(destination); onClose?.(); }} className="w-full min-h-12 px-4 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/80 dark:bg-blue-950/30 flex items-center gap-3 text-left font-semibold hover:bg-blue-100 dark:hover:bg-blue-950/50 focus-visible:ring-2 focus-visible:ring-blue-500">
            <Navigation className="w-5 h-5 text-blue-600" /><span className="flex-1">SpotFinder navigation</span>
          </button>
          {ordered.map(([id, provider]) => (
            <button key={id} onClick={() => launch(id, provider)} className="w-full min-h-12 px-4 rounded-2xl border border-gray-200 dark:border-border bg-white/70 dark:bg-white/[0.03] flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-blue-500">
              <Map className="w-5 h-5 text-gray-500" />
              <span className="flex-1 font-semibold">{provider.label}</span>
              {id === preferred && <span className="text-[11px] text-muted-foreground">Preferred</span>}
              <ExternalLink className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
