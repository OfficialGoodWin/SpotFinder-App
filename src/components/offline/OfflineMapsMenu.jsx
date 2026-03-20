/**
 * OfflineMapsMenu.jsx
 * One button per country — downloads tiles (zoom 0-19) + POIs in sequence.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, Trash2, MapPin, WifiOff, HardDrive, ChevronDown, ChevronUp } from 'lucide-react';
import { COUNTRIES, downloadCountry, deleteCountry, scrubInvalidMeta, countTilesForCountry } from '../../lib/offlineManager.js';
import { getAllMeta, estimateStorageUsage } from '../../lib/offlineStorage.js';

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '';

// ─── Storage bar ──────────────────────────────────────────────────────────────
function StorageBar({ usedMB, quotaMB }) {
  const pct = quotaMB > 0 ? Math.min(100, Math.round(usedMB / quotaMB * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />Storage</span>
        <span>{usedMB} MB {quotaMB > 0 ? `/ ${quotaMB} MB` : ''}</span>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ phase, done, total, tilesPerSec, etaSec }) {
  const safeDone  = Math.max(0, done  || 0);
  const safeTotal = Math.max(1, total || 1);
  const pct = Math.min(100, Math.round(safeDone / safeTotal * 100));
  const eta = !etaSec ? '' : etaSec > 3600 ? `${Math.round(etaSec/3600)}h` : etaSec > 60 ? `${Math.round(etaSec/60)}m` : `${Math.round(etaSec)}s`;
  const label = phase === 'pois' ? 'Downloading POIs…' : 'Downloading map tiles…';

  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        <span className="text-blue-500 font-medium">
          {pct}%{tilesPerSec > 0 && phase === 'tiles' ? ` · ${tilesPerSec}/s` : ''}{eta ? ` · ${eta}` : ''}
        </span>
      </div>
      <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-muted-foreground text-right">
        {phase === 'tiles'
          ? `${safeDone.toLocaleString()} / ${safeTotal.toLocaleString()} tiles`
          : `${safeDone} / ${safeTotal} POI batches`}
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ meta }) {
  if (!meta) return null;
  const date = new Date(meta.downloadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
        ✓ Downloaded · {date}
      </span>
      {meta.hasPOIs && (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
          POIs included
        </span>
      )}
    </div>
  );
}

// ─── Country row ─────────────────────────────────────────────────────────────
function CountryRow({ country, meta, onDownload, onDelete, activeDownload }) {
  const [expanded, setExpanded] = useState(false);
  const isActive   = activeDownload?.code === country.code;
  const downloaded = !!meta;

  const sizeLabel = country.sizeMB >= 1000
    ? `~${(country.sizeMB / 1000).toFixed(1)} GB`
    : `~${country.sizeMB} MB`;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200
      ${downloaded ? 'border-green-300 dark:border-green-700 bg-green-50/40 dark:bg-green-950/20' : 'border-border bg-card'}`}>

      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-2xl leading-none select-none">{country.flag}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{country.name}</span>
            {!isActive && <StatusBadge meta={meta} />}
          </div>
          {isActive && activeDownload.progress && (
            <ProgressBar {...activeDownload.progress} />
          )}
        </div>

        <div className="flex-shrink-0">
          {isActive ? (
            <button
              onClick={() => onDownload(country, 'cancel')}
              className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-200 active:scale-95 transition-all"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-2 rounded-lg bg-gray-100 dark:bg-accent/50 text-muted-foreground hover:bg-gray-200 active:scale-95 transition-all"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded */}
      {expanded && !isActive && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-2.5">

          {/* Single download button */}
          <button
            onClick={() => { onDownload(country, 'download'); setExpanded(false); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 active:scale-[0.98] transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download {country.name}
            <span className="text-blue-100 font-normal text-xs">({sizeLabel} · zoom 0–19{GEOAPIFY_KEY ? ' + POIs' : ''})</span>
          </button>

          {/* Delete */}
          {downloaded && (
            <button
              onClick={() => { onDelete(country); setExpanded(false); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.98] transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete offline data
            </button>
          )}

          <p className="text-xs text-muted-foreground leading-relaxed">
            Downloads all map tiles (zoom 0–19){GEOAPIFY_KEY ? ' and POI data (restaurants, cafes, hospitals, ATMs, etc.)' : ''}.
            Requires a WiFi or mobile data connection. Works fully offline after download.
            Voice navigation uses your device's built-in speech engine.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OfflineMapsMenu({ onClose }) {
  const [metaMap, setMetaMap] = useState({});
  const [storage, setStorage] = useState({ usedMB: 0, quotaMB: 0 });
  const [active,  setActive]  = useState(null);
  const [toast,   setToast]   = useState(null);
  const abortRef = useRef({ current: false });

  useEffect(() => {
    scrubInvalidMeta().then(() => getAllMeta().then(setMetaMap));
    estimateStorageUsage().then(setStorage);
  }, []);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const refresh = async () => {
    const [m, s] = await Promise.all([getAllMeta(), estimateStorageUsage()]);
    setMetaMap(m);
    setStorage(s);
  };

  const handleDownload = useCallback(async (country, mode) => {
    if (mode === 'cancel') {
      abortRef.current = { current: true };
      setActive(null);
      return;
    }

    abortRef.current = { current: false };
    const total = countTilesForCountry(country, 19);
    setActive({ code: country.code, progress: { phase: 'tiles', done: 0, total, tilesPerSec: 0, etaSec: 0 } });

    try {
      await downloadCountry({
        country,
        geoapifyKey: GEOAPIFY_KEY,
        onProgress: (p) => setActive(a => a ? { ...a, progress: p } : null),
        abortRef: abortRef.current,
      });

      if (!abortRef.current.current) showToast(`${country.name} ready for offline use ✓`, 'success');
      else showToast('Download cancelled', 'info');
    } catch (e) {
      showToast(`Download failed: ${e.message}`, 'error');
    }

    setActive(null);
    await refresh();
  }, []);

  const handleDelete = useCallback(async (country) => {
    await deleteCountry(country);
    showToast(`${country.name} deleted`, 'info');
    await refresh();
  }, []);

  const sorted = [...COUNTRIES].sort((a, b) => {
    const da = !!metaMap[a.code], db = !!metaMap[b.code];
    if (da !== db) return da ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-background">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-background">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-blue-500" />
          <div>
            <h2 className="font-bold text-base leading-tight">Offline Maps</h2>
            <p className="text-xs text-muted-foreground">Download a country to use without internet</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-accent/60 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Info */}
      <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 shrink-0">
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <strong>Requires WiFi to download.</strong> Once downloaded: maps, spot search, and
          voice-guided navigation all work offline. 64 tiles download in parallel so it goes fast.
        </p>
      </div>

      {/* Storage */}
      <div className="px-4 mt-3 shrink-0">
        <StorageBar usedMB={storage.usedMB} quotaMB={storage.quotaMB} />
      </div>

      {/* Country list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 pb-6">
        {sorted.map(country => (
          <CountryRow
            key={country.code}
            country={country}
            meta={metaMap[country.code] || null}
            onDownload={handleDownload}
            onDelete={handleDelete}
            activeDownload={active?.code === country.code ? active : null}
          />
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`absolute bottom-6 left-4 right-4 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white text-center
          ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}