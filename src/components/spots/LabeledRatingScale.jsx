import React from 'react';

export default function LabeledRatingScale({ value = 0, onChange, labels, disabled = false }) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-5 gap-1.5">
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" disabled={disabled} onClick={() => onChange?.(n)}
            className={`min-h-[42px] rounded-xl border text-sm font-bold transition-all ${value === n ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white dark:bg-background border-gray-200 dark:border-border text-gray-600 dark:text-foreground hover:border-blue-300'} disabled:opacity-50`}>
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between gap-3 text-[11px] leading-tight text-gray-500 dark:text-muted-foreground">
        <span>{labels?.[0]}</span><span className="text-right">{labels?.[4]}</span>
      </div>
      {value > 0 && labels?.[value - 1] && <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">{labels[value - 1]}</p>}
    </div>
  );
}
