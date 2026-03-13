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

// Used inline inside the bottom bar — opens upward
export default function MapLayerSwitcher({ activeLayer, onLayerChange }) {
  const [open, setOpen] = useState(false);
  const { isDark } = useTheme();

  return (
    <div className="relative">
      {/* Dropdown — opens upward */}
      {open && (
        <div className={`absolute bottom-full left-0 mb-3 rounded-xl shadow-xl overflow-hidden border z-50 min-w-[120px]
          ${isDark ? 'bg-card border-border' : 'bg-white border-gray-200'}`}>
          {LAYERS.map(l => (
            <button
              key={l.id}
              onClick={() => { onLayerChange(l.id); setOpen(false); }}
              className={`block w-full px-4 py-2.5 text-sm text-left font-medium transition-colors
                ${activeLayer === l.id
                  ? 'bg-primary text-primary-foreground'
                  : isDark ? 'text-foreground hover:bg-accent' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      {/* Trigger button — styled to match bottom bar */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95
          ${open
            ? 'bg-primary text-primary-foreground'
            : isDark ? 'bg-accent/60 text-foreground hover:bg-accent' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        title="Map layers"
      >
        <Layers className="w-5 h-5" />
      </button>
    </div>
  );
}