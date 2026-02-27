import React from 'react';

export default function StarRating({ value = 0, onChange, readOnly = false, size = 'md' }) {
  const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' };
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => !readOnly && onChange && onChange(star)}
          disabled={readOnly}
          className={`${sizes[size]} transition-transform ${!readOnly ? 'hover:scale-110 active:scale-95 cursor-pointer' : 'cursor-default'} ${star <= value ? 'text-yellow-400' : 'text-gray-300'}`}
          style={{ background: 'none', border: 'none', padding: '2px' }}
        >
          ★
        </button>
      ))}
    </div>
  );
}