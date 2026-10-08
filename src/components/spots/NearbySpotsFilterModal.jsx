import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
      <div className="bg-white dark:bg-card rounded-3xl shadow-xl max-w-sm w-full p-5 border border-gray-100 dark:border-border">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-900 dark:text-foreground text-base">Filter Nearby Spots</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-accent">
            <X className="w-4 h-4 text-gray-400 dark:text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Distance Slider */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-gray-600 dark:text-muted-foreground mb-1">
              <span>Max Distance</span>
              <span className="text-purple-600 dark:text-purple-400">{formatMaxDistance(maxDistance)}</span>
            </div>
            <input
              type="range"
              min="1"
              max={NEARBY_SLIDER_MAX}
              value={kmToSlider(maxDistance)}
              onChange={(e) => setMaxDistance(sliderToKm(e.target.value))}
              className="sf-glass-range w-full"
            />
            <div className="flex justify-between text-[10px] text-gray-400 dark:text-muted-foreground mt-0.5">
              <span>1 km</span><span>50 km</span><span>∞</span>
            </div>
          </div>

          {/* Min Rating Buttons */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-muted-foreground mb-1.5">Minimum Rating</label>
            <LiquidSegmentedControl
              ariaLabel="Minimum rating"
              equal
              tone="purple"
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
            className="flex-1 py-2 rounded-xl text-xs font-medium text-gray-500 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-accent border border-gray-200 dark:border-border"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2 rounded-xl text-xs font-medium bg-purple-600 text-white hover:bg-purple-700"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
