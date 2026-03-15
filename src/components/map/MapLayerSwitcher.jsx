import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { useLanguage } from '@/lib/LanguageContext';

export default function MapLayerSwitcher({ activeLayer, onLayerChange }) {
  const [open, setOpen] = useState(false);
  const { isDark } = useTheme();
  const { t } = useLanguage();

  const LAYERS = [
    { id: 'basic',        labelKey: 'mapLayers.basic'        },
    { id: 'outdoor',      labelKey: 'mapLayers.outdoor'      },
    { id: 'aerial',       labelKey: 'mapLayers.aerial'       },
    { id: 'winter',       labelKey: 'mapLayers.winter'       },
    { id: 'traffic',      labelKey: 'mapLayers.traffic'      },
    { id: 'mapy_traffic', labelKey: 'mapLayers.mapy_traffic', beta: true },
  ];

  return (
    <div className="relative">
      {open && (
        <div className={`absolute bottom-full left-0 mb-3 rounded-xl shadow-xl overflow-hidden border z-50 min-w-[130px]
          ${isDark ? 'bg-card border-border' : 'bg-white border-gray-200'}`}>
          {LAYERS.map(l => (
            <button key={l.id} onClick={() => { onLayerChange(l.id); setOpen(false); }}
              className={`flex items-center justify-between w-full px-4 py-2.5 text-sm text-left font-medium transition-colors
                ${activeLayer === l.id ? 'bg-primary text-primary-foreground'
                  : isDark ? 'text-foreground hover:bg-accent' : 'text-gray-700 hover:bg-gray-50'}`}>
              <span>{t(l.labelKey)}</span>
              {l.beta && (
                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full
                  ${activeLayer === l.id ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                  β
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => setOpen(o => !o)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95
          ${open ? 'bg-primary text-primary-foreground'
            : isDark ? 'bg-accent/60 text-foreground hover:bg-accent' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        title={t('mapLayers.title')}>
        <Layers className="w-5 h-5" />
      </button>
    </div>
  );
}
