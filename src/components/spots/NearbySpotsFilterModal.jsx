import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { NEARBY_DEFAULT_KM, NEARBY_SLIDER_MAX, sliderToKm, kmToSlider, formatMaxDistance } from '@/lib/nearbyFilters';
import LiquidSegmentedControl from '../ui/LiquidSegmentedControl';

export default function NearbySpotsFilterModal({ isOpen, onClose, onApply, currentFilters }) {
  const [maxDistance, setMaxDistance] = useState(currentFilters?.maxDistance ?? NEARBY_DEFAULT_KM);
  const [minRating, setMinRating] = useState(currentFilters?.minRating ?? 0);

  // Re-seed local state whenever the modal is (re)opened so it reflects live filters
  useEffect(() => {
    if (isOpen) {
      setMaxDistance(currentFilters?.maxDistance ?? NEARBY_DEFAULT_KM);
      setMinRating(currentFilters?.minRating ?? 0);
    }
  }, [isOpen, currentFilters?.maxDistance, currentFilters?.minRating]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply({ maxDistance, minRating });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[2500]">
      <div className="sf-nearby-filter-card relative max-w-sm w-full p-5">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/20"><SlidersHorizontal className="h-5 w-5" /></span><div><h3 className="font-bold text-gray-900 dark:text-foreground text-base">Nearby spots</h3><p className="text-[11px] text-gray-500 dark:text-muted-foreground">Fine-tune what appears</p></div></div>
          <button onClick={onClose} aria-label="Close" className="sf-filter-icon-button">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Distance Slider */}
          <div className="sf-filter-section">
            <div className="flex justify-between items-center text-xs font-semibold text-gray-600 dark:text-muted-foreground mb-2">
              <span>Maximum distance</span>
              <output className="sf-filter-value">{formatMaxDistance(maxDistance)}</output>
            </div>
            <input
              type="range"
              min="1"
              max={NEARBY_SLIDER_MAX}
              value={kmToSlider(maxDistance)}
              onChange={(e) => setMaxDistance(sliderToKm(e.target.value))}
              className="sf-glass-range w-full"
              style={{ '--sf-range-progress': `${((kmToSlider(maxDistance) - 1) / (NEARBY_SLIDER_MAX - 1)) * 100}%` }}
            />
            <div className="flex justify-between text-[10px] text-gray-400 dark:text-muted-foreground mt-0.5">
              <span>1 km</span><span>50 km</span><span>∞</span>
            </div>
          </div>

          {/* Min Rating Buttons */}
          <div className="sf-filter-section">
            <label className="block text-xs font-semibold text-gray-600 dark:text-muted-foreground mb-2">Minimum rating</label>
            <LiquidSegmentedControl
              ariaLabel="Minimum rating"
              equal
              tone="green"
              value={String(minRating)}
              onChange={rating => setMinRating(Number(rating))}
              options={[0, 3, 3.5, 4, 4.5].map(rating => ({ value: String(rating), label: rating === 0 ? 'Any' : `${rating}★` }))}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={() => { setMaxDistance(NEARBY_DEFAULT_KM); setMinRating(0); onApply({ maxDistance: NEARBY_DEFAULT_KM, minRating: 0 }); onClose(); }}
            className="sf-filter-secondary flex-1"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="sf-filter-primary flex-1"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
