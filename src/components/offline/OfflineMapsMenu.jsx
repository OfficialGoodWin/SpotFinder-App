/**
 * OfflineMapsMenu.jsx  (updated)
 *
 * What's new vs the original:
 *   - Downloads the single .pmtiles file to OPFS (not 50k range requests)
 *   - Also downloads the OSRM routing data package (.tar.gz) alongside the map
 *   - Shows high-zoom tile cache size and a clear button
 *   - Shows OPFS file sizes alongside IndexedDB meta
 *   - VITE_TILE_SERVER check: warns if not configured
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Download, Trash2, MapPin, WifiOff, HardDrive,
  ChevronDown, ChevronUp, Info, Navigation, Gauge,
} from 'lucide-react';
import {
  COUNTRIES,
  downloadCountryVectorTiles,
  downloadCountryPOIs,
  deleteCountry,
  scrubInvalidMeta,
} from '../../lib/vectorTileDownloader.js';
import { getAllMeta, estimateStorageUsage } from '../../lib/offlineStorage.js';
import { getFileSizeMB, isOPFSSupported } from '../../lib/opfsTileStore.js';
import { getCacheSizeMB, clearHighZoomCache } from '../../lib/highZoomCache.js';
import { listCachedRoutes, clearRouteCache } from '../../lib/routeCache.js';
import OsrmPlugin from '../../plugins/OsrmPlugin.js';

const GEOAPIFY_KEY  = import.meta.env.VITE_GEOAPIFY_KEY  || '';
const TILE_SERVER   = import.meta.env.VITE_TILE_SERVER   || '';

// ── Region groupings ──────────────────────────────────────────────────────────
const REGIONS = [
  { name: 'Central Europe', codes: ['CZ','SK','AT','HU','PL','CH'] },
  { name: 'Western Europe', codes: ['FR','ES','PT','NL','BE'] },
  { name: 'Southern Europe', codes: ['IT','HR','SI','GR'] },
  { name: 'Eastern Europe',  codes: ['RO','UA'] },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StorageBar({ usedMB, quotaMB }) {
  const pct = quotaMB > 0 ? Math.min(100, Math.round(usedMB / quotaMB * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />Storage</span>
        <span>{usedMB} MB{quotaMB > 0 ? ` / ${quotaMB} MB` : ''}</span>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ProgressBar({ receivedMB, totalMB, speedMBps, etaSec, pct, phase }) {
  const safePct = Math.min(100, Math.max(0, pct || 0));
  const eta = !etaSec ? '' : etaSec > 3600 ? `${Math.round(etaSec / 3600)}h`
    : etaSec > 60 ? `${Math.round(etaSec / 60)}m` : `${Math.round(etaSec)}s`;

  const label = phase === 'pois'   ? 'Downloading POIs…'
              : phase === 'osrm'   ? 'Downloading routing data…'
              : 'Downloading map…';
  const color = phase === 'pois'   ? 'bg-orange-500'
              : phase === 'osrm'   ? 'bg-purple-500'
              : 'bg-blue-500';

  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        <span className={`font-medium ${phase === 'pois' ? 'text-orange-500' : phase === 'osrm' ? 'text-purple-500' : 'text-blue-500'}`}>
          {safePct}%{speedMBps > 0 ? ` · ${speedMBps.toFixed(1)} MB/s` : ''}{eta ? ` · ${eta}` : ''}
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-200`}
          style={{ width: `${safePct}%` }} />
      </div>
      {receivedMB != null && totalMB != null && (
        <div className="text-xs text-muted-foreground text-right">
          {receivedMB.toFixed(1)} / {totalMB.toFixed(0)} MB
        </div>
      )}
    </div>
  );
}

function StatusBadge({ meta, opfsSizeMB, osrmAvailable }) {
  if (!meta) return null;
  const date = new Date(meta.downloadedAt).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'2-digit' });
  const size = opfsSizeMB > 0 ? opfsSizeMB : meta.sizeMB;
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1">
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
        ✓ {size} MB · {date}
      </span>
      {meta.hasPOIs && (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
          POIs ✓
        </span>
      )}
      {osrmAvailable && (
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
          Nav ✓
        </span>
      )}
    </div>
  );
}

function CountryRow({ country, meta, opfsSizeMB, osrmAvailable, onDownload, onDelete, activeDownload }) {
  const [expanded, setExpanded] = useState(false);
  const isActive   = activeDownload?.code === country.code;
  const downloaded = !!meta;
  const sizeMB     = country.sizeMB;
  const sizeLabel  = sizeMB >= 1000 ? `~${(sizeMB / 1000).toFixed(1)} GB` : `~${sizeMB} MB`;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all
      ${downloaded ? 'border-green-300 dark:border-green-700 bg-green-50/40 dark:bg-green-950/20' : 'border-border bg-card'}`}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <span className="text-xl leading-none select-none mt-0.5">{country.flag}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{country.name}</span>
          </div>
          {!isActive && <StatusBadge meta={meta} opfsSizeMB={opfsSizeMB} osrmAvailable={osrmAvailable} />}
          {isActive && activeDownload.progress && <ProgressBar {...activeDownload.progress} />}
        </div>
        <div className="flex-shrink-0 mt-0.5">
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
          {/* Map download */}
          <button onClick={() => { onDownload(country, 'map'); setExpanded(false); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 active:scale-[0.98] transition-all shadow-sm">
            <Download className="w-4 h-4" />
            {downloaded ? 'Re-download Map' : 'Download Map'}
            <span className="text-blue-100 font-normal text-xs">({sizeLabel} · z0–19)</span>
          </button>

          {/* OSRM routing download (Android only) */}
          {OsrmPlugin.isAvailable && (
            <button onClick={() => { onDownload(country, 'osrm'); setExpanded(false); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 active:scale-[0.98] transition-all">
              <Navigation className="w-4 h-4" />
              {osrmAvailable ? 'Refresh Offline Navigation' : 'Download Offline Navigation'}
              <span className="text-xs opacity-70">({country.code === 'CZ' ? '~14 MB' : '~10-70 MB'})</span>
            </button>
          )}

          {/* POIs download */}
          {GEOAPIFY_KEY && (
            <button onClick={() => { onDownload(country, 'pois'); setExpanded(false); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-orange-300 dark:border-orange-600 text-orange-700 dark:text-orange-300 text-sm font-medium hover:bg-orange-50 dark:hover:bg-orange-900/20 active:scale-[0.98] transition-all">
              <MapPin className="w-4 h-4" />
              {meta?.hasPOIs
                ? `Refresh POIs (${meta.poiCount?.toLocaleString() || '?'} places)`
                : 'Download POIs (restaurants, ATMs, hotels…)'}
            </button>
          )}

          {/* Delete */}
          {downloaded && (
            <button onClick={() => { onDelete(country); setExpanded(false); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.98] transition-all">
              <Trash2 className="w-4 h-4" />
              Delete all offline data
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RegionSection({ region, countries, metaMap, opfsSizes, osrmCountries, onDownload, onDelete, activeDownload }) {
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
              {downloaded}/{countries.length}
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="space-y-1.5 pl-1">
          {countries.map(country => (
            <CountryRow key={country.code}
              country={country}
              meta={metaMap[country.code] || null}
              opfsSizeMB={opfsSizes[country.code] || 0}
              osrmAvailable={osrmCountries.has(country.code)}
              onDownload={onDownload}
              onDelete={onDelete}
              activeDownload={activeDownload?.code === country.code ? activeDownload : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OfflineMapsMenu({ onClose }) {
  const [metaMap,        setMetaMap]        = useState({});
  const [opfsSizes,      setOpfsSizes]      = useState({});
  const [osrmCountries,  setOsrmCountries]  = useState(new Set());
  const [storage,        setStorage]        = useState({ usedMB: 0, quotaMB: 0 });
  const [hzCacheMB,      setHzCacheMB]      = useState(0);
  const [cachedRoutes,   setCachedRoutes]   = useState([]);
  const [active,         setActive]         = useState(null);
  const [toast,          setToast]          = useState(null);
  const abortRef = useRef({ current: false });

  useEffect(() => {
    scrubInvalidMeta().then(refresh);
    getCacheSizeMB().then(setHzCacheMB);
    listCachedRoutes().then(setCachedRoutes);
  }, []);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const refresh = async () => {
    const [m, s] = await Promise.all([getAllMeta(), estimateStorageUsage()]);
    setMetaMap(m);
    setStorage(s);

    // Check actual OPFS file sizes (more accurate than IndexedDB meta)
    const sizes = {};
    for (const country of COUNTRIES) {
      sizes[country.code] = await getFileSizeMB(`${country.code}.pmtiles`);
    }
    setOpfsSizes(sizes);

    // Check which countries have OSRM data (Android only)
    if (OsrmPlugin.isAvailable) {
      const osrmSet = new Set();
      for (const [code] of Object.entries(m)) {
        // Check if the OSRM data directory exists on device
        // We infer this from the meta having type=pmtiles (both are downloaded together)
        if (m[code]?.hasOsrm) osrmSet.add(code);
      }
      setOsrmCountries(osrmSet);
    }
  };

  const handleDownload = useCallback(async (country, mode) => {
    if (mode === 'cancel') {
      abortRef.current = { current: true };
      setActive(null);
      return;
    }
    abortRef.current = { current: false };

    // ── POIs ──────────────────────────────────────────────────────────────────
    if (mode === 'pois') {
      setActive({ code: country.code, progress: { phase: 'pois', pct: 0, done: 0, total: 1 } });
      try {
        await downloadCountryPOIs({
          country,
          onProgress: (p) => setActive(a => a ? {
            ...a,
            progress: { phase: 'pois', pct: Math.round(p.done / p.total * 100), ...p },
          } : null),
          abortRef: abortRef.current,
        });
        if (!abortRef.current.current) {
          showToast(`POIs downloaded for ${country.name} ✓`, 'success');
        }
      } catch (e) {
        showToast(e.message.split('\n')[0], 'error');
      }
      setActive(null);
      await refresh();
      return;
    }

    // ── OSRM routing data ─────────────────────────────────────────────────────
    if (mode === 'osrm') {
      if (!TILE_SERVER) {
        showToast('VITE_TILE_SERVER not set — see server/setup.md', 'error');
        return;
      }
      setActive({ code: country.code, progress: { phase: 'osrm', pct: 0, receivedMB: 0, totalMB: 0 } });
      try {
        const url = `${TILE_SERVER}/osrm/${country.code}-osrm.tar.gz`;
        await OsrmPlugin.downloadData({
          url,
          countryCode: country.code,
          onProgress: ({ pct }) => setActive(a => a ? {
            ...a,
            progress: { phase: 'osrm', pct },
          } : null),
        });

        // Mark in meta
        const existing = metaMap[country.code] || {};
        const { setMeta } = await import('../../lib/offlineStorage.js');
        await setMeta(country.code, { ...existing, hasOsrm: true });

        showToast(`Offline navigation ready for ${country.name} ✓`, 'success');

        // Auto-start OSRM if it isn't already running
        const status = await OsrmPlugin.getStatus();
        if (!status.running) {
          const dataPath = `/data/data/com.spotfinder.app/files/osrm/${country.code}/${country.code}.osrm`;
          OsrmPlugin.startOsrm({ dataPath }).catch(e => console.warn('OSRM start:', e.message));
        }
      } catch (e) {
        showToast(e.message.split('\n')[0], 'error');
      }
      setActive(null);
      await refresh();
      return;
    }

    // ── Map tiles ─────────────────────────────────────────────────────────────
    if (!TILE_SERVER) {
      showToast('VITE_TILE_SERVER not set — see server/setup.md', 'error');
      return;
    }

    setActive({
      code: country.code,
      progress: { phase: 'tiles', receivedMB: 0, totalMB: country.sizeMB, speedMBps: 0, etaSec: 0, pct: 0 },
    });

    try {
      await downloadCountryVectorTiles({
        country,
        onProgress: (p) => setActive(a => a ? { ...a, progress: { phase: 'tiles', ...p } } : null),
        abortRef: abortRef.current,
      });
      if (!abortRef.current.current) {
        showToast(`${country.name} ready for offline use ✓`, 'success');
      } else {
        showToast('Download cancelled', 'info');
      }
    } catch (e) {
      showToast(e.message.split('\n')[0], 'error');
    }
    setActive(null);
    await refresh();
  }, [metaMap]);

  const handleDelete = useCallback(async (country) => {
    await deleteCountry(country);
    // Also remove OSRM data if on Android
    if (OsrmPlugin.isAvailable) {
      try {
        // Stop OSRM if running on this country
        const status = await OsrmPlugin.getStatus();
        if (status.running) await OsrmPlugin.stopOsrm();
      } catch (_) {}
    }
    showToast(`${country.name} deleted`, 'info');
    await refresh();
  }, []);

  const handleClearHzCache = async () => {
    await clearHighZoomCache();
    setHzCacheMB(0);
    showToast('High-zoom tile cache cleared', 'info');
  };

  const handleClearRoutes = async () => {
    await clearRouteCache();
    setCachedRoutes([]);
    showToast('Cached routes cleared', 'info');
  };

  const opfsSupported = isOPFSSupported();

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-blue-500" />
          <div>
            <h2 className="font-bold text-base leading-tight">Offline Maps</h2>
            <p className="text-xs text-muted-foreground">Vector tiles · OPFS storage · Zoom 0–19</p>
          </div>
        </div>
        <button onClick={onClose}
          className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-accent/60 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Server not configured warning */}
        {!TILE_SERVER && (
          <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
              <strong>Tile server not configured.</strong> Set <code>VITE_TILE_SERVER</code> in your .env file and generate PMTiles files.
              See <code>server/setup.md</code> for instructions.
            </p>
          </div>
        )}

        {/* OPFS not supported */}
        {!opfsSupported && (
          <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-800 dark:text-yellow-300">
              <strong>OPFS not available</strong> on this browser. Offline maps require Chrome 99+ or Android WebView.
            </p>
          </div>
        )}

        {/* Info */}
        <div className="mx-4 mt-3 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 shrink-0">
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            <strong>One file per country</strong> — downloads in minutes, not hours. Full zoom 0–19 vector tiles stored on your device. Works completely offline.
          </p>
        </div>

        {/* Storage bar */}
        <div className="px-4 mt-3">
          <StorageBar usedMB={storage.usedMB} quotaMB={storage.quotaMB} />
        </div>

        {/* Cache info row */}
        <div className="px-4 mt-3 grid grid-cols-2 gap-2">
          {/* High-zoom tile cache */}
          <div className="rounded-xl border border-border bg-card px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">Tile cache</p>
                <p className="text-xs text-muted-foreground mt-0.5">z15–19 · {hzCacheMB} MB</p>
              </div>
              <button onClick={handleClearHzCache}
                className="text-xs text-red-500 hover:text-red-600 active:scale-95 transition-all px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30">
                Clear
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Tiles cached as you browse online. Max 600 MB.
            </p>
          </div>

          {/* Route cache */}
          <div className="rounded-xl border border-border bg-card px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">Route cache</p>
                <p className="text-xs text-muted-foreground mt-0.5">{cachedRoutes.length} routes</p>
              </div>
              <button onClick={handleClearRoutes}
                className="text-xs text-red-500 hover:text-red-600 active:scale-95 transition-all px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30">
                Clear
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Routes saved for offline replay.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 mt-2 flex gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Map
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> POIs
          </span>
          {OsrmPlugin.isAvailable && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Navigation
            </span>
          )}
        </div>

        {/* Country list */}
        <div className="px-4 py-3 space-y-2 pb-8">
          {REGIONS.map(region => {
            const countries = region.codes.map(code => COUNTRIES.find(c => c.code === code)).filter(Boolean);
            return (
              <RegionSection key={region.name}
                region={region}
                countries={countries}
                metaMap={metaMap}
                opfsSizes={opfsSizes}
                osrmCountries={osrmCountries}
                onDownload={handleDownload}
                onDelete={handleDelete}
                activeDownload={active}
              />
            );
          })}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`absolute bottom-6 left-4 right-4 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white text-center transition-all
          ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
