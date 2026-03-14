import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Navigation, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const TYPE_LABEL  = { parking: 'Parking', food: 'Food', toilet: 'Toilet' };
const TYPE_EMOJI  = { parking: '🅿️', food: '🍽️', toilet: '🚽' };
const HEADER_H    = 56;   // px — drag handle area height
const SHEET_VH    = 0.60; // fraction of viewport height when fully open
const PEEK_SHOW   = HEADER_H + 8; // px of sheet visible when peeked (just the handle row)

function StarRow({ rating }) {
  if (!rating) return <span className="text-xs text-muted-foreground">–</span>;
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
            <div className="h-full bg-primary rounded-full"
              style={{ width: `${Math.max(4, Math.min(100, (1 - Math.min(spot._km, 40) / 40) * 100))}%` }} />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {spot._km < 1 ? `${Math.round(spot._km * 1000)} m` : `${spot._km.toFixed(1)} km`}
          </span>
        </div>
      )}
      <button
        onClick={e => { e.stopPropagation(); onNavigate?.(spot); onClose(); }}
        className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
        title="Navigate"
      >
        <Navigation className="w-4 h-4 text-primary" />
      </button>
    </div>
  );
}

// ─── MobileSheet ─────────────────────────────────────────────────────────────
// Two snap points:
//   "full"  → translateY = 0            (full SHEET_VH height visible)
//   "peek"  → translateY = sheetH - PEEK_SHOW  (only handle visible)
function MobileSheet({ children, header, onClose, bottomOffset }) {
  const [snap, setSnap]       = useState('full'); // 'full' | 'peek'
  const [dragY, setDragY]     = useState(0);      // live drag offset
  const [dragging, setDragging] = useState(false);
  const startTouchY = useRef(0);
  const startDragY  = useRef(0);
  const sheetRef    = useRef(null);
  const scrollRef   = useRef(null);

  // sheetH computed from viewport
  const sheetH = typeof window !== 'undefined' ? window.innerHeight * SHEET_VH : 400;
  const peekOffset = sheetH - PEEK_SHOW;

  // Current base offset for current snap
  const baseOffset = snap === 'full' ? 0 : peekOffset;
  // Rendered translateY = base + live drag, clamped so sheet never goes above 0
  const translateY = Math.max(0, baseOffset + dragY);

  // ── Block pull-to-refresh while sheet is mounted ───────────────────────────
  // We add a non-passive touchmove on document that prevents default when
  // the touch is NOT inside the scroll area (i.e. on the sheet shell / handle).
  useEffect(() => {
    const preventPTR = (e) => {
      // If touch is inside the scrollable list, only block at top boundary
      if (scrollRef.current && scrollRef.current.contains(e.target)) {
        if (scrollRef.current.scrollTop <= 0) {
          // At top — check direction
          const firstTouch = e.changedTouches[0];
          if (firstTouch && firstTouch.clientY > (firstTouch._startY || firstTouch.clientY)) {
            e.preventDefault();
          }
        }
        // mid-list: let browser scroll naturally but stop propagation
        e.stopPropagation();
        return;
      }
      // Anywhere else on the sheet (handle, header, background): always block
      e.preventDefault();
    };

    // Track startY on each touchstart so we can measure direction in PTR handler
    const trackStart = (e) => {
      if (e.changedTouches[0]) {
        e.changedTouches[0]._startY = e.changedTouches[0].clientY;
      }
    };

    document.addEventListener('touchstart',  trackStart,   { passive: true });
    document.addEventListener('touchmove',   preventPTR,   { passive: false });
    return () => {
      document.removeEventListener('touchstart',  trackStart);
      document.removeEventListener('touchmove',   preventPTR);
    };
  }, []);

  // ── Drag handle touch handlers ─────────────────────────────────────────────
  const onHandleTouchStart = (e) => {
    startTouchY.current = e.touches[0].clientY;
    startDragY.current  = 0;
    setDragging(true);
  };

  const onHandleTouchMove = (e) => {
    if (!dragging) return;
    const delta = e.touches[0].clientY - startTouchY.current;
    setDragY(delta);
  };

  const onHandleTouchEnd = () => {
    setDragging(false);
    const threshold = 60; // px needed to trigger snap
    if (snap === 'full') {
      setSnap(dragY > threshold ? 'peek' : 'full');
    } else {
      setSnap(dragY < -threshold ? 'full' : 'peek');
    }
    setDragY(0);
  };

  // ── Scroll area: intercept touchmove to prevent bubbling to document ───────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let startY = 0;

    const onStart = (e) => { startY = e.touches[0].clientY; };
    const onMove  = (e) => {
      e.stopPropagation(); // never let scroll touch reach document PTR handler
      const goingDown = e.touches[0].clientY > startY;
      if (goingDown && el.scrollTop <= 0) {
        e.preventDefault(); // block overscroll-into-PTR at top of list
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove',  onMove);
    };
  }, []);

  return (
    <div
      ref={sheetRef}
      className="fixed inset-x-0 z-[1500] mx-2 rounded-t-3xl shadow-2xl border border-gray-100 dark:border-border bg-white dark:bg-card overflow-hidden"
      style={{
        bottom: bottomOffset,
        height: sheetH,
        transform: `translateY(${translateY}px)`,
        transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        willChange: 'transform',
        touchAction: 'none', // let our JS handle all touch on the sheet shell
      }}
    >
      {/* Drag handle zone — captures vertical drag */}
      <div
        className="cursor-grab active:cursor-grabbing select-none"
        onTouchStart={onHandleTouchStart}
        onTouchMove={onHandleTouchMove}
        onTouchEnd={onHandleTouchEnd}
        style={{ touchAction: 'none' }}
      >
        {/* Pill */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-border" />
        </div>
        {/* Header row */}
        <div className="border-b border-gray-100 dark:border-border">{header}</div>
      </div>

      {/* Scroll list — explicit height so Safari doesn't collapse it */}
      <div
        ref={scrollRef}
        style={{
          height: sheetH - HEADER_H - 12, // subtract handle zone height
          overflowY: 'scroll',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function SpotsPanel({
  spots, userPos, showSpots, onToggleSpots, onZoomToArea, onFlyTo, onNavigate, onSelectSpot
}) {
  const { t } = useLanguage();
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

  const header = (
    <div className="flex items-center justify-between px-4" style={{ height: HEADER_H - 18 }}>
      <span className="text-sm font-bold text-foreground">
        {t('spotsPanel.nearby')}
        {!userPos && <span className="font-normal text-muted-foreground"> · no location</span>}
        <span className="font-normal text-muted-foreground ml-1">({nearby.length})</span>
      </span>
      <button
        onClick={handleClose}
        className="w-7 h-7 rounded-full bg-gray-100 dark:bg-accent flex items-center justify-center hover:bg-gray-200 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const listContent = (
    <>
      {nearby.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">{t('spotsPanel.noSpots')}</p>}
      {nearby.map(spot => (
        <SpotRow key={spot.id} spot={spot} onFlyTo={onFlyTo} onSelectSpot={onSelectSpot} onNavigate={onNavigate} onClose={handleClose} />
      ))}
      <div style={{ height: 16 }} />
    </>
  );

  return (
    <>
      {/* ── MOBILE ── */}
      <div className="md:hidden">
        <MobileSheet header={header} onClose={handleClose} bottomOffset="4rem">
          {listContent}
        </MobileSheet>
      </div>

      {/* ── DESKTOP ── */}
      <div
        className="hidden md:block absolute z-[1002] rounded-2xl shadow-2xl border border-gray-100 dark:border-border bg-white dark:bg-card overflow-hidden"
        style={{ top: '5rem', left: '1rem', width: 340 }}
      >
        <div className="border-b border-gray-100 dark:border-border">{header}</div>
        <div style={{
          maxHeight: 'calc(100vh - 220px)',
          overflowY: 'scroll',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}>
          {listContent}
        </div>
      </div>
    </>
  );
}