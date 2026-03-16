import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Navigation, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { getCategoryName } from '@/lib/POICategories';

function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const HEADER_H = 56;
const SHEET_VH = 0.60;
const PEEK_SHOW = HEADER_H + 8;

function POIRow({ poi, category, onFlyTo, onNavigate, onClose }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-border/40 hover:bg-gray-50 dark:hover:bg-accent/60 active:bg-gray-100 dark:active:bg-accent transition-colors cursor-pointer"
      onClick={() => { onFlyTo?.([poi.lat, poi.lon]); onClose(); }}
    >
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lg"
        style={{ background: `${category.color}20` }}
      >
        {category.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{poi.name}</p>
        {poi.address && (
          <p className="text-xs text-muted-foreground truncate">{poi.address}</p>
        )}
      </div>
      {poi._km != null && (
        <div className="flex-shrink-0 flex flex-col items-end gap-0.5 min-w-[44px]">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-border overflow-hidden">
            <div className="h-full rounded-full"
              style={{ 
                width: `${Math.max(4, Math.min(100, (1 - Math.min(poi._km, 40) / 40) * 100))}%`,
                background: category.color
              }} 
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {poi._km < 1 ? `${Math.round(poi._km * 1000)} m` : `${poi._km.toFixed(1)} km`}
          </span>
        </div>
      )}
      <button
        onClick={e => { e.stopPropagation(); onNavigate?.(poi); onClose(); }}
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
        style={{ background: `${category.color}20`, color: category.color }}
        title="Navigate"
      >
        <Navigation className="w-4 h-4" />
      </button>
    </div>
  );
}

function MobileSheet({ children, header, onClose, bottomOffset }) {
  const [snap, setSnap] = useState('full');
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startTouchY = useRef(0);
  const startDragY = useRef(0);
  const sheetRef = useRef(null);
  const scrollRef = useRef(null);

  const sheetH = typeof window !== 'undefined' ? window.innerHeight * SHEET_VH : 400;
  const peekOffset = sheetH - PEEK_SHOW;
  const baseOffset = snap === 'full' ? 0 : peekOffset;
  const translateY = Math.max(0, baseOffset + dragY);

  useEffect(() => {
    const preventPTR = (e) => {
      if (scrollRef.current && scrollRef.current.contains(e.target)) {
        if (scrollRef.current.scrollTop <= 0) {
          const firstTouch = e.changedTouches[0];
          if (firstTouch && firstTouch.clientY > (firstTouch._startY || firstTouch.clientY)) {
            e.preventDefault();
          }
        }
      } else {
        e.preventDefault();
      }
    };
    document.addEventListener('touchmove', preventPTR, { passive: false });
    return () => document.removeEventListener('touchmove', preventPTR);
  }, []);

  const handleTouchStart = (e) => {
    startTouchY.current = e.touches[0].clientY;
    startDragY.current = dragY;
    setDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!dragging) return;
    const delta = e.touches[0].clientY - startTouchY.current;
    setDragY(startDragY.current + delta);
  };

  const handleTouchEnd = () => {
    if (!dragging) return;
    setDragging(false);
    const threshold = sheetH * 0.25;
    if (snap === 'full' && dragY > threshold) {
      setSnap('peek');
    } else if (snap === 'peek' && dragY < -threshold) {
      setSnap('full');
    }
    setDragY(0);
  };

  return (
    <>
      <div className="fixed inset-0 z-[1100] bg-black/30 backdrop-blur-sm pointer-events-none" 
        style={{ opacity: Math.max(0, Math.min(0.3, 0.3 * (1 - translateY / peekOffset))) }} />
      
      <div
        ref={sheetRef}
        className="fixed left-0 right-0 z-[1100] bg-white dark:bg-card rounded-t-3xl shadow-2xl flex flex-col"
        style={{
          height: `${sheetH}px`,
          bottom: bottomOffset || 0,
          transform: `translateY(${translateY}px)`,
          transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div
          className="flex-shrink-0 px-4 flex items-center justify-between select-none cursor-grab active:cursor-grabbing"
          style={{ height: `${HEADER_H}px` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="absolute left-1/2 top-3 -translate-x-1/2 w-10 h-1 rounded-full bg-gray-300 dark:bg-border" />
          <div className="w-full">{header}</div>
          <button onClick={onClose} className="absolute right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-accent flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </>
  );
}

export default function POIPanel({ pois, category, userPos, onFlyTo, onNavigate, onClose }) {
  const { language } = useLanguage();

  const sortedPOIs = useMemo(() => {
    if (!userPos || !pois) return pois || [];
    return pois.map(poi => ({
      ...poi,
      _km: haversineKm(userPos, [poi.lat, poi.lon])
    })).sort((a, b) => a._km - b._km);
  }, [pois, userPos]);

  const categoryName = getCategoryName(category, language);

  const header = (
    <h2 className="text-lg font-bold text-foreground pt-3 flex items-center gap-2">
      <span>{category?.icon}</span>
      {categoryName} ({sortedPOIs.length})
    </h2>
  );

  const listContent = sortedPOIs.length === 0 ? (
    <div className="px-4 py-12 text-center text-muted-foreground">
      No {categoryName.toLowerCase()} found in this area
    </div>
  ) : (
    sortedPOIs.map(poi => (
      <POIRow
        key={poi.id}
        poi={poi}
        category={category}
        onFlyTo={onFlyTo}
        onNavigate={onNavigate}
        onClose={onClose}
      />
    ))
  );

  return (
    <>
      {/* ── MOBILE ── */}
      <div className="md:hidden">
        <MobileSheet header={header} onClose={onClose} bottomOffset={56}>
          {listContent}
        </MobileSheet>
      </div>

      {/* ── DESKTOP — left side panel, matching SpotsPanel ── */}
      <div
        className="hidden md:block absolute z-[1002] rounded-2xl shadow-2xl border border-gray-100 dark:border-border bg-white dark:bg-card overflow-hidden"
        style={{ top: '5rem', left: '1rem', width: 340 }}
      >
        <div className="border-b border-gray-100 dark:border-border px-4 py-3 flex items-center justify-between">
          {header}
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-accent flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
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