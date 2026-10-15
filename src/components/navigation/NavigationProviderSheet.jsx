import { useEffect, useRef, useState } from 'react';
import { ExternalLink, MapPinned, Navigation2, X } from 'lucide-react';
import { NAVIGATION_PROVIDERS, buildExternalNavigationUrl, navigationCoordinates } from '@/lib/externalNavigation';

const PREFERENCE_KEY = 'spotfinder_navigation_provider';

function preferredProvider() {
  try {
    const saved = localStorage.getItem(PREFERENCE_KEY);
    if (NAVIGATION_PROVIDERS.some(provider => provider.id === saved)) return saved;
  } catch { /* Storage may be unavailable. */ }
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'apple' : 'google';
}

export default function NavigationProviderSheet({ destination, onClose }) {
  const [preferred, setPreferred] = useState(preferredProvider);
  const closeButton = useRef(null);
  useEffect(() => { if (destination) closeButton.current?.focus(); }, [destination]);
  if (!destination || !navigationCoordinates(destination)) return null;

  const ordered = [...NAVIGATION_PROVIDERS].sort((a, b) =>
    Number(b.id === preferred) - Number(a.id === preferred));
  const destinationName = destination.title || destination.label || destination.name || 'this place';

  const remember = id => {
    setPreferred(id);
    try { localStorage.setItem(PREFERENCE_KEY, id); } catch { /* Handoff still works. */ }
    // Let the browser follow the native link before unmounting the sheet.
    window.setTimeout(() => onClose?.(), 0);
  };

  return (
    <div className="fixed inset-0 z-[6000] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }} onKeyDown={event => { if (event.key === 'Escape') onClose?.(); }}>
      <section className="sf-sheet w-full rounded-t-3xl p-5 sm:max-w-sm sm:rounded-3xl" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }} role="dialog" aria-modal="true" aria-labelledby="navigation-provider-title">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="navigation-provider-title" className="text-lg font-bold">Choose navigation</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Open directions to {destinationName} in your preferred map app.</p>
          </div>
          <button ref={closeButton} type="button" onClick={onClose} className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-white/10" aria-label="Close navigation choices"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-2">
          {ordered.map(provider => (
            <a key={provider.id} href={buildExternalNavigationUrl(provider.id, destination)} target="_blank" rel="noopener noreferrer" onClick={() => remember(provider.id)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-primary/20 bg-white px-4 text-left text-foreground transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-white/[0.03] dark:hover:bg-primary/10">
              {provider.id === 'apple' ? <Navigation2 className="h-5 w-5 text-primary" aria-hidden="true" /> : <MapPinned className="h-5 w-5 text-primary" aria-hidden="true" />}
              <span className="flex-1 font-semibold">{provider.label}</span>
              {provider.id === preferred && <span className="text-xs text-muted-foreground">Preferred</span>}
              <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
