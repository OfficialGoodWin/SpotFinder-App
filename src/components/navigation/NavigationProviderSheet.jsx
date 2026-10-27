import { useEffect, useRef, useState } from 'react';
import { ExternalLink, MapPinned, Navigation2, X } from 'lucide-react';
import { NAVIGATION_PROVIDERS, buildExternalNavigationUrl, navigationCoordinates } from '@/lib/externalNavigation';
import { useLanguage } from '@/lib/LanguageContext';
import '@/new/new-navigation-provider.css';

const PREFERENCE_KEY = 'spotfinder_navigation_provider';

function preferredProvider() {
  try {
    const saved = localStorage.getItem(PREFERENCE_KEY);
    if (NAVIGATION_PROVIDERS.some(provider => provider.id === saved)) return saved;
  } catch { /* Storage may be unavailable. */ }
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'apple' : 'google';
}

export default function NavigationProviderSheet({ destination, onClose, redesigned = false }) {
  const { language } = useLanguage();
  const [preferred, setPreferred] = useState(preferredProvider);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const closeButton = useRef(null);
  const openedAt = useRef(Date.now());
  useEffect(() => { if (destination) closeButton.current?.focus(); }, [destination]);
  // On touch screens a fast second tap can land on the backdrop of the sheet
  // that the first tap just opened. Ignore those taps so one press = one action.
  useEffect(() => { if (destination) openedAt.current = Date.now(); }, [destination]);
  useEffect(() => {
    if (!redesigned) return undefined;
    const sync = event => { if (event.key === PREFERENCE_KEY) setPreferred(preferredProvider()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [redesigned]);
  if (!destination) return null;
  const coordinates = navigationCoordinates(destination);
  if (!coordinates && !redesigned) return null;

  const ordered = [...NAVIGATION_PROVIDERS].sort((a, b) =>
    Number(b.id === preferred) - Number(a.id === preferred));
  const cs = language?.startsWith('cs');
  const destinationName = destination.title || destination.label || destination.name || (redesigned ? (cs ? 'Vybrané místo' : 'Selected place') : 'this place');
  const preferredItem = NAVIGATION_PROVIDERS.find(provider => provider.id === preferred) || NAVIGATION_PROVIDERS[0];
  const alternatives = NAVIGATION_PROVIDERS.filter(provider => provider.id !== preferredItem.id);
  const closeAfterNavigation = () => window.setTimeout(() => onClose?.(), 0);

  const remember = id => {
    setPreferred(id);
    try { localStorage.setItem(PREFERENCE_KEY, id); } catch { /* Handoff still works. */ }
    // Let the browser follow the native link before unmounting the sheet.
    window.setTimeout(() => onClose?.(), 0);
  };

  if (redesigned) return <div className="sf-new-nav-backdrop" onMouseDown={event => { if (event.target !== event.currentTarget) return; if (Date.now() - openedAt.current < 350) return; onClose?.(); }} onKeyDown={event => { if (event.key === 'Escape') onClose?.(); }}>
    <section className="sf-new-nav-sheet" role="dialog" aria-modal="true" aria-labelledby="sf-new-nav-title">
      <header className="sf-new-nav-header"><div><span>SpotFinder</span><h2 id="sf-new-nav-title">{cs ? 'Navigace' : 'Navigation'}</h2></div><button ref={closeButton} type="button" onClick={onClose} aria-label={cs ? 'Zavřít navigaci' : 'Close navigation'}><X size={21} /></button></header>
      <div className="sf-new-nav-body"><div className="sf-new-nav-destination"><MapPinned size={20} aria-hidden="true" /><div><small>{cs ? 'Cíl cesty' : 'Destination'}</small><strong>{destinationName}</strong></div></div>
        {coordinates ? <><div className="sf-new-nav-preferred"><span className="sf-new-nav-provider-icon">{preferredItem.id === 'apple' ? <Navigation2 size={19} aria-hidden="true" /> : <MapPinned size={19} aria-hidden="true" />}</span><strong>{preferredItem.label}</strong><span className="sf-new-nav-preferred-label">{cs ? 'Preferovaná' : 'Preferred'}</span></div>
          <a className="sf-new-nav-primary" href={buildExternalNavigationUrl(preferredItem.id, destination)} target="_blank" rel="noopener noreferrer" onClick={closeAfterNavigation}>{cs ? 'Pokračovat do' : 'Continue to'} {preferredItem.label}<ExternalLink size={17} aria-hidden="true" /></a>
          <button className="sf-new-nav-switch" type="button" aria-expanded={showAlternatives} aria-controls="sf-new-nav-alternatives" onClick={() => setShowAlternatives(value => !value)}>{cs ? 'Vybrat jinou mapovou aplikaci' : 'Choose another map provider'}</button>
          <div id="sf-new-nav-alternatives" className={`sf-new-nav-alternatives${showAlternatives ? ' is-expanded' : ''}`} aria-hidden={!showAlternatives}><div>{alternatives.map(provider => <a key={provider.id} href={buildExternalNavigationUrl(provider.id, destination)} target="_blank" rel="noopener noreferrer" tabIndex={showAlternatives ? 0 : -1} onClick={closeAfterNavigation}><span className="sf-new-nav-provider-icon">{provider.id === 'apple' ? <Navigation2 size={18} aria-hidden="true" /> : <MapPinned size={18} aria-hidden="true" />}</span><strong>{provider.label}</strong><ExternalLink size={15} aria-hidden="true" /></a>)}</div></div>
        </> : <p className="sf-new-nav-error" role="status">{cs ? 'Pro toto místo chybí platná poloha. Navigaci nelze otevřít.' : 'This place has no valid location. Navigation cannot be opened.'}</p>}
      </div>
    </section>
  </div>;

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
