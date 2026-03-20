/**
 * OfflineMapsMenu.jsx
 * Offline map download manager — batch tile downloader UI.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, Trash2, MapPin, CheckCircle2,
         WifiOff, HardDrive, ChevronDown, ChevronUp } from 'lucide-react';
import { COUNTRIES, downloadCountryTiles, downloadCountryPOIs, deleteCountryTiles } from '../../lib/offlineManager.js';
import { getAllMeta, estimateStorageUsage } from '../../lib/offlineStorage.js';

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '';
const MAPY_KEY     = import.meta.env.VITE_MAPY_API_KEY || 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';
const TILE_TEMPLATE = `https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${MAPY_KEY}`;

// ─── Storage bar ──────────────────────────────────────────────────────────────
function StorageBar({ usedMB, quotaMB }) {
  const pct = quotaMB > 0 ? Math.min(100, Math.round(usedMB / quotaMB * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> Storage</span>
        <span>{usedMB} MB {quotaMB > 0 ? `/ ${quotaMB} MB` : ''}</span>
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
function ProgressBar({ done, total, tilesPerSec, etaSec, label }) {
  const pct = total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0;
  const eta = etaSec > 3600
    ? `${Math.round(etaSec/3600)}h`
    : etaSec > 60
    ? `${Math.round(etaSec/60)}m`
    : etaSec > 0 ? `${etaSec}s` : '';

  return (
    <div className="space-y-1 mt-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {pct}%
          {tilesPerSec > 0 && (
            <span className="ml-1 text-blue-500">
              · {tilesPerSec} tiles/s{eta && ` · ${eta} left`}
            </span>
          )}
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground text-right">
        {done.toLocaleString()} / {total.toLocaleString()} tiles
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ meta }) {
  if (!meta) return null;
  const date  = new Date(meta.downloadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const label = meta.maxZoom >= 19 ? 'Detailed' : 'Basic';
  const color = meta.maxZoom >= 19
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
    : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {label} · {meta.tileCount?.toLocaleString()} tiles · {date}
    </span>
  );
}

// ─── Country row ─────────────────────────────────────────────────────────────
function CountryRow({ country, meta, onDownload, onDelete, activeDownload }) {
  const [expanded, setExpanded] = useState(false);
  const isActive   = activeDownload?.code === country.code;
  const downloaded = !!meta;

  return (
    <div className={`rounded-xl border transition-all duration-200 overflow-hidden
      ${downloaded
        ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20'
        : 'border-border bg-card'}`}>

      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-2xl leading-none">{country.flag}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{country.name}</span>
            {downloaded && !isActive && <StatusBadge meta={meta} />}
          </div>
          {isActive && activeDownload.progress && (
            <ProgressBar
              done={activeDownload.progress.done}
              total={activeDownload.progress.total}
              tilesPerSec={activeDownload.progress.tilesPerSec}
              etaSec={activeDownload.progress.etaSec}
              label={activeDownload.phase === 'pois' ? 'Downloading POIs…' : 'Downloading tiles…'}
            />
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {isActive ? (
            <button
              onClick={() => onDownload(country, 'cancel')}
              className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 active:scale-95 transition-all"
            >
              <X className="w-4 h-4" />
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

      {expanded && !isActive && (
        <div className="px-4 pb-3 border-t border-border/50 pt-3 space-y-2">
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
              <span className="opacity-75">
                ~{country.detailedMB >= 1000
                  ? (country.detailedMB / 1000).toFixed(1) + ' GB'
                  : country.detailedMB + ' MB'} · zoom 19
              </span>
            </button>
          </div>

          {GEOAPIFY_KEY && (
            <button
              onClick={() => { onDownload(country, 'pois'); setExpanded(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-600 text-orange-700 dark:text-orange-300 text-xs font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 active:scale-95 transition-all"
            >
              <MapPin className="w-3 h-3" />
              {meta?.hasPOIs ? 'Refresh POIs' : 'Download POIs (restaurants, cafes…)'}
            </button>
          )}

          {downloaded && (
            <button
              onClick={() => { onDelete(country); setExpanded(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all"
            >
              <Trash2 className="w-3 h-3" />
              Delete download
            </button>
          )}

          <p className="text-xs text-muted-foreground">
            <strong>Basic</strong>: navigation + street level (zoom 0–15) ·
            <strong> Detailed</strong>: every building (zoom 0–19, very large) ·
            Downloads {Math.min(32, 16)} tiles at a time in parallel.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function OfflineMapsMenu({ onClose }) {
  const [metaMap, setMetaMap] = useState({});
  const [storage, setStorage] = useState({ usedMB: 0, quotaMB: 0 });
  const [active,  setActive]  = useState(null);
  const [toast,   setToast]   = useState(null);
  const abortRef = useRef({ current: false });

  useEffect(() => {
    getAllMeta().then(setMetaMap);
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

    if (mode === 'pois') {
      setActive({ code: country.code, phase: 'pois', progress: { done: 0, total: 1, tilesPerSec: 0, etaSec: 0 } });
      await downloadCountryPOIs({
        country, geoapifyKey: GEOAPIFY_KEY,
        onProgress: (p) => setActive(a => a ? { ...a, progress: p } : null),
        abortRef: abortRef.current,
      });
      if (!abortRef.current.current) showToast(`POIs downloaded for ${country.name} ✓`, 'success');
      setActive(null);
      await refresh();
      return;
    }

    const maxZoom = mode === 'detailed' ? 19 : 15;
    setActive({ code: country.code, phase: 'tiles', progress: { done: 0, total: 1, tilesPerSec: 0, etaSec: 0 } });

    try {
      await downloadCountryTiles({
        country,
        tileTemplate: TILE_TEMPLATE,
        maxZoom,
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
  }, []);

  const handleDelete = useCallback(async (country) => {
    await deleteCountryTiles(country);
    showToast(`${country.name} deleted`, 'info');
    await refresh();
  }, []);

  const sorted = [...COUNTRIES].sort((a, b) => {
    const da = !!metaMap[a.code], db = !!metaMap[b.code];
    if (da !== db) return da ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-blue-500" />
          <div>
            <h2 className="font-semibold text-base leading-tight">Offline Maps</h2>
            <p className="text-xs text-muted-foreground">Download map tiles for offline use</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-accent/60 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 shrink-0">
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          Downloads <strong>32 tiles at a time</strong> in parallel and stores them on your device.
          Once downloaded, maps work fully offline — zoom in anywhere in the country.
          {!GEOAPIFY_KEY && (
            <span className="block mt-1 text-orange-600 dark:text-orange-400">
              ⚠ Set VITE_GEOAPIFY_KEY to enable offline restaurant &amp; café search.
            </span>
          )}
        </p>
      </div>

      <div className="px-4 mt-3 shrink-0">
        <StorageBar usedMB={storage.usedMB} quotaMB={storage.quotaMB} />
      </div>

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

      {toast && (
        <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white transition-all
          ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-gray-700'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}