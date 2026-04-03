/**
 * OfflineMapsMenu.jsx — PMTiles offline maps for all of Europe.
 * Download = one streaming file per country, full zoom 0-16.
 * Requires /offline/{CC}.pmtiles on your Vercel deployment.
 * Generate: pmtiles extract https://build.protomaps.com/20260319.pmtiles
 *             public/offline/CZ.pmtiles --bbox=12.09,48.55,18.87,51.06 --maxzoom=16
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, Trash2, MapPin, WifiOff, HardDrive, ChevronDown, ChevronUp } from 'lucide-react';
import { COUNTRIES, downloadCountryPOIs, deleteCountry, scrubInvalidMeta } from '../../lib/vectorTileDownloader.js';
import { downloadCountryPMTiles } from '../../lib/offlineManager.js';
import { getAllMeta, estimateStorageUsage } from '../../lib/offlineStorage.js';

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY || '';

// ── Region groupings ──────────────────────────────────────────────────────────
const REGIONS = [
  { name: 'Central Europe', codes: ['CZ','SK','AT','HU','PL','DE','CH'] },
  { name: 'Western Europe', codes: ['FR','ES','PT','NL','BE','LU','GB','IE'] },
  { name: 'Southern Europe', codes: ['IT','HR','SI','GR','RS','BA','MK','AL','ME','MT'] },
  { name: 'Northern Europe', codes: ['SE','NO','DK','FI','EE','LV','LT','IS'] },
  { name: 'Eastern Europe',  codes: ['RO','BG','UA','MD','BY'] },
  { name: 'Microstates',     codes: ['AD','MC','SM','LI'] },
];

function StorageBar({ usedMB, quotaMB }) {
  const pct = quotaMB > 0 ? Math.min(100, Math.round(usedMB / quotaMB * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />Storage</span>
        <span>{usedMB} MB {quotaMB > 0 ? `/ ${quotaMB} MB` : ''}</span>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width:`${pct}%` }} />
      </div>
    </div>
  );
}

function ProgressBar({ receivedMB, totalMB, speedMBps, etaSec, pct, poi, poiDone, poiTotal }) {
  const safePct = Math.min(100, Math.max(0, pct || 0));
  const eta = !etaSec ? '' : etaSec > 3600 ? `${Math.round(etaSec/3600)}h` : etaSec > 60 ? `${Math.round(etaSec/60)}m` : `${Math.round(etaSec)}s`;
  if (poi) {
    const pp = poiTotal > 0 ? Math.round(poiDone/poiTotal*100) : 0;
    return (
      <div className="mt-2 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="font-medium">Downloading POIs…</span>
          <span className="text-orange-500">{pp}%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width:`${pp}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="font-medium">Downloading map…</span>
        <span className="text-blue-500 font-medium">
          {safePct}%{speedMBps > 0 ? ` · ${speedMBps.toFixed(1)} MB/s` : ''}{eta ? ` · ${eta}` : ''}
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-200" style={{ width:`${safePct}%` }} />
      </div>
      <div className="text-xs text-muted-foreground text-right">
        {(receivedMB||0).toFixed(1)} / {(totalMB||0).toFixed(0)} MB
      </div>
    </div>
  );
}

function StatusBadge({ meta }) {
  if (!meta) return null;
  const date = new Date(meta.downloadedAt).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'2-digit' });
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
        ✓ {meta.sizeMB} MB · {date}
      </span>
      {meta.hasPOIs && (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
          POIs ✓
        </span>
      )}
    </div>
  );
}

function CountryRow({ country, meta, onDownload, onDelete, activeDownload }) {
  const [expanded, setExpanded] = useState(false);
  const isActive   = activeDownload?.code === country.code;
  const downloaded = !!meta;
  const sizeLabel  = country.sizeMB >= 1000 ? `~${(country.sizeMB/1000).toFixed(1)} GB` : `~${country.sizeMB} MB`;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all
      ${downloaded ? 'border-green-300 dark:border-green-700 bg-green-50/40 dark:bg-green-950/20' : 'border-border bg-card'}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="text-xl leading-none select-none">{country.flag}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{country.name}</span>
            {!isActive && <StatusBadge meta={meta} />}
          </div>
          {isActive && activeDownload.progress && <ProgressBar {...activeDownload.progress} />}
        </div>
        <div className="flex-shrink-0">
          {isActive ? (
            <button onClick={() => onDownload(country, 'cancel')}
              className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-200 active:scale-95 transition-all">
              Cancel
            </button>
          ) : (
            <button onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-lg bg-gray-100 dark:bg-accent/50 text-muted-foreground hover:bg-gray-200 active:scale-95 transition-all">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {expanded && !isActive && (
        <div className="px-3 pb-3 border-t border-border/50 pt-2.5 space-y-2">
          <button onClick={() => { onDownload(country, 'map'); setExpanded(false); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 active:scale-[0.98] transition-all shadow-sm">
            <Download className="w-4 h-4" />
            Download Map
            <span className="text-blue-100 font-normal text-xs">({sizeLabel} · zoom 0–16)</span>
          </button>
          {GEOAPIFY_KEY && (
            <button onClick={() => { onDownload(country, 'pois'); setExpanded(false); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-orange-300 dark:border-orange-600 text-orange-700 dark:text-orange-300 text-sm font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 active:scale-[0.98] transition-all">
              <MapPin className="w-4 h-4" />
              {meta?.hasPOIs ? `Refresh POIs (${meta.poiCount?.toLocaleString() || '?'} places)` : 'Download POIs (restaurants, ATMs, hotels…)'}
            </button>
          )}
          {downloaded && (
            <button onClick={() => { onDelete(country); setExpanded(false); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.98] transition-all">
              <Trash2 className="w-4 h-4" />
              Delete offline data
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RegionSection({ region, countries, metaMap, onDownload, onDelete, activeDownload }) {
  const [open, setOpen] = useState(false);
  const downloaded = countries.filter(c => metaMap[c.code]).length;
  return (
    <div className="space-y-1.5">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gray-100 dark:bg-accent/40 hover:bg-gray-200 dark:hover:bg-accent/60 transition-all">
        <span className="font-semibold text-sm">{region.name}</span>
        <div className="flex items-center gap-2">
          {downloaded > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
              {downloaded}/{countries.length} downloaded
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="space-y-1.5 pl-1">
          {countries.map(country => (
            <CountryRow key={country.code} country={country} meta={metaMap[country.code] || null}
              onDownload={onDownload} onDelete={onDelete}
              activeDownload={activeDownload?.code === country.code ? activeDownload : null} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OfflineMapsMenu({ onClose }) {
  const [metaMap, setMetaMap] = useState({});
  const [storage, setStorage] = useState({ usedMB: 0, quotaMB: 0 });
  const [active,  setActive]  = useState(null);
  const [toast,   setToast]   = useState(null);
  const abortRef = useRef(false);

  useEffect(() => {
    scrubInvalidMeta().then(() => getAllMeta().then(setMetaMap));
    estimateStorageUsage().then(setStorage);
  }, []);

  const showToast = (msg, type='info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };
  const refresh   = async () => { const [m,s] = await Promise.all([getAllMeta(), estimateStorageUsage()]); setMetaMap(m); setStorage(s); };

  const handleDownload = useCallback(async (country, mode) => {
    if (mode === 'cancel') { abortRef.current = true; setActive(null); return; }
    if (active) return;
    abortRef.current = false;

    if (mode === 'pois') {
      setActive({ code: country.code, progress: { poi:true, done:0, total:1, poiDone:0, poiTotal:1 } });
      await downloadCountryPOIs({
        country, geoapifyKey: GEOAPIFY_KEY,
        onProgress: (p) => setActive(a => a ? { ...a, progress: { poi:true, poiDone:p.done, poiTotal:p.total } } : null),
        abortRef,
      });
      if (!abortRef.current) showToast(`POIs downloaded for ${country.name} ✓`, 'success');
      setActive(null); await refresh(); return;
    }

    setActive({ code: country.code, progress: { receivedMB:0, totalMB:country.sizeMB, speedMBps:0, etaSec:0, pct:0 } });
    try {
      await downloadCountryPMTiles({
        country,
        onProgress: (p) => setActive(a => a ? { ...a, progress: p } : null),
        abortRef,
      });
      if (!abortRef.current) showToast(`${country.name} ready for offline use ✓`, 'success');
      else showToast('Download cancelled', 'info');
    } catch(e) {
      if (abortRef.current || e.name === 'AbortError') {
        showToast('Download cancelled', 'info');
      } else {
        showToast(e.message.split('\n')[0], 'error');
      }
    }
    setActive(null); await refresh();
  }, []);

  const handleDelete = useCallback(async (country) => {
    await deleteCountry(country);
    showToast(`${country.name} deleted`, 'info');
    await refresh();
  }, []);

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-blue-500" />
          <div>
            <h2 className="font-bold text-base leading-tight">Offline Maps</h2>
            <p className="text-xs text-muted-foreground">All of Europe · Vector tiles · Zoom 0–16</p>
          </div>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-accent/60 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Info banner */}
      <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 shrink-0">
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <strong>One file per country</strong> — downloads in minutes, not hours. Uses{' '}
          <strong>vector tiles</strong> (OpenMapTiles format) so zoom 0–16 is included in every download.
          Requires WiFi. Works fully offline after.
        </p>
      </div>

      <div className="px-4 mt-3 shrink-0">
        <StorageBar usedMB={storage.usedMB} quotaMB={storage.quotaMB} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 pb-6">
        {REGIONS.map(region => {
          const countries = region.codes.map(code => COUNTRIES.find(c => c.code === code)).filter(Boolean);
          return (
            <RegionSection key={region.name} region={region} countries={countries}
              metaMap={metaMap} onDownload={handleDownload} onDelete={handleDelete}
              activeDownload={active} />
          );
        })}
      </div>

      {toast && (
        <div className={`absolute bottom-6 left-4 right-4 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white text-center
          ${toast.type==='success' ? 'bg-green-600' : toast.type==='error' ? 'bg-red-600' : 'bg-gray-800'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}