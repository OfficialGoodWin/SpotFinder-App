import React, { useState } from 'react';
import { Layers } from 'lucide-react';

const LAYERS = [
  { id: 'basic', label: 'Map' },
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'aerial', label: 'Satellite' },
  { id: 'winter', label: 'Winter' },
];

export default function MapLayerSwitcher({ activeLayer, onLayerChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-4 right-4 z-[1000]">
      {open && (
        <div className="mb-2 bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200">
          {LAYERS.map(l => (
            <button
              key={l.id}
              onClick={() => { onLayerChange(l.id); setOpen(false); }}
              className={`block w-full px-4 py-2.5 text-sm text-left font-medium transition-colors
                ${activeLayer === l.id ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-200 active:scale-95 transition-transform"
      >
        <Layers className="w-5 h-5 text-gray-700" />
      </button>
    </div>
  );
}