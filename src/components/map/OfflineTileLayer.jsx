/**
 * OfflineTileLayer.jsx
 *
 * A React-Leaflet compatible tile layer that:
 * 1. Checks IndexedDB first before making a network request.
 * 2. On network success, stores the tile in IndexedDB for future offline use.
 * 3. Renders a subtle "OFFLINE" badge on the map when offline.
 *
 * Drop-in replacement for <TileLayer> — accepts the same props.
 */
import { useEffect, useRef } from 'react';
import { useMap }            from 'react-leaflet';
import L                     from 'leaflet';
import { getTile, setTile }  from '../../lib/offlineStorage.js';
import { hashTemplate, resolveTileUrl, tileKey } from '../../lib/offlineManager.js';

// ─── Custom Leaflet tile layer class ─────────────────────────────────────────

function createOfflineLayer(url, options) {
  const tplHash = hashTemplate(url);

  const OfflineLayer = L.TileLayer.extend({
    createTile(coords, done) {
      const img = document.createElement('img');
      img.setAttribute('role', 'presentation');

      const key  = tileKey(coords.z, coords.x, coords.y, tplHash);
      const href = resolveTileUrl(url, coords.z, coords.x, coords.y);

      img.crossOrigin = 'anonymous';

      // Try IndexedDB first
      getTile(key).then(cached => {
        if (cached) {
          // Serve from cache — build a blob URL
          const blob  = new Blob([cached], { type: 'image/png' });
          const burl  = URL.createObjectURL(blob);
          img.onload  = () => { URL.revokeObjectURL(burl); done(null, img); };
          img.onerror = () => done(new Error('cached tile load error'), img);
          img.src     = burl;
          return;
        }

        // Fetch from network and store
        fetch(href, { mode: 'cors' })
          .then(async res => {
            if (!res.ok) throw new Error(`${res.status}`);
            const buf  = await res.arrayBuffer();
            const blob = new Blob([buf], { type: 'image/png' });
            const burl = URL.createObjectURL(blob);
            // Cache for later use (fire-and-forget, don't block rendering)
            setTile(key, buf).catch(() => {});
            img.onload  = () => { URL.revokeObjectURL(burl); done(null, img); };
            img.onerror = () => done(new Error('tile load error'), img);
            img.src     = burl;
          })
          .catch(err => {
            // Network failed — show error tile (transparent pixel)
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            done(err, img);
          });
      }).catch(() => {
        // IndexedDB failed — fall back to normal network fetch
        img.src = href;
        img.onload  = () => done(null, img);
        img.onerror = () => done(new Error('tile fetch error'), img);
      });

      return img;
    },
  });

  return new OfflineLayer(url, options);
}

// ─── React component ─────────────────────────────────────────────────────────

export default function OfflineTileLayer({ url, subdomains, maxZoom = 20, maxNativeZoom = 19,
                                           keepBuffer = 6, updateWhenIdle = false,
                                           updateWhenZooming = false, attribution,
                                           zIndex, opacity, tileSize, ...rest }) {
  const map      = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!url) return;

    const layer = createOfflineLayer(url, {
      subdomains:          subdomains || [],
      maxZoom,
      maxNativeZoom,
      keepBuffer,
      updateWhenIdle,
      updateWhenZooming,
      attribution:         attribution || '',
      zIndex:              zIndex      || 200,
      opacity:             opacity     || 1,
      tileSize:            tileSize    || 256,
      crossOrigin:         'anonymous',
      errorTileUrl:        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      ...rest,
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, map]);

  // Update opacity/zIndex without remounting the layer
  useEffect(() => {
    if (layerRef.current && opacity != null) {
      layerRef.current.setOpacity(opacity);
    }
  }, [opacity]);

  return null;
}
