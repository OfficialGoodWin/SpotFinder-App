import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Trash2, WifiOff, HardDrive, ChevronDown, ChevronUp } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { downloadCountryVectorTiles, countTilesForCountry } from '@/lib/vectorTileDownloader';
import { getAllBboxMeta, deleteBboxMeta, estimateStorageUsage, setBboxMeta } from '@/lib/offlineStorage';
import { lightStyle } from '@/lib/mapStyle';

function StorageBar({ usedMB, quotaMB }) {
  const pct = quotaMB > 0 ? Math.min(100, Math.round((usedMB / quotaMB) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />Storage</span>
        <span>{usedMB} MB {quotaMB > 0 ? `/ ${quotaMB} MB` : ''}</span>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BboxRow({ bbox, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const dateStr = bbox.downloadedAt ? new Date(bbox.downloadedAt).toLocaleDateString() : '—';
  const sizeMB = bbox.sizeMB || 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{bbox.name || bbox.id}</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              {sizeMB} MB · {dateStr}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setExpanded((e) => !e)} className="p-1 rounded hover:bg-gray-200">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={() => onDelete(bbox.id)} className="p-1.5 rounded text-red-500 hover:bg-red-100">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {expanded && bbox.bbox && (
        <div className="px-3 pb-3 pt-2 border-t text-xs text-muted-foreground">
          BBox: [{bbox.bbox.map((v) => Number(v).toFixed(4)).join(', ')}]
        </div>
      )}
    </div>
  );
}

function kmPerDegLon(lat) {
  return 111.32 * Math.cos((lat * Math.PI) / 180);
}

function estimateSizeMB(bbox) {
  if (!bbox) return 0;
  const [w, s, e, n] = bbox;
  const midLat = (s + n) / 2;
  const widthKm = Math.abs(e - w) * kmPerDegLon(midLat);
  const heightKm = Math.abs(n - s) * 111.32;
  const areaKm2 = widthKm * heightKm;
  return Math.max(20, Math.round(areaKm2 * 0.12));
}

export default function OfflineMapsMenu({ onClose }) {
  const [drawingBbox, setDrawingBbox] = useState(false);
  const [bboxes, setBboxes] = useState([]);
  const [storage, setStorage] = useState({ usedMB: 0, quotaMB: 0 });
  const [toast, setToast] = useState(null);

  const [selectedBbox, setSelectedBbox] = useState(null);
  const [bboxName, setBboxName] = useState('My Offline Area');

  const [downloading, setDownloading] = useState(false);
  const [downloadPct, setDownloadPct] = useState(0);
const [selectedMaxZoom, setSelectedMaxZoom] = useState(15);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    const [b, s] = await Promise.all([getAllBboxMeta(), estimateStorageUsage()]);
    const list = Object.entries(b || {}).map(([id, meta]) => ({ id, ...meta }));
    setBboxes(list);
    setStorage(s);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (drawingBbox && mapContainerRef.current && !mapInstanceRef.current) {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: lightStyle,
        center: [14.42, 50.08], // Default to Prague or user location if available
        zoom: 10,
        attributionControl: false,
        gl: { antialias: true, failIfMajorPerformanceCaveat: false },
      });
      
      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      const updateBbox = () => {
        const bounds = map.getBounds();
        const wrapLng = (lng) => {
          let w = ((lng + 180) % 360);
          if (w < 0) w += 360;
          return w - 180;
        };
        setSelectedBbox([
          wrapLng(bounds.getWest()),
          bounds.getSouth(),
          wrapLng(bounds.getEast()),
          bounds.getNorth()
        ]);
      };

      map.on('moveend', updateBbox);
      map.once('idle', updateBbox);
      
      mapInstanceRef.current = map;
    }

    return () => {
      if (!drawingBbox && mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [drawingBbox]);

  const handleDownloadBbox = async () => {
    if (!selectedBbox || downloading) return;
    const bboxId = `bbox-${Date.now()}`;
    setDownloading(true);
    setDownloadPct(0);

    try {
      const name = bboxName || 'My Offline Area';
      const [west, south, east, north] = selectedBbox;
      const countryLike = {
        code: bboxId,
        name,
        bbox: [west, south, east, north],
        sizeMB: estimateSizeMB(selectedBbox),
      };
      const totalTiles = countTilesForCountry(countryLike, selectedMaxZoom);

      await downloadCountryVectorTiles({
        country: countryLike,
        maxZoom: selectedMaxZoom,
        onProgress: (p) => {
          const done = p?.done || 0;
          const pct = totalTiles > 0 ? Math.round((done / totalTiles) * 100) : 0;
          setDownloadPct(Math.min(100, pct));
        },
      });
      await setBboxMeta(bboxId, {
        id: bboxId,
        name,
        bbox: selectedBbox,
        downloadedAt: Date.now(),
        sizeMB: estimateSizeMB(selectedBbox),
        hasPOIs: false,
        zoomMax: selectedMaxZoom,
      });

      showToast('Offline area downloaded ✓', 'success');
      setDrawingBbox(false);
      setSelectedBbox(null);
      await loadData();
    } catch (e) {
      showToast(e?.message || 'Failed to download area', 'error');
    } finally {
      setDownloading(false);
      setDownloadPct(0);
    }
  };

  const handleBboxDelete = async (bboxId) => {
    await deleteBboxMeta(bboxId);
    showToast('Offline area deleted', 'info');
    await loadData();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-blue-500" />
          <div>
            <h2 className="font-bold text-base leading-tight">Offline Maps</h2>
            <p className="text-xs text-muted-foreground">Draw area rectangle and download with estimated size</p>
          </div>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-accent/60 flex items-center justify-center">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 mt-3 shrink-0">
        <StorageBar usedMB={storage.usedMB} quotaMB={storage.quotaMB} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 pb-20 space-y-4">
        <div className="space-y-2">
          <button
            onClick={() => setDrawingBbox(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold text-sm"
          >
            <Download className="w-5 h-5" />
            Draw New Offline Area
          </button>
        </div>

        {drawingBbox && (
          <div className="space-y-3 p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">Select Area on Map</h3>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Pan and zoom to select the area you want to download. The visible area will be saved.
            </p>

            <div className="relative h-64 rounded-xl border border-blue-200 overflow-hidden">
              <div ref={mapContainerRef} className="w-full h-full" />
              <div className="absolute inset-0 border-4 border-blue-500/50 pointer-events-none z-10 rounded-xl" />
            </div>

            <input
              value={bboxName}
              onChange={(e) => setBboxName(e.target.value)}
              className="w-full p-2 border rounded-lg text-xs"
              placeholder="Area name"
            />

            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900 dark:text-blue-100">Max zoom level</label>
              <select
                value={selectedMaxZoom}
                onChange={(e) => setSelectedMaxZoom(Number(e.target.value))}
                className="w-full p-2 border rounded-lg text-xs bg-background"
              >
                <option value={12}>12 (Low Detail)</option>
                <option value={13}>13 (Medium Detail)</option>
                <option value={14}>14 (High Detail)</option>
                <option value={15}>15 (Maximum Detail - Recommended)</option>
              </select>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                Zoom level 15 is the highest level supported by Protomaps basemap. Downloads 100% of all vector details. In offline mode, the map will automatically overzoom (scale details) up to zoom 20+ cleanly and sharply.
              </p>
            </div>

            {selectedBbox && (
              <div className="text-xs text-blue-800 dark:text-blue-200">
                BBOX: [{selectedBbox.map((v) => v.toFixed(4)).join(', ')}] · Estimated size: ~{estimateSizeMB(selectedBbox)} MB · Max zoom: {selectedMaxZoom}
              </div>
            )}

            {downloading && (
              <div className="text-xs text-blue-700">Downloading… {downloadPct}%</div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleDownloadBbox}
                disabled={!selectedBbox || downloading}
                className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-medium text-sm disabled:opacity-50"
              >
                Download Area
              </button>
              <button
                onClick={() => {
                  setDrawingBbox(false);
                  setSelectedBbox(null);
                }}
                className="flex-1 bg-gray-200 dark:bg-gray-700 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div>
          <h3 className="font-semibold mb-3">Downloaded Areas ({bboxes.length})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {bboxes.map((bbox) => (
              <BboxRow key={bbox.id} bbox={bbox} onDelete={handleBboxDelete} />
            ))}
            {bboxes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No areas downloaded yet. Draw one above to get started.
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className={`absolute bottom-6 left-4 right-4 px-4 py-3 rounded-xl shadow-xl text-sm font-medium text-white text-center ${toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
