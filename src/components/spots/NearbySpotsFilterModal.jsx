import React, { useState, useEffect, useRef } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { NEARBY_DEFAULT_KM, NEARBY_SLIDER_MAX, sliderToKm, kmToSlider, formatMaxDistance } from '@/lib/nearbyFilters';
import LiquidSegmentedControl from '../ui/LiquidSegmentedControl';

export default function NearbySpotsFilterModal({ isOpen, onClose, onApply, currentFilters, currentMode = 'gps', suggestedFilters, locationError, busy = false }) {
  const [maxDistance, setMaxDistance] = useState(currentFilters?.maxDistance ?? NEARBY_DEFAULT_KM);
  const [minRating, setMinRating] = useState(currentFilters?.minRating ?? 0);
  const [originMode, setOriginMode] = useState(currentMode);
  const sliderRef = useRef(null);
  const overlayRef = useRef(null);
  const priorFocusRef = useRef(null);

  // Re-seed local state whenever the modal is (re)opened so it reflects live filters
  useEffect(() => {
    if (isOpen) {
      priorFocusRef.current = document.activeElement;
      setMaxDistance(suggestedFilters?.maxDistance ?? currentFilters?.maxDistance ?? NEARBY_DEFAULT_KM);
      setMinRating(currentFilters?.minRating ?? 0);
      setOriginMode(currentMode);
      requestAnimationFrame(() => sliderRef.current?.focus());
    }
    return () => {
      const previous = priorFocusRef.current;
      if (previous?.isConnected) previous.focus();
      else document.querySelector('[aria-haspopup="menu"]')?.focus();
    };
  }, [isOpen, currentFilters?.maxDistance, currentFilters?.minRating, currentMode, suggestedFilters?.maxDistance]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const viewport = window.visualViewport;
    const syncViewport = () => {
      if (!overlayRef.current) return;
      overlayRef.current.style.top = `${viewport?.offsetTop ?? 0}px`;
      overlayRef.current.style.height = `${viewport?.height ?? window.innerHeight}px`;
    };
    syncViewport();
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);
    return () => {
      document.body.style.overflow = previousOverflow;
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = () => onApply({ maxDistance, minRating }, originMode);

  return (
    <div ref={overlayRef} className="sf-nearby-filter-overlay fixed inset-x-0 top-0 z-[3000] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[2px] sm:p-4" role="dialog" aria-modal="true" aria-labelledby="nearby-filter-title" onKeyDown={event => { if (event.key === 'Escape') onClose(); }} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="sf-nearby-filter-card relative flex min-h-0 w-full max-w-sm flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><SlidersHorizontal className="h-5 w-5" /></span><div><h3 id="nearby-filter-title" className="text-base font-bold text-gray-900 dark:text-foreground">Nearby spots</h3><p className="text-xs text-gray-500 dark:text-muted-foreground">Fine-tune what appears</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close nearby filters" className="sf-filter-icon-button">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="sf-nearby-filter-body min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-3 sm:px-5">
          {/* Distance Slider */}
          <div className="sf-filter-section">
            <div className="flex justify-between items-center text-xs font-semibold text-gray-600 dark:text-muted-foreground mb-2">
              <span>Maximum distance</span>
              <output className="sf-filter-value">{formatMaxDistance(maxDistance)}</output>
            </div>
            <input
              ref={sliderRef}
              type="range"
              min="1"
              max={NEARBY_SLIDER_MAX}
              value={kmToSlider(maxDistance)}
              onChange={(e) => setMaxDistance(sliderToKm(e.target.value))}
              className="sf-glass-range w-full"
              aria-label="Maximum straight-line distance"
              aria-valuetext={maxDistance === Infinity ? 'Explore farther than 50 km' : `${maxDistance} km`}
              aria-describedby={maxDistance === Infinity ? 'nearby-distance-explanation' : undefined}
              style={{ '--sf-range-progress': `${((kmToSlider(maxDistance) - 1) / (NEARBY_SLIDER_MAX - 1)) * 100}%` }}
            />
            <div className="flex justify-between text-[10px] text-gray-400 dark:text-muted-foreground mt-0.5">
              <span>1 km</span><span>50 km</span><span>Farther</span>
            </div>
            {maxDistance === Infinity && <p id="nearby-distance-explanation" className="mt-2 text-xs text-muted-foreground">Explore farther searches beyond 50 km using a bounded sample. Move the slider back to 50 km or less for a fixed radius. The full result count may be unknown.</p>}
          </div>

          <fieldset className="sf-filter-section min-w-0">
            <legend className="sr-only">Search from</legend>
            <div aria-hidden="true" className="mb-2 text-xs font-semibold text-gray-600 dark:text-muted-foreground">Search from</div>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input className="shrink-0" type="radio" name="nearby-origin" checked={originMode === 'gps'} onChange={() => setOriginMode('gps')} /><span className="min-w-0">Current device location</span></label>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input className="shrink-0" type="radio" name="nearby-origin" checked={originMode === 'map'} onChange={() => setOriginMode('map')} /><span className="min-w-0">Current map center</span></label>
            <p className="mt-1 text-xs text-muted-foreground">Device location is requested only when selected and you choose Show Nearby. Pan the map first to search from a different place.</p>
          </fieldset>

          {/* Min Rating Buttons */}
          <div className="sf-filter-section">
            <label className="block text-xs font-semibold text-gray-600 dark:text-muted-foreground mb-2">Minimum rating</label>
            <LiquidSegmentedControl
              ariaLabel="Minimum rating"
              equal
              tone="green"
              value={String(minRating)}
              onChange={rating => setMinRating(Number(rating))}
              options={[0, 3, 3.5, 4, 4.5].map(rating => ({ value: String(rating), label: rating === 0 ? 'Any' : `${rating.toFixed(1)}+` }))}
            />
          </div>
          {locationError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{locationError}</p>}
          <div className="flex justify-end"><button type="button" onClick={() => { setMaxDistance(NEARBY_DEFAULT_KM); setMinRating(0); }} disabled={busy} className="min-h-11 rounded-lg px-3 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary">Reset draft</button></div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3 sm:px-5">
          <button type="button" onClick={onClose} className="sf-filter-secondary flex-1">Cancel</button>
          <button
            type="button"
            onClick={handleApply}
            disabled={busy}
            className="sf-filter-primary flex-1"
          >
            {busy ? 'Finding location…' : 'Show Nearby'}
          </button>
        </div>
      </div>
    </div>
  );
}
