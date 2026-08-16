/**
 * offlineRouter.js
 *
 * Pure client-side offline turn-by-turn routing.
 *
 * How it works:
 * 1. buildRoutingGraph() reads the vector tiles already cached in IndexedDB
 *    (downloaded by vectorTileDownloader.js) at the country's stored zoom
 *    level, parses the `transportation` layer of each tile (MVT, OpenMapTiles
 *    schema — same schema the map style uses), and builds a road graph.
 * 2. The graph (nodes + adjacency list + a coarse spatial index) is cached in
 *    IndexedDB under the `graphs` store so it only has to be built once per
 *    downloaded region.
 * 3. findRoute() snaps the origin/destination to the nearest graph nodes and
 *    runs A* to compute a route, distance, duration, and basic turn-by-turn
 *    steps — entirely offline, no native plugin, no server.
 *
 * This does NOT require Capacitor / the native SpotfinderNav or OSRM plugins.
 */

import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { getTile, getGraph, setGraph, getMeta } from './offlineStorage.js';
import { getCachedTile } from './highZoomCache.js';
import { COUNTRIES, lngToX, latToY, vtKey } from './vectorTileDownloader.js';
import { bearingDiff, modifierFromAngle, buildInstruction } from '../api/osrmServiceClient.js';

// ─── Road class rules ─────────────────────────────────────────────────────────
// OpenMapTiles `transportation` layer `class` values.
const SPEED_KMH = {
  motorway: 110, trunk: 90, primary: 70, secondary: 60, tertiary: 50,
  minor: 40, service: 20, living_street: 15, track: 20,
  path: 5, footway: 5, steps: 3, pedestrian: 5, cycleway: 15, unclassified: 40,
  bridleway: 8, ferry: 25,
};

const PROFILE_CLASSES = {
  driving: new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'living_street', 'unclassified']),
  cycling: new Set(['primary', 'secondary', 'tertiary', 'minor', 'service', 'living_street', 'unclassified', 'cycleway', 'path', 'track']),
  foot:    new Set(['primary', 'secondary', 'tertiary', 'minor', 'service', 'living_street', 'unclassified', 'path', 'footway', 'pedestrian', 'steps', 'track']),
};

const GRID_STEP = 0.01; // ~1.1km buckets for nearest-node lookup

