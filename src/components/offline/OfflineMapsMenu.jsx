/**
 * OfflineMapsMenu.jsx
 *
 * Full-screen slide-up panel for downloading/managing offline maps.
 * Shows:
 *   - List of countries with download size + progress
 *   - Per-country: Download Basic / Standard, Delete
 *   - Storage used / quota indicator
 *   - Offline POI download (requires Geoapify key)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, Trash2, MapPin, CheckCircle2, AlertCircle,
         WifiOff, HardDrive, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { COUNTRIES, downloadCountryPMTiles, downloadCountryPOIs, deleteCountry } from '../../lib/offlineManager.js';
import { getAllMeta, estimateStorageUsage, getPOIs } from '../../lib/offlineStorage.js';

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '';

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ meta }) {
  if (!meta) return null;
  const date = new Date(meta.downloadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const label = meta.zoom >= 19 ? 'Detailed' : 'Basic';
  const color = meta.zoom >= 19
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
    : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {label} · {date}
    </span>
  );
}

// ─── Storage bar ──────────────────────────────────────────────────────────────
function StorageBar({ usedMB, quotaMB }) {
  const pct = quotaMB > 0 ? Math.min(100, Math.round(usedMB / quotaMB * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> Storage</span>
        <span>{usedMB} MB / {quotaMB > 0 ? quotaMB + ' MB' : '—'}</span>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct > 80 ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ receivedMB, totalMB, speedMBps, etaSec, label }) {
  const pct = totalMB > 0 ? Math.min(100, Math.round(receivedMB / totalMB * 100)) : 0;
  const eta = etaSec > 60 ? `${Math.round(etaSec/60)}m` : etaSec > 0 ? `${Math.round(etaSec)}s` : '';
  return (
    <div className="space-y-1 mt-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {receivedMB.toFixed(1)} / {totalMB.toFixed(0)} MB
          {speedMBps > 0 && <span className="ml-1 text-blue-500">· {speedMBps.toFixed(1)} MB/s{eta && ` · ${eta} left`}</span>}
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Country row ─────────────────────────────────────────────────────────────
function CountryRow({ country, meta, onDownload, onDelete, activeDownload }) {
  const [expanded, setExpanded] = useState(false);
  const isActive   = activeDownload?.code === country.code;
  const hasPOIs    = meta?.hasPOIs;
  const downloaded = !!meta;

  return (
    <div className={`rounded-xl border transition-all duration-200 overflow-hidden
      ${downloaded
        ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20'
        : 'border-border bg-card'}`}>

      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-2xl leading-none">{country.flag}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{country.name}</span>
            {downloaded && <StatusBadge meta={meta} />}
          </div>
          {isActive && activeDownload.progress && (
            <ProgressBar
              receivedMB={activeDownload.progress.receivedMB || 0}
              totalMB={activeDownload.progress.totalMB || country.sizeMB}
              speedMBps={activeDownload.progress.speedMBps || 0}
              etaSec={activeDownload.progress.etaSec || 0}
              label={activeDownload.phase === 'pois' ? 'Downloading POIs…' : 'Downloading map…'}
            />
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {isActive ? (
            <button
              onClick={() => onDownload(country, 'cancel')}
              className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 active:scale-95 transition-all"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setExpanded(e => !e)}
              disabled={isActive}
              className="p-2 rounded-lg bg-gray-100 dark:bg-accent/50 text-muted-foreground hover:bg-gray-200 active:scale-95 transition-all"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded options */}
      {expanded && !isActive && (
        <div className="px-4 pb-3 border-t border-border/50 pt-3 space-y-2">
          {/* Download options */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { onDownload(country, 'basic'); setExpanded(false); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 active:scale-95 transition-all"
            >
              <Download className="w-3 h-3" />
              Basic
              <span className="opacity-75">~{country.basicMB} MB · zoom 15</span>
            </button>
            <button
              onClick={() => { onDownload(country, 'detailed'); setExpanded(false); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500 text-white text-xs font-medium hover:bg-purple-600 active:scale-95 transition-all"
            >
              <Download className="w-3 h-3" />
              Detailed
              <span className="opacity-75">~{country.detailedMB >= 1000 ? (country.detailedMB/1000).toFixed(1)+'GB' : country.detailedMB+'MB'} · zoom 19</span>
            </button>
          </div>

          {/* POI download (needs Geoapify key) */}
          {GEOAPIFY_KEY && (
            <button
              onClick={() => { onDownload(country, 'pois'); setExpanded(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-600 text-orange-700 dark:text-orange-300 text-xs font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 active:scale-95 transition-all"
            >
              <MapPin className="w-3 h-3" />
              {hasPOIs ? 'Refresh POIs' : 'Download POIs (restaurants, cafes…)'}
            </button>
          )}

          {/* Delete */}
          {downloaded && (
            <button
              onClick={() => { onDelete(country); setExpanded(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all"
            >
              <Trash2 className="w-3 h-3" />
              Delete download
            </button>
          )}

          {/* Info */}
          <p className="text-xs text-muted-foreground">
            <strong>Basic</strong> (zoom 0–15): navigation + streets, fast download. 
            <strong> Detailed</strong> (zoom 0–19): every building &amp; alley, very large.
            Generate with: <code>pmtiles extract planet.pmtiles {country.code}-basic.pmtiles --maxzoom=15</code>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function OfflineMapsMenu({ onClose }) {
  const [metaMap,   setMetaMap]   = useState({});
  const [storage,   setStorage]   = useState({ usedMB: 0, quotaMB: 0 });
  const [active,    setActive]    = useState(null); // { code, phase, progress }
  const [toast,     setToast]     = useState(null);
  const abortRef = useRef({ current: false });

  // Load saved metadata
  useEffect(() => {
    getAllMeta().then(setMetaMap);
    estimateStorageUsage().then(setStorage);
  }, []);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
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

    if (mode === 'pois') {
      setActive({ code: country.code, phase: 'pois', progress: { receivedMB: 0, totalMB: 1, speedMBps: 0, etaSec: 0 } });
      await downloadCountryPOIs({
        country,
        geoapifyKey: GEOAPIFY_KEY,
        onProgress: (done, total) =>
          setActive(a => a ? { ...a, progress: { receivedMB: done, totalMB: total, speedMBps: 0, etaSec: 0 } } : null),
        abortRef: abortRef.current,
      });
      if (!abortRef.current.current) showToast(`POIs downloaded for ${country.name} ✓`, 'success');
      setActive(null);
      await refresh();
      return;
    }

    // Single-file PMTiles download
    const isDetailed = mode === 'detailed';
    const zoom       = isDetailed ? 19 : 15;
    const sizeMB     = isDetailed ? country.detailedMB : country.basicMB;
    setActive({ code: country.code, phase: 'tiles', progress: { receivedMB: 0, totalMB: sizeMB, speedMBps: 0, etaSec: 0 } });

    try {
      await downloadCountryPMTiles({
        country,
        zoom,
        onProgress: (p) => setActive(a => a ? { ...a, progress: p } : null),
        abortRef: abortRef.current,
      });
      if (!abortRef.current.current) showToast(`${country.name} downloaded ✓`, 'success');
      else showToast('Download cancelled', 'info');
    } catch (e) {
      showToast(`Error: ${e.message}`, 'error');
    }

    setActive(null);
    await refresh();
  }, [metaMap]);

  const handleDelete = useCallback(async (country) => {
    const tplHash = hashTemplate(OFFLINE_TILE_TEMPLATE);
    await deleteCountry(country, tplHash);
    showToast(`${country.name} deleted`, 'info');
    await refresh();
  }, []);

  // Sort: downloaded first, then alphabetical
  const sorted = [...COUNTRIES].sort((a, b) => {
    const da = !!metaMap[a.code];
    const db = !!metaMap[b.code];
    if (da !== db) return da ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-background/95 backdrop-blur-sm">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe-top py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-blue-500" />
          <div>
            <h2 className="font-semibold text-base leading-tight">Offline Maps</h2>
            <p className="text-xs text-muted-foreground">Download maps for offline navigation & search</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-accent/60 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Info banner */}
      <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 shrink-0">
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          Downloaded maps work <strong>without internet</strong>. Tiles are also auto-cached
          as you browse. Spots from your account sync when you're online.
          {!GEOAPIFY_KEY && (
            <span className="block mt-1 text-orange-600 dark:text-orange-400">
              ⚠ Set <code>VITE_GEOAPIFY_KEY</code> to enable offline restaurant & café search.
            </span>
          )}
        </p>
      </div>

      {/* Storage bar */}
      <div className="px-4 mt-3 shrink-0">
        <StorageBar usedMB={storage.usedMB} quotaMB={storage.quotaMB} />
      </div>

      {/* Country list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
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
        <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white transition-all
          ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-gray-700'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}