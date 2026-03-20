/**
 * OfflineTileLayer.jsx
 * 
 * Hybrid tile layer:
 * - ONLINE:  fetches raster tiles from Mapy.cz (same as before)
 * - OFFLINE: reads from a downloaded .pmtiles file in OPFS via protomaps-leaflet
 * 
 * Switches automatically based on navigator.onLine and whether a country
 * file exists in OPFS for the current map viewport.
 * 
 * Usage: drop-in replacement for the existing <TileLayer> in Home.jsx.
 */
import { useEffect, useRef, useState } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import { getCountryFile, COUNTRIES, isPointInCountry } from '../../lib/offlineManager.js';
import { getAllMeta } from '../../lib/offlineStorage.js';

const MAPY_KEY = import.meta.env.VITE_MAPY_API_KEY || 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';

// ─── Protomaps Leaflet lazy loader ────────────────────────────────────────────
// We lazy-import protomaps-leaflet so it doesn't bloat the initial bundle.
let _pmLayer = null;
async function createProtomapsLayer(file, isDark) {
  const { leafletLayer } = await import('protomaps-leaflet');
  // Build a blob URL from the OPFS File object so protomaps-leaflet can read it
  const url = URL.createObjectURL(file);
  return {
    layer: leafletLayer({ url, dark: isDark }),
    blobUrl: url,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function OfflineTileLayer({ url, subdomains, maxZoom, maxNativeZoom,
                                           keepBuffer, updateWhenIdle, updateWhenZooming,
                                           attribution, isDark }) {
  const map     = useMap();
  const layerRef   = useRef(null);
  const blobUrlRef = useRef(null);
  const [offlineActive, setOfflineActive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function syncLayer() {
      const center    = map.getCenter();
      const metaMap   = await getAllMeta();
      const isOnline  = navigator.onLine;

      // Find if the current viewport has a downloaded country file
      let pmFile = null;
      for (const code of Object.keys(metaMap)) {
        const country = COUNTRIES.find(c => c.code === code);
        if (country && isPointInCountry(center.lat, center.lng, country)) {
          pmFile = await getCountryFile(code);
          if (pmFile) break;
        }
      }

      if (cancelled) return;

      const wantOffline = !isOnline && !!pmFile;
      const wantProtomaps = !!pmFile; // prefer local file even when online if available

      // Remove existing layer
      if (layerRef.current) {
        try { map.removeLayer(layerRef.current); } catch (_) {}
        layerRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      if (wantProtomaps && pmFile) {
        // Use local PMTiles file
        try {
          const { layer, blobUrl } = await createProtomapsLayer(pmFile, isDark);
          if (cancelled) { URL.revokeObjectURL(blobUrl); return; }
          layer.addTo(map);
          layerRef.current = layer;
          blobUrlRef.current = blobUrl;
          setOfflineActive(true);
        } catch (e) {
          console.warn('OfflineTileLayer: protomaps-leaflet failed, falling back to raster', e);
          addRasterLayer();
          setOfflineActive(false);
        }
      } else {
        addRasterLayer();
        setOfflineActive(false);
      }
    }

    function addRasterLayer() {
      const L = require('leaflet');
      const layer = L.tileLayer(url, {
        subdomains:       subdomains || [],
        maxZoom:          maxZoom    || 20,
        maxNativeZoom:    maxNativeZoom || 19,
        keepBuffer:       keepBuffer || 6,
        updateWhenIdle:   updateWhenIdle  ?? false,
        updateWhenZooming:updateWhenZooming ?? false,
        attribution:      attribution || '',
        crossOrigin:      'anonymous',
        errorTileUrl:     'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      });
      layer.addTo(map);
      layerRef.current = layer;
    }

    syncLayer();

    const onOnline  = () => syncLayer();
    const onOffline = () => syncLayer();
    const onMove    = () => {
      // Re-check when map moves significantly (country boundary crossing)
      syncLayer();
    };

    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    map.on('moveend', onMove);

    return () => {
      cancelled = true;
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
      map.off('moveend', onMove);
      if (layerRef.current) {
        try { map.removeLayer(layerRef.current); } catch (_) {}
      }
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, isDark]);

  return (
    <>
      {offlineActive && (
        <div className="absolute top-2 right-2 z-[1500] pointer-events-none">
          <span className="text-xs px-2 py-1 rounded-full bg-blue-600 text-white font-medium shadow-lg opacity-80">
            📴 Offline Map
          </span>
        </div>
      )}
    </>
  );
}