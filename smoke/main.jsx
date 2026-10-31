import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createPublicSpotSnapshotReader } from '../src/new/publicSpotSnapshotClient.js';
import './style.css';

// Synthetic-only feed. This isolated page imports no Firebase module or app route.
const read = createPublicSpotSnapshotReader({ revocationSource: async () => ({
  current: async () => new Set(), isRevoked: () => false,
}) });
const empty = { type: 'FeatureCollection', features: [] };
function App() {
  const holder = useRef(null);
  const [state, setState] = useState('Loading map…');
  const [stats, setStats] = useState('');
  useEffect(() => {
    const map = new maplibregl.Map({ container: holder.current, center: [14.45, 50.08], zoom: 10,
      style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8f2f5' } }] } });
    window.__smokeMap = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    let sequence = 0;
    const refresh = async () => {
      const current = ++sequence;
      const bounds = map.getBounds();
      const view = { south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() };
      setState('Loading spots…');
      const start = performance.now();
      try {
        const spots = await read(view, 500);
        if (current !== sequence) return;
        map.getSource('spots').setData({ type: 'FeatureCollection', features: spots.map(spot => ({
          type: 'Feature', geometry: { type: 'Point', coordinates: [spot.lng, spot.lat] },
          properties: { id: spot.id, title: spot.resolved_title },
        })) });
        setState(`${spots.length} visible spots`);
        setStats(`${Math.round(performance.now() - start)} ms · inspect Network for headers and transfer`);
      } catch (error) {
        if (current !== sequence) return;
        map.getSource('spots').setData(empty);
        setState(`Error: ${error.message}`);
      }
    };
    map.on('load', () => {
      map.addSource('spots', { type: 'geojson', data: empty, cluster: true, clusterRadius: 45 });
      map.addLayer({ id: 'clusters', type: 'circle', source: 'spots', filter: ['has', 'point_count'],
        paint: { 'circle-color': '#176b83', 'circle-radius': 20 } });
      map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'spots', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12 },
        paint: { 'text-color': '#ffffff' } });
      map.addLayer({ id: 'markers', type: 'circle', source: 'spots', filter: ['!', ['has', 'point_count']],
        paint: { 'circle-color': '#e15f38', 'circle-radius': 7, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
      map.on('click', 'clusters', event => {
        const feature = map.queryRenderedFeatures(event.point, { layers: ['clusters'] })[0];
        map.getSource('spots').getClusterExpansionZoom(feature.properties.cluster_id).then(zoom =>
          map.easeTo({ center: feature.geometry.coordinates, zoom }));
      });
      map.on('click', 'markers', event => {
        const feature = event.features[0];
        new maplibregl.Popup().setLngLat(feature.geometry.coordinates)
          .setText(`${feature.properties.title} (${feature.properties.id})`).addTo(map);
      });
      map.on('moveend', refresh);
      refresh();
    });
    return () => { sequence += 1; delete window.__smokeMap; map.remove(); };
  }, []);
  return <><header><strong>SpotFinder synthetic CDN smoke</strong><span role="status">{state}</span><small>{stats}</small></header><div id="map" ref={holder} /></>;
}
createRoot(document.getElementById('root')).render(<App />);
