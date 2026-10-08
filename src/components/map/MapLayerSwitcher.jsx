import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export default function MapLayerSwitcher({ activeLayer, onLayerChange, menuPlacement = 'top' }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  const LAYERS = [
    { id: 'basic',   labelKey: 'mapLayers.basic'   },
    { id: 'outdoor', labelKey: 'mapLayers.outdoor'  },
    { id: 'aerial',  labelKey: 'mapLayers.aerial'   },
    { id: 'winter',  labelKey: 'mapLayers.winter'   },
    { id: 'traffic', labelKey: 'mapLayers.traffic'  },
  ];

  return (
    <div className="relative">
      {open && (
        <>
          {/* Backdrop to close */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute z-50 min-w-[130px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-border dark:bg-card ${
            menuPlacement === 'right' ? 'left-full top-0 ml-3' : 'bottom-full left-0 mb-3'
          }`}>
            {LAYERS.map(l => (
              <button key={l.id} onClick={() => { onLayerChange(l.id); setOpen(false); }}
                className={`block w-full px-4 py-2.5 text-sm text-left font-medium transition-colors
                  ${activeLayer === l.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-accent'}`}>
                {t(l.labelKey)}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95
          ${open
            ? 'bg-primary text-primary-foreground'
            : 'bg-gray-100 dark:bg-accent/60 text-gray-600 dark:text-foreground hover:bg-gray-200 dark:hover:bg-accent'}`}
      >
        <Layers className="w-5 h-5" />
        <span className="sr-only">Map layers</span>
      </button>
    </div>
  );
}