// ─── Geo helpers ──────────────────────────────────────────────────────────────

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearing(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Convert a fractional tile-space x/y (in tile units, not pixels) to lon/lat */
function xyToLonLat(x, y, z) {
  const n = Math.pow(2, z);
  const lon = (x / n) * 360 - 180;
  const rad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (rad * 180) / Math.PI;
  return [lat, lon];
}

function gridKey(lat, lon) {
  return `${Math.round(lat / GRID_STEP)}:${Math.round(lon / GRID_STEP)}`;
}

// ─── Graph builder ────────────────────────────────────────────────────────────

function tilesForBBoxAtZoom(bbox, z) {
  const [west, south, east, north] = bbox;
  const x0 = lngToX(west, z), x1 = lngToX(east, z);
  const y0 = latToY(north, z), y1 = latToY(south, z);
  const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
  const maxTile = Math.pow(2, z) - 1;
  const tiles = [];
  if (x0 <= x1) {
    for (let x = x0; x <= x1; x++) for (let y = minY; y <= maxY; y++) tiles.push({ x, y });
  } else {
    for (let x = x0; x <= maxTile; x++) for (let y = minY; y <= maxY; y++) tiles.push({ x, y });
    for (let x = 0; x <= x1; x++) for (let y = minY; y <= maxY; y++) tiles.push({ x, y });
  }
  return tiles;
}

/**
 * Build (or rebuild) the offline routing graph for a country from whatever
 * vector tiles are already cached locally. Safe to call repeatedly — results
 * are cached; pass force=true to rebuild.
 */
export async function buildRoutingGraph(country, profile = 'driving', { force = false, onProgress } = {}) {
  const regionKey = `${country.code}:${profile}`;

  // Prefer an explicitly downloaded region (has known zoom). Otherwise fall back
  // to whatever base-map tiles were auto-cached while browsing online — routing
  // then works in areas the user has viewed even without a full region download.
  const meta = await getMeta(country.code);
  const hasDownload = !!(meta && meta.type === 'vector');

  // Only reuse a persisted graph for fully downloaded regions. Graphs assembled
  // from the browse cache are partial, so they are rebuilt on demand instead.
  if (!force && hasDownload) {
    const existing = await getGraph(regionKey).catch(() => null);
    if (existing) return existing;
  }

  const zoom = (hasDownload && Number(meta.maxZoom)) || 14;
  const allowed = PROFILE_CLASSES[profile] || PROFILE_CLASSES.driving;
  const tiles = tilesForBBoxAtZoom(country.bbox, zoom);

  const nodeIndex = new Map();  // coordKey -> node index
  const nodes = [];             // [lat, lon]
  const adj = [];               // adj[i] = [[toIndex, weightSeconds, distanceMeters], ...]

  function getNode(lat, lon) {
    const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
    let idx = nodeIndex.get(key);
    if (idx === undefined) {
      idx = nodes.length;
      nodeIndex.set(key, idx);
      nodes.push([lat, lon]);
      adj.push([]);
    }
    return idx;
  }

  function addEdge(a, b, distanceMeters, speedKmh, bidirectional) {
    const weightSeconds = distanceMeters / ((speedKmh * 1000) / 3600);
    adj[a].push([b, weightSeconds, distanceMeters]);
    if (bidirectional) adj[b].push([a, weightSeconds, distanceMeters]);
  }

  let done = 0;
  for (const { x, y } of tiles) {
    done++;
    if (onProgress && done % 25 === 0) onProgress({ done, total: tiles.length });

    let buf;
    try { buf = (await getTile(vtKey(zoom, x, y))) || (await getCachedTile(zoom, x, y)); } catch (_) { buf = null; }
    if (!buf) continue;

    let tile;
    try {
      tile = new VectorTile(new Pbf(buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf));
    } catch (_) { continue; }

    const layer = tile.layers?.transportation;
    if (!layer) continue;

    for (let i = 0; i < layer.length; i++) {
      const feat = layer.feature(i);
      if (feat.type !== 2) continue; // LineString only

      const cls = feat.properties?.class;
      if (!allowed.has(cls)) continue;

      const speed = SPEED_KMH[cls] || 30;
      const oneway = Number(feat.properties?.oneway) || 0;
      const name = feat.properties?.name || feat.properties?.name_en || '';
      const ref = feat.properties?.ref || '';
      const extent = feat.extent || 4096;

      const rings = feat.loadGeometry();
      for (const ring of rings) {
        let prevIdx = null;
        for (const pt of ring) {
          const xf = x + pt.x / extent;
          const yf = y + pt.y / extent;
          const [lat, lon] = xyToLonLat(xf, yf, zoom);
          const idx = getNode(lat, lon);
          if (prevIdx !== null && prevIdx !== idx) {
            const [plat, plon] = nodes[prevIdx];
            const dist = haversine(plat, plon, lat, lon);
            if (profile === 'driving' && oneway === 1) {
              addEdge(prevIdx, idx, dist, speed, false);
            } else if (profile === 'driving' && oneway === -1) {
              addEdge(idx, prevIdx, dist, speed, false);
            } else {
              addEdge(prevIdx, idx, dist, speed, true);
            }
            // stash road label on both directed edges we just pushed
            const lastA = adj[prevIdx][adj[prevIdx].length - 1];
            if (lastA) { lastA[3] = name; lastA[4] = ref; lastA[5] = cls; }
            const lastB = adj[idx][adj[idx].length - 1];
            if (lastB && lastB[0] === prevIdx) { lastB[3] = name; lastB[4] = ref; lastB[5] = cls; }
          }
          prevIdx = idx;
        }
      }
    }
  }

  // Spatial index for nearest-node snapping
  const grid = {};
  for (let i = 0; i < nodes.length; i++) {
    const key = gridKey(nodes[i][0], nodes[i][1]);
    (grid[key] || (grid[key] = [])).push(i);
  }

  const graph = {
    profile, zoom, nodes, adj, grid,
    countryCode: country.code,
    builtAt: Date.now(),
    nodeCount: nodes.length,
  };

  if (hasDownload) await setGraph(regionKey, graph).catch(() => {});
  return graph;
}

/** Find the country entry whose bbox contains a lat/lng (or null) */
export function findCountryAt(lat, lng) {
  for (const c of COUNTRIES) {
    const [w, s, e, n] = c.bbox;
    if (lat >= s && lat <= n && lng >= w && lng <= e) return c;
  }
  return null;
}

/** Get a cached graph, building it on demand if needed. */
export async function ensureGraph(lat, lng, profile = 'driving') {
  const country = findCountryAt(lat, lng);
  if (!country) return null;
  try {
    return await buildRoutingGraph(country, profile);
  } catch (_) {
    return null;
  }
}

// ─── Nearest-node snapping ────────────────────────────────────────────────────

function nearestNode(graph, lat, lon) {
  let best = null, bestDist = Infinity;
  for (let ring = 0; ring <= 6; ring++) {
    const cLat = Math.round(lat / GRID_STEP), cLon = Math.round(lon / GRID_STEP);
    for (let dLat = -ring; dLat <= ring; dLat++) {
      for (let dLon = -ring; dLon <= ring; dLon++) {
        if (Math.max(Math.abs(dLat), Math.abs(dLon)) !== ring) continue;
        const bucket = graph.grid[`${cLat + dLat}:${cLon + dLon}`];
        if (!bucket) continue;
        for (const idx of bucket) {
          const [nLat, nLon] = graph.nodes[idx];
          const d = haversine(lat, lon, nLat, nLon);
          if (d < bestDist) { bestDist = d; best = idx; }
        }
      }
    }
    if (best !== null && ring >= 1) break; // one extra ring past first hit for accuracy
  }
  return best;
}

// ─── A* pathfinding ────────────────────────────────────────────────────────────

class MinHeap {
  constructor() { this.a = []; }
  size() { return this.a.length; }
  push(item) {
    const a = this.a; a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

function astar(graph, startIdx, goalIdx) {
  const { nodes, adj } = graph;
  const [glat, glon] = nodes[goalIdx];
  const maxSpeedMs = 110 * 1000 / 3600;

  const gScore = new Map([[startIdx, 0]]);
  const cameFrom = new Map();
  const heap = new MinHeap();
  heap.push([haversine(nodes[startIdx][0], nodes[startIdx][1], glat, glon) / maxSpeedMs, startIdx]);
  const visited = new Set();

  while (heap.size()) {
    const [, current] = heap.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === goalIdx) break;

    for (const edge of adj[current]) {
      const [to, w] = edge;
      if (visited.has(to)) continue;
      const tentative = gScore.get(current) + w;
      if (tentative < (gScore.get(to) ?? Infinity)) {
        gScore.set(to, tentative);
        cameFrom.set(to, [current, edge]);
        const [nlat, nlon] = nodes[to];
        const h = haversine(nlat, nlon, glat, glon) / maxSpeedMs;
        heap.push([tentative + h, to]);
      }
    }
  }

  if (!visited.has(goalIdx)) return null;

  const pathEdges = []; // [nodeIdx, edgeFromPrev]
  let cur = goalIdx;
  pathEdges.push([cur, null]);
  while (cameFrom.has(cur)) {
    const [prev, edge] = cameFrom.get(cur);
    pathEdges.push([prev, edge]);
    cur = prev;
  }
  pathEdges.reverse();
  return pathEdges;
}

// ─── Step / instruction building ──────────────────────────────────────────────

function buildSteps(pathEdges, nodes) {
  if (pathEdges.length < 2) return [];

  // Collapse into legs of constant road name/ref, tracking bearing at each vertex
  const points = pathEdges.map(([idx]) => nodes[idx]);
  const edges = pathEdges.slice(1).map(([, e]) => e); // edge INTO node i (i>=1)

  const steps = [];
  let legStartIdx = 0;

  function pushStep(type, atIdx, modifier, distance) {
    const [lat, lng] = points[atIdx];
    const edge = edges[Math.max(0, atIdx - 1)] || edges[0] || [];
    const name = edge[3] || '';
    const ref = edge[4] || '';
    steps.push({
      maneuverType: type,
      modifier,
      distance,
      lat, lng,
      name, ref,
      destinations: '', exits: '', exit: null, intersections: undefined,
      instruction: buildInstruction({ maneuverType: type, modifier, distance, lat, lng, name, ref, destinations: '', exits: '', exit: null }),
    });
  }

  pushStep('depart', 0, 'straight', 0);

  for (let i = 1; i < points.length - 1; i++) {
    const prevEdge = edges[i - 1];
    const nextEdge = edges[i];
    if (!prevEdge || !nextEdge) continue;

    const [alat, alon] = points[i - 1];
    const [blat, blon] = points[i];
    const [clat, clon] = points[i + 1];
    const bBefore = bearing(alat, alon, blat, blon);
    const bAfter = bearing(blat, blon, clat, clon);
    const diff = bearingDiff(bBefore, bAfter);
    const nameChanged = (prevEdge[3] || '') !== (nextEdge[3] || '') && (nextEdge[3] || '');

    if (Math.abs(diff) >= 20 || nameChanged) {
      const legDist = distanceAlong(points, legStartIdx, i);
      const modifier = Math.abs(diff) >= 20 ? modifierFromAngle(diff) : 'straight';
      const type = Math.abs(diff) >= 20 ? 'turn' : 'continue';
      pushStep(type, i, modifier, legDist);
      legStartIdx = i;
    }
  }

  const lastDist = distanceAlong(points, legStartIdx, points.length - 1);
  pushStep('arrive', points.length - 1, 'straight', lastDist);

  return steps;
}

function distanceAlong(points, from, to) {
  let d = 0;
  for (let i = from; i < to; i++) {
    d += haversine(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
  }
  return d;
}

// ─── Public: compute a route entirely offline ─────────────────────────────────

/**
 * @param {{lat:number,lng:number}} from
 * @param {{lat:number,lng:number}} to
 * @param {string} profile - 'driving' | 'cycling' | 'foot'
 * @returns {Promise<{geometry:number[][], distance:number, duration:number, steps:object[]}|null>}
 */
export async function computeOfflineRoute(from, to, profile = 'driving') {
  const country = findCountryAt(from.lat, from.lng);
  if (!country || !findCountryAt(to.lat, to.lng)) return null; // needs same downloaded region on both ends (v1 limitation)

  const graph = await buildRoutingGraph(country, profile).catch(() => null);
  if (!graph || !graph.nodeCount) return null;

  const startIdx = nearestNode(graph, from.lat, from.lng);
  const goalIdx = nearestNode(graph, to.lat, to.lng);
  if (startIdx === null || goalIdx === null) return null;

  const pathEdges = astar(graph, startIdx, goalIdx);
  if (!pathEdges) return null;

  const geometry = pathEdges.map(([idx]) => graph.nodes[idx]);
  let distance = 0, duration = 0;
  for (let i = 1; i < pathEdges.length; i++) {
    const edge = pathEdges[i][1];
    if (edge) { duration += edge[1]; distance += edge[2]; }
  }

  const steps = buildSteps(pathEdges, graph.nodes);

  return { geometry, distance, duration, steps, _offline: true };
}
