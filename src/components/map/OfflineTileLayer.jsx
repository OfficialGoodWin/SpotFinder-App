/**
 * OfflineTileLayer.jsx
 * 
 * Custom Leaflet tile layer that:
 * - Checks IndexedDB first for every tile request
 * - Serves from cache instantly if found (offline or online)
 * - Falls back to network fetch if not cached
 * - Shows "Offline" badge when all tiles are coming from cache
 */
import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getTile } from '../../lib/offlineStorage.js';
import { hashUrl, tileKey, resolveTileUrl } from '../../lib/offlineManager.js';

export default function OfflineTileLayer({
  url, subdomains, maxZoom = 20, maxNativeZoom = 19,
  keepBuffer = 6, updateWhenIdle = false, updateWhenZooming = false,
  attribution = '', zIndex, opacity = 1, isDark,
}) {
  const map        = useMap();
  const layerRef   = useRef(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline  = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!url || !map) return;

    const urlHash = hashUrl(url);

    // Extend L.TileLayer with IndexedDB lookup
    const OfflineLayer = L.TileLayer.extend({
      createTile(coords, done) {
        const img = document.createElement('img');
        img.setAttribute('role', 'presentation');
        img.crossOrigin = 'anonymous';

        const key      = tileKey(coords.z, coords.x, coords.y, urlHash);
        const tileUrl  = resolveTileUrl(url, coords.z, coords.x, coords.y);
        const errorUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

        getTile(key)
          .then(cached => {
            if (cached) {
              // Serve from IndexedDB — instant, no network
              const blob = new Blob([cached], { type: 'image/png' });
              const burl = URL.createObjectURL(blob);
              img.onload  = () => { URL.revokeObjectURL(burl); done(null, img); };
              img.onerror = () => { URL.revokeObjectURL(burl); done(new Error('cached tile error'), img); };
              img.src = burl;
            } else if (navigator.onLine) {
              // Fetch from network
              img.onload  = () => done(null, img);
              img.onerror = () => { img.src = errorUrl; done(new Error('tile fetch error'), img); };
              img.src = tileUrl;
            } else {
              // Offline and not cached — show empty tile
              img.src = errorUrl;
              done(null, img);
            }
          })
          .catch(() => {
            // IndexedDB error — fall back to network
            img.onload  = () => done(null, img);
            img.onerror = () => { img.src = errorUrl; done(new Error('tile error'), img); };
            img.src = tileUrl;
          });

        return img;
      },
    });

    // Remove previous layer
    if (layerRef.current) {
      try { map.removeLayer(layerRef.current); } catch (_) {}
    }

    const layer = new OfflineLayer(url, {
      subdomains:        subdomains || [],
      maxZoom,
      maxNativeZoom,
      keepBuffer,
      updateWhenIdle,
      updateWhenZooming,
      attribution,
      zIndex:            zIndex  || 200,
      opacity,
      tileSize:          256,
      crossOrigin:       'anonymous',
      errorTileUrl:      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        try { map.removeLayer(layerRef.current); } catch (_) {}
        layerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, map]);

  return isOffline ? (
    <div
      style={{ position: 'absolute', top: 8, right: 8, zIndex: 1500, pointerEvents: 'none' }}
    >
      <span style={{
        fontSize: 11, padding: '3px 8px', borderRadius: 12,
        background: '#2563eb', color: '#fff', fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)', opacity: 0.9,
      }}>
        📴 Offline
      </span>
    </div>
  ) : null;
}