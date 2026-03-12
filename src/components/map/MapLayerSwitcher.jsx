import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';

const LAYERS = [
  { id: 'basic',   label: 'Basic'     },
  { id: 'outdoor', label: 'Outdoor'   },
  { id: 'aerial',  label: 'Satellite' },
  { id: 'winter',  label: 'Winter'    },
  { id: 'traffic', label: 'Traffic'   },
];

export default function MapLayerSwitcher({ activeLayer, onLayerChange }) {
  const [open, setOpen] = useState(false);
  const { isDark } = useTheme();

  return (
    <div className="absolute top-4 right-4 z-[1000]">
      {open && (
        <div className={`mb-2 rounded-xl shadow-xl overflow-hidden border transition-colors
          ${isDark
            ? 'bg-card border-border'
            : 'bg-white border-gray-200'}`}
        >
          {LAYERS.map(l => (
            <button
              key={l.id}
              onClick={() => { onLayerChange(l.id); setOpen(false); }}
              className={`block w-full px-4 py-2.5 text-sm text-left font-medium transition-colors
                ${activeLayer === l.id
                  ? 'bg-primary text-primary-foreground'
                  : isDark
                    ? 'text-foreground hover:bg-accent'
                    : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center border active:scale-95 transition-all
          ${isDark
            ? 'bg-card border-border text-foreground'
            : 'bg-white border-gray-200 text-gray-700'}`}
      >
        <Layers className="w-5 h-5" />
      </button>
    </div>
  );
}
