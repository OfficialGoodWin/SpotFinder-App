import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Navigation, X } from 'lucide-react';

function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const TYPE_LABEL = { parking: 'Parking', food: 'Food', toilet: 'Toilet' };
const TYPE_EMOJI = { parking: '🅿️', food: '🍽️', toilet: '🚽' };

function StarRow({ rating }) {
  if (!rating) return <span className="text-xs text-muted-foreground">No ratings</span>;
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

function SpotRow({ spot, onFlyTo, onSelectSpot, onNavigate, onClose }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-border/40 hover:bg-gray-50 dark:hover:bg-accent/60 active:bg-gray-100 dark:active:bg-accent transition-colors cursor-pointer"
      onClick={() => { onFlyTo?.([spot.lat, spot.lng]); onSelectSpot?.(spot); onClose(); }}
    >
      <span className="text-xl flex-shrink-0 w-7 text-center">{TYPE_EMOJI[spot.spot_type] || '📍'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{spot.title || TYPE_LABEL[spot.spot_type] || 'Spot'}</p>
        <StarRow rating={spot.rating} />
      </div>
      {spot._km != null && (
        <div className="flex-shrink-0 flex flex-col items-end gap-0.5 min-w-[44px]">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-border overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.max(4, Math.min(100, (1 - Math.min(spot._km, 40) / 40) * 100))}%` }} />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {spot._km < 1 ? `${Math.round(spot._km * 1000)} m` : `${spot._km.toFixed(1)} km`}
          </span>
        </div>
      )}
      <button
        onClick={e => { e.stopPropagation(); onNavigate?.(spot); onClose(); }}
        className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 hover:bg-primary/20 active:bg-primary/30 flex items-center justify-center transition-colors"
        title="Navigate"
      >
        <Navigation className="w-4 h-4 text-primary" />
      </button>
    </div>
  );
}

// ── Safari-safe scroll container ──────────────────────────────────────────────
// Attaches a non-passive touchmove listener that:
//  - allows scrolling inside the element (pan-y)
//  - blocks the event from bubbling to document (kills pull-to-refresh)
//  - only preventDefault at the top/bottom boundary so internal scroll works
function SafeScroll({ children, style, className }) {
  const ref = useRef(null);
  const startYRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e) => {
      startYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      const el = ref.current;
      if (!el) return;

      const deltaY = e.touches[0].clientY - startYRef.current;
      const atTop    = el.scrollTop <= 0 && deltaY > 0;   // pulling down at top
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1 && deltaY < 0; // pushing up at bottom

      // Always stop the event reaching the document (kills Safari pull-to-refresh)
      e.stopPropagation();

      // Prevent default only at boundaries — otherwise internal scroll works fine
      if (atTop || atBottom) {
        e.preventDefault();
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false }); // must be non-passive to preventDefault

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        overflowY: 'scroll',          // 'scroll' not 'auto' — Safari needs explicit scroll
        overscrollBehavior: 'contain', // modern browsers
        WebkitOverflowScrolling: 'touch',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const HEADER_H = 52; // px — keep in sync with header padding

export default function SpotsPanel({ spots, userPos, showSpots, onToggleSpots, onZoomToArea, onFlyTo, onNavigate, onSelectSpot }) {
  const [open, setOpen] = useState(false);

  const nearby = useMemo(() => {
    if (!spots.length) return [];
    if (!userPos) return spots.slice(0, 60);
    return [...spots]
      .map(s => ({ ...s, _km: haversineKm(userPos, [s.lat, s.lng]) }))
      .sort((a, b) => a._km - b._km)
      .slice(0, 60);
  }, [spots, userPos]);

  useEffect(() => {
    if (showSpots) { setOpen(true); onZoomToArea?.(); }
    else setOpen(false);
  }, [showSpots]);

  if (!showSpots || !open) return null;

  const handleClose = () => { setOpen(false); onToggleSpots(); };

  const listContent = (
    <>
      {nearby.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No spots found</p>}
      {nearby.map(spot => (
        <SpotRow key={spot.id} spot={spot} onFlyTo={onFlyTo} onSelectSpot={onSelectSpot} onNavigate={onNavigate} onClose={handleClose} />
      ))}
      {/* Bottom padding so last item isn't flush against edge */}
      <div style={{ height: 12 }} />
    </>
  );

  const header = (
    <div className="flex items-center justify-between px-4 flex-shrink-0" style={{ height: HEADER_H }}>
      {/* Drag handle pill */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-300 dark:bg-border rounded-full md:hidden" />
      <span className="text-sm font-bold text-foreground">
        Nearby Spots
        {!userPos && <span className="font-normal text-muted-foreground"> · no location</span>}
        <span className="font-normal text-muted-foreground ml-1">({nearby.length})</span>
      </span>
      <button
        onClick={handleClose}
        className="w-7 h-7 rounded-full bg-gray-100 dark:bg-accent flex items-center justify-center hover:bg-gray-200 dark:hover:bg-border transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  // 62vh sheet — subtract header for the exact scroll area height
  // Using explicit px height avoids Safari flex-1-inside-max-height collapse
  const SHEET_VH   = 0.62;
  const sheetPx    = `calc(${SHEET_VH * 100}vh)`;
  const scrollPx   = `calc(${SHEET_VH * 100}vh - ${HEADER_H}px)`;

  return (
    <>
      {/* ── MOBILE bottom sheet ──────────────────────────────────────────────── */}
      <div
        className="md:hidden fixed inset-x-0 z-[1500]"
        style={{ bottom: '4rem' }}
      >
        {/* Invisible full-screen backdrop — tap to close, blocks map touches */}
        <div
          className="fixed inset-0"
          style={{ zIndex: -1 }}
          onClick={handleClose}
        />

        <div
          className="relative mx-2 rounded-t-3xl shadow-2xl border border-gray-100 dark:border-border bg-white dark:bg-card overflow-hidden"
          style={{ height: sheetPx }}
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gray-200 dark:bg-border" />
          <div className="border-b border-gray-100 dark:border-border relative">{header}</div>

          {/* SafeScroll: explicit pixel height, non-passive touchmove kills pull-to-refresh */}
          <SafeScroll style={{ height: scrollPx }}>
            {listContent}
          </SafeScroll>
        </div>
      </div>

      {/* ── DESKTOP dropdown ─────────────────────────────────────────────────── */}
      <div
        className="hidden md:block absolute z-[1002] rounded-2xl shadow-2xl border border-gray-100 dark:border-border bg-white dark:bg-card overflow-hidden"
        style={{ top: '5rem', left: '1rem', width: 340 }}
      >
        <div className="border-b border-gray-100 dark:border-border">{header}</div>
        <SafeScroll style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {listContent}
        </SafeScroll>
      </div>
    </>
  );
}