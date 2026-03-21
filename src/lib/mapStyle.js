/**
 * mapStyle.js — MapLibre GL style matching Mapy.cz visual language.
 *
 * Source: OpenFreeMap (free, no key, weekly OSM updates, OpenMapTiles schema)
 * Dark mode: full dark variant with matching colour relationships
 */

const FONTS = {
  regular: ['Noto Sans Regular', 'Open Sans Regular', 'Arial Unicode MS Regular'],
  bold:    ['Noto Sans Bold',    'Open Sans Bold',    'Arial Unicode MS Regular'],
  italic:  ['Noto Sans Italic',  'Open Sans Italic',  'Arial Unicode MS Regular'],
};

// ── Colour palette ────────────────────────────────────────────────────────────
const LIGHT = {
  bg:           '#f4efe6',
  land:         '#f4efe6',
  forest:       '#c8dca8',
  grass:        '#d8edbe',
  scrub:        '#d0ddb0',
  farmland:     '#eee8d5',
  wetland:      '#c0d8c8',
  beach:        '#f5e8c0',
  glacier:      '#e8f4f8',
  park:         '#cce8b0',
  cemetery:     '#d0ddc0',
  residential:  '#ede8df',
  commercial:   '#ede0d8',
  industrial:   '#ddd4cc',
  hospital:     '#f0e0e0',
  school:       '#f0e8d8',
  water:        '#a8c8e0',
  waterway:     '#90b8d0',
  building:     '#d4c4a8',
  buildingLine: '#b8a888',
  // Roads
  motorway:     '#3a8a3a',
  motorwayLine: '#1f6b1f',
  motorwayStripe: '#f5d800',
  trunk:        '#2563eb',
  trunkLine:    '#1a4abf',
  primary:      '#e07b00',
  primaryLine:  '#b85a00',
  secondary:    '#d4a000',
  secondaryLine:'#a87800',
  tertiary:     '#c0b090',
  tertiaryLine: '#a09070',
  road:         '#f8f4ee',
  roadLine:     '#b8b0a0',
  path:         '#c0a878',
  track:        '#c0a060',
  railway:      '#888888',
  railwayBg:    '#f4efe6',
  tram:         '#aa6688',
  boundary:     '#aaaaaa',
  boundaryProv: '#cccccc',
  natPark:      '#88aa44',
  // Labels
  label:        '#2a2520',
  labelMuted:   '#6a6058',
  labelWater:   '#4a6a8a',
  labelRoad:    '#ffffff',
};

const DARK = {
  bg:           '#1a1a2e',
  land:         '#1a1a2e',
  forest:       '#1e3d1a',
  grass:        '#1a2e12',
  scrub:        '#1e2e12',
  farmland:     '#1c1c0e',
  wetland:      '#101e10',
  beach:        '#2a2010',
  glacier:      '#102030',
  park:         '#1a3010',
  cemetery:     '#151e10',
  residential:  '#252525',
  commercial:   '#1e1818',
  industrial:   '#1e1e18',
  hospital:     '#1e1010',
  school:       '#181818',
  water:        '#0d2a3d',
  waterway:     '#0a2030',
  building:     '#2e2418',
  buildingLine: '#1e160e',
  motorway:     '#2a6e2a',
  motorwayLine: '#1a5a1a',
  motorwayStripe: '#f5d800',
  trunk:        '#1a4abf',
  trunkLine:    '#0e3490',
  primary:      '#c06000',
  primaryLine:  '#803000',
  secondary:    '#b08000',
  secondaryLine:'#705000',
  tertiary:     '#4a4030',
  tertiaryLine: '#3a3020',
  road:         '#3a3a3a',
  roadLine:     '#2a2a2a',
  path:         '#6a5a40',
  track:        '#5a4a30',
  railway:      '#505050',
  railwayBg:    '#1a1a2e',
  tram:         '#884466',
  boundary:     '#555555',
  boundaryProv: '#444444',
  natPark:      '#2a4020',
  label:        '#e0d8cc',
  labelMuted:   '#9a9288',
  labelWater:   '#4a7aaa',
  labelRoad:    '#ffffff',
};

function style(dark = false) {
  const c = dark ? DARK : LIGHT;

  // helper: interpolate line width
  const rw = (a, b, d = 1) => ['interpolate', ['linear'], ['zoom'],
    6, a * d, 10, b * d, 14, b * 3 * d, 18, b * 8 * d];

  return {
    version: 8,
    name: dark ? 'SpotFinder Dark' : 'SpotFinder',
    glyphs:  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite:  dark ? 'https://protomaps.github.io/basemaps-assets/sprites/v4/dark' : 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
    sources: {
      v: {
        type: 'vector',
        url:  'https://tiles.openfreemap.org/planet',
        attribution: '© <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
      },
    },
    layers: [
      // ── Background ────────────────────────────────────────────────────────
      { id: 'bg', type: 'background', paint: { 'background-color': c.bg } },

      // ── Landcover ─────────────────────────────────────────────────────────
      lf('lc-farmland',  c.farmland,  'landcover', ['in', 'class', 'farmland', 'crop']),
      lf('lc-grass',     c.grass,     'landcover', ['in', 'class', 'grass', 'meadow']),
      lf('lc-scrub',     c.scrub,     'landcover', ['in', 'class', 'scrub', 'heath']),
      lf('lc-wood',      c.forest,    'landcover', ['in', 'class', 'wood', 'forest']),
      lf('lc-wetland',   c.wetland,   'landcover', ['==', 'class', 'wetland']),
      lf('lc-sand',      c.beach,     'landcover', ['in', 'class', 'sand', 'beach']),
      lf('lc-ice',       c.glacier,   'landcover', ['==', 'class', 'ice']),

      // ── Landuse ───────────────────────────────────────────────────────────
      lf('lu-residential', c.residential, 'landuse', ['in', 'class', 'residential', 'suburb', 'neighbourhood'], 0.6),
      lf('lu-commercial',  c.commercial,  'landuse', ['in', 'class', 'commercial', 'retail'], 0.6),
      lf('lu-industrial',  c.industrial,  'landuse', ['==', 'class', 'industrial'], 0.7),
      lf('lu-cemetery',    c.cemetery,    'landuse', ['==', 'class', 'cemetery']),
      lf('lu-park',        c.park,        'landuse', ['in', 'class', 'park', 'pitch', 'recreation_ground', 'garden']),
      lf('lu-hospital',    c.hospital,    'landuse', ['==', 'class', 'hospital'], 0.7),
      lf('lu-school',      c.school,      'landuse', ['in', 'class', 'school', 'university', 'college'], 0.7),

      // National parks
      { id: 'park-border', type: 'line', source: 'v', 'source-layer': 'park',
        paint: { 'line-color': c.natPark, 'line-width': 1.5, 'line-dasharray': [4, 3] } },

      // ── Water ─────────────────────────────────────────────────────────────
      { id: 'water',  type: 'fill', source: 'v', 'source-layer': 'water',
        paint: { 'fill-color': c.water } },
      { id: 'wway-river', type: 'line', source: 'v', 'source-layer': 'waterway',
        filter: ['in', 'class', 'river', 'canal'],
        paint: { 'line-color': c.waterway, 'line-width': ['interpolate',['linear'],['zoom'], 8,1, 14,3, 18,6] } },
      { id: 'wway-stream', type: 'line', source: 'v', 'source-layer': 'waterway',
        filter: ['in', 'class', 'stream', 'drain', 'ditch'], minzoom: 12,
        paint: { 'line-color': c.waterway, 'line-width': ['interpolate',['linear'],['zoom'], 12,0.5, 18,2] } },

      // ── Buildings ─────────────────────────────────────────────────────────
      { id: 'bldg-fill', type: 'fill', source: 'v', 'source-layer': 'building', minzoom: 13,
        paint: { 'fill-color': c.building,
          'fill-opacity': ['interpolate',['linear'],['zoom'], 13,0, 14,0.8, 16,1] } },
      { id: 'bldg-line', type: 'line', source: 'v', 'source-layer': 'building', minzoom: 14,
        paint: { 'line-color': c.buildingLine, 'line-width': 0.5 } },

      // ── Roads — casings ───────────────────────────────────────────────────
      rc('rc-motorway',  c.motorwayLine, 'motorway',   [2.5, 5]),
      rc('rc-trunk',     c.trunkLine,    'trunk',      [2,   4]),
      rc('rc-primary',   c.primaryLine,  'primary',    [1.5, 3.5]),
      rc('rc-secondary', c.secondaryLine,'secondary',  [1,   3]),
      rc('rc-tertiary',  c.tertiaryLine, 'tertiary',   [1.0, 3.0], 9),
      rc('rc-street',    c.roadLine,     ['in', 'class', 'street', 'street_limited', 'service', 'residential', 'living_street', 'unclassified', 'minor'], [0.5, 2.5], 12),

      // ── Roads — fills ─────────────────────────────────────────────────────
      { id: 'r-track', type: 'line', source: 'v', 'source-layer': 'transportation',
        filter: ['==', 'class', 'track'], minzoom: 12,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': c.track, 'line-width': 1, 'line-dasharray': [4, 2] } },
      { id: 'r-path', type: 'line', source: 'v', 'source-layer': 'transportation',
        filter: ['in', 'class', 'path', 'footway', 'pedestrian', 'cycleway'], minzoom: 13,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': c.path, 'line-width': 0.8, 'line-dasharray': [3, 2] } },
      rl('r-street',    c.road,      ['in', 'class', 'street', 'street_limited', 'service', 'residential', 'living_street', 'unclassified', 'minor'], [0.5, 2.5], 12),
      rl('r-tertiary',  c.tertiary,  'tertiary',  [0.5, 1.5], 10),
      rl('r-secondary', c.secondary, 'secondary', [0.5, 2]),
      rl('r-primary',   c.primary,   'primary',   [1,   2.5]),
      rl('r-trunk',     c.trunk,     'trunk',     [1.5, 3]),
      rl('r-motorway',  c.motorway,  'motorway',  [2,   4]),
      // Motorway centre stripe (Mapy.cz style yellow dashes)
      { id: 'r-motorway-stripe', type: 'line', source: 'v', 'source-layer': 'transportation',
        filter: ['==', 'class', 'motorway'], minzoom: 11,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': c.motorwayStripe,
          'line-width': ['interpolate',['linear'],['zoom'], 11,0.5, 14,1.5, 18,3],
          'line-dasharray': [6, 4] } },

      // ── Railway ───────────────────────────────────────────────────────────
      { id: 'rail-case', type: 'line', source: 'v', 'source-layer': 'transportation',
        filter: ['==', 'class', 'rail'], minzoom: 8,
        paint: { 'line-color': c.railway,
          'line-width': ['interpolate',['linear'],['zoom'], 8,1, 14,4, 18,8] } },
      { id: 'rail-fill', type: 'line', source: 'v', 'source-layer': 'transportation',
        filter: ['==', 'class', 'rail'], minzoom: 8,
        paint: { 'line-color': c.railwayBg,
          'line-width': ['interpolate',['linear'],['zoom'], 8,0.5, 14,2, 18,5],
          'line-dasharray': [6, 3] } },
      { id: 'tram', type: 'line', source: 'v', 'source-layer': 'transportation',
        filter: ['in', 'class', 'transit', 'subway', 'tram'], minzoom: 11,
        paint: { 'line-color': c.tram, 'line-width': 1.5, 'line-dasharray': [4, 2] } },

      // ── Boundaries ────────────────────────────────────────────────────────
      { id: 'bnd-country', type: 'line', source: 'v', 'source-layer': 'boundary',
        filter: ['==', 'admin_level', 2],
        paint: { 'line-color': c.boundary, 'line-width': 1.5, 'line-dasharray': [4, 2, 1, 2] } },
      { id: 'bnd-province', type: 'line', source: 'v', 'source-layer': 'boundary',
        filter: ['==', 'admin_level', 4], minzoom: 6,
        paint: { 'line-color': c.boundaryProv, 'line-width': 0.8, 'line-dasharray': [3, 2] } },

      // ── Road number plates ────────────────────────────────────────────────
      // 3 layers per plate type: background halo → white inner border → white text
      // This gives the rounded rectangle look with inner white line like Czech signs

      // ── MOTORWAY D1/D5 — red plate ───────────────────────────────────────
      { id:'plate-mway-bg', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['==','class','motorway'], minzoom:9,
        layout:{ 'text-field':['get','ref'], 'text-font':FONTS.bold, 'text-size':13,
          'symbol-placement':'line', 'symbol-spacing':350, 'text-max-angle':20,
          'text-padding':5, 'text-allow-overlap':false },
        paint:{ 'text-color':'rgba(0,0,0,0)', 'text-halo-color':'#cc1111', 'text-halo-width':12 } },
      { id:'plate-mway-brd', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['==','class','motorway'], minzoom:9,
        layout:{ 'text-field':['get','ref'], 'text-font':FONTS.bold, 'text-size':13,
          'symbol-placement':'line', 'symbol-spacing':350, 'text-max-angle':20,
          'text-padding':5, 'text-allow-overlap':true },
        paint:{ 'text-color':'rgba(0,0,0,0)', 'text-halo-color':'#ffffff', 'text-halo-width':9 } },
      { id:'plate-mway', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['==','class','motorway'], minzoom:9,
        layout:{ 'text-field':['get','ref'], 'text-font':FONTS.bold, 'text-size':13,
          'symbol-placement':'line', 'symbol-spacing':350, 'text-max-angle':20,
          'text-padding':5, 'text-allow-overlap':true },
        paint:{ 'text-color':'#ffffff', 'text-halo-color':'#cc1111', 'text-halo-width':1 } },

      // ── TRUNK (R26, 48, numbered highways) — blue plate ──────────────────
      { id:'plate-trunk-bg', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['==','class','trunk'], minzoom:10,
        layout:{ 'text-field':['get','ref'], 'text-font':FONTS.bold, 'text-size':13,
          'symbol-placement':'line', 'symbol-spacing':320, 'text-max-angle':20,
          'text-padding':5, 'text-allow-overlap':false },
        paint:{ 'text-color':'rgba(0,0,0,0)', 'text-halo-color':'#003d9e', 'text-halo-width':12 } },
      { id:'plate-trunk-brd', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['==','class','trunk'], minzoom:10,
        layout:{ 'text-field':['get','ref'], 'text-font':FONTS.bold, 'text-size':13,
          'symbol-placement':'line', 'symbol-spacing':320, 'text-max-angle':20,
          'text-padding':5, 'text-allow-overlap':true },
        paint:{ 'text-color':'rgba(0,0,0,0)', 'text-halo-color':'#ffffff', 'text-halo-width':9 } },
      { id:'plate-trunk', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['==','class','trunk'], minzoom:10,
        layout:{ 'text-field':['get','ref'], 'text-font':FONTS.bold, 'text-size':13,
          'symbol-placement':'line', 'symbol-spacing':320, 'text-max-angle':20,
          'text-padding':5, 'text-allow-overlap':true },
        paint:{ 'text-color':'#ffffff', 'text-halo-color':'#003d9e', 'text-halo-width':1 } },

      // ── PRIMARY (27, 9, 605) — blue plate ────────────────────────────────
      { id:'plate-prim-bg', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['==','class','primary'], minzoom:11,
        layout:{ 'text-field':['get','ref'], 'text-font':FONTS.bold, 'text-size':12,
          'symbol-placement':'line', 'symbol-spacing':300, 'text-max-angle':20,
          'text-padding':4, 'text-allow-overlap':false },
        paint:{ 'text-color':'rgba(0,0,0,0)', 'text-halo-color':'#003d9e', 'text-halo-width':11 } },
      { id:'plate-prim-brd', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['==','class','primary'], minzoom:11,
        layout:{ 'text-field':['get','ref'], 'text-font':FONTS.bold, 'text-size':12,
          'symbol-placement':'line', 'symbol-spacing':300, 'text-max-angle':20,
          'text-padding':4, 'text-allow-overlap':true },
        paint:{ 'text-color':'rgba(0,0,0,0)', 'text-halo-color':'#ffffff', 'text-halo-width':8 } },
      { id:'plate-prim', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['==','class','primary'], minzoom:11,
        layout:{ 'text-field':['get','ref'], 'text-font':FONTS.bold, 'text-size':12,
          'symbol-placement':'line', 'symbol-spacing':300, 'text-max-angle':20,
          'text-padding':4, 'text-allow-overlap':true },
        paint:{ 'text-color':'#ffffff', 'text-halo-color':'#003d9e', 'text-halo-width':1 } },

      // ── SECONDARY/TERTIARY (605, 431) — blue plate ────────────────────────
      { id:'plate-sec-bg', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['in','class','secondary','tertiary'], minzoom:13,
        layout:{ 'text-field':['get','ref'], 'text-font':FONTS.bold, 'text-size':11,
          'symbol-placement':'line', 'symbol-spacing':280, 'text-max-angle':20,
          'text-padding':3, 'text-allow-overlap':false },
        paint:{ 'text-color':'rgba(0,0,0,0)', 'text-halo-color':'#003d9e', 'text-halo-width':10 } },
      { id:'plate-sec-brd', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['in','class','secondary','tertiary'], minzoom:13,
        layout:{ 'text-field':['get','ref'], 'text-font':FONTS.bold, 'text-size':11,
          'symbol-placement':'line', 'symbol-spacing':280, 'text-max-angle':20,
          'text-padding':3, 'text-allow-overlap':true },
        paint:{ 'text-color':'rgba(0,0,0,0)', 'text-halo-color':'#ffffff', 'text-halo-width':7 } },
      { id:'plate-sec', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['in','class','secondary','tertiary'], minzoom:13,
        layout:{ 'text-field':['get','ref'], 'text-font':FONTS.bold, 'text-size':11,
          'symbol-placement':'line', 'symbol-spacing':280, 'text-max-angle':20,
          'text-padding':3, 'text-allow-overlap':true },
        paint:{ 'text-color':'#ffffff', 'text-halo-color':'#003d9e', 'text-halo-width':1 } },

      // ── EUROPEAN ROUTES E50/E49 — green plate, shown on all road classes ──
      // E-routes have ref starting with E (e.g. "E50", "E55") — shown as separate
      // overlapping label offset below the national number plate
      { id:'plate-euro-bg', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['in','class','motorway','trunk','primary'], minzoom:11,
        layout:{
          'text-field': ['case',
            ['has','network'], ['get','network'],
            ['literal','']
          ],
          'text-font':FONTS.bold, 'text-size':11,
          'symbol-placement':'line', 'symbol-spacing':500, 'text-max-angle':20,
          'text-padding':4, 'text-allow-overlap':true,
          'text-offset':[0, 2.4],
        },
        paint:{ 'text-color':'rgba(0,0,0,0)', 'text-halo-color':'#2e7d32', 'text-halo-width':11 } },
      { id:'plate-euro-brd', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['in','class','motorway','trunk','primary'], minzoom:11,
        layout:{
          'text-field': ['case',
            ['has','network'], ['get','network'],
            ['literal','']
          ],
          'text-font':FONTS.bold, 'text-size':11,
          'symbol-placement':'line', 'symbol-spacing':500, 'text-max-angle':20,
          'text-padding':4, 'text-allow-overlap':true,
          'text-offset':[0, 2.4],
        },
        paint:{ 'text-color':'rgba(0,0,0,0)', 'text-halo-color':'#ffffff', 'text-halo-width':8 } },
      { id:'plate-euro', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['in','class','motorway','trunk','primary'], minzoom:11,
        layout:{
          'text-field': ['case',
            ['has','network'], ['get','network'],
            ['literal','']
          ],
          'text-font':FONTS.bold, 'text-size':11,
          'symbol-placement':'line', 'symbol-spacing':500, 'text-max-angle':20,
          'text-padding':4, 'text-allow-overlap':true,
          'text-offset':[0, 2.4],
        },
        paint:{ 'text-color':'#ffffff', 'text-halo-color':'#2e7d32', 'text-halo-width':1 } },

      // Road name labels
      { id: 'lbl-primary', type: 'symbol', source: 'v', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'primary', 'trunk'], minzoom: 13,
        layout: { 'text-field': ['get', 'name'], 'text-font': FONTS.regular, 'text-size': 10,
          'symbol-placement': 'line', 'symbol-spacing': 250, 'text-max-angle': 30 },
        paint: { 'text-color': c.label, 'text-halo-color': c.bg, 'text-halo-width': 2 } },
      { id: 'lbl-street', type: 'symbol', source: 'v', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'secondary', 'tertiary', 'street', 'residential'], minzoom: 14,
        layout: { 'text-field': ['get', 'name'],
          'text-font': FONTS.regular, 'text-size': 10,
          'symbol-placement': 'line', 'symbol-spacing': 200, 'text-max-angle': 30 },
        paint: { 'text-color': c.labelMuted, 'text-halo-color': c.bg, 'text-halo-width': 1.5 } },

      // ── Water labels ──────────────────────────────────────────────────────
      { id: 'lbl-water', type: 'symbol', source: 'v', 'source-layer': 'water_name',
        layout: { 'text-field': ['get', 'name'],
          'text-font': FONTS.italic,
          'text-size': ['interpolate',['linear'],['zoom'], 8,10, 14,14] },
        paint: { 'text-color': c.labelWater, 'text-halo-color': c.water, 'text-halo-width': 1 } },

      // ── Place/settlement boundaries ──────────────────────────────────────
      { id: 'place-boundary', type: 'line', source: 'v', 'source-layer': 'boundary',
        filter: ['in', 'admin_level', 8, 9, 10],
        minzoom: 12,
        paint: {
          'line-color': dark ? '#5a3a1a' : '#c4a882',
          'line-width': 0.8,
          'line-dasharray': [3, 2],
          'line-opacity': 0.6,
        } },

      // ── Place labels ──────────────────────────────────────────────────────
      { id: 'lbl-village', type: 'symbol', source: 'v', 'source-layer': 'place',
        filter: ['in', 'class', 'village', 'hamlet', 'suburb', 'neighbourhood', 'quarter'],
        minzoom: 11,
        layout: { 'text-field': ['get', 'name'],
          'text-font': FONTS.regular,
          'text-size': ['interpolate',['linear'],['zoom'], 11,9, 15,12], 'text-max-width': 8 },
        paint: { 'text-color': c.label, 'text-halo-color': c.bg, 'text-halo-width': 1.5 } },
      { id: 'lbl-town', type: 'symbol', source: 'v', 'source-layer': 'place',
        filter: ['==', 'class', 'town'], minzoom: 8,
        layout: { 'text-field': ['get', 'name'],
          'text-font': FONTS.regular,
          'text-size': ['interpolate',['linear'],['zoom'], 8,10, 13,14], 'text-max-width': 8 },
        paint: { 'text-color': c.label, 'text-halo-color': c.bg, 'text-halo-width': 2 } },
      { id: 'lbl-city', type: 'symbol', source: 'v', 'source-layer': 'place',
        filter: ['in', 'class', 'city', 'capital'], minzoom: 5,
        layout: { 'text-field': ['get', 'name'],
          'text-font': FONTS.bold,
          'text-size': ['interpolate',['linear'],['zoom'], 5,10, 8,13, 12,18],
          'text-max-width': 8, 'text-allow-overlap': false },
        paint: { 'text-color': c.label, 'text-halo-color': c.bg, 'text-halo-width': 2 } },
      { id: 'lbl-country', type: 'symbol', source: 'v', 'source-layer': 'place',
        filter: ['==', 'class', 'country'], maxzoom: 8,
        layout: { 'text-field': ['get', 'name'],
          'text-font': FONTS.bold,
          'text-size': ['interpolate',['linear'],['zoom'], 2,8, 6,14],
          'text-transform': 'uppercase', 'text-letter-spacing': 0.1 },
        paint: { 'text-color': c.label, 'text-halo-color': c.bg, 'text-halo-width': 2 } },
    ],
  };
}

// ── Layer builder helpers ─────────────────────────────────────────────────────

/** fill layer */
function lf(id, color, layer, filter, opacity = 1) {
  return { id, type: 'fill', source: 'v', 'source-layer': layer,
    ...(filter ? { filter } : {}),
    paint: { 'fill-color': color, 'fill-opacity': opacity } };
}

/** road casing (outline) */
function rc(id, color, classFilter, [min, mid], minzoom) {
  const filter = typeof classFilter === 'string'
    ? ['==', 'class', classFilter] : classFilter;
  return { id, type: 'line', source: 'v', 'source-layer': 'transportation',
    filter, ...(minzoom ? { minzoom } : {}),
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': color,
      'line-width': ['interpolate',['linear'],['zoom'], 6,min, 10,mid, 14,mid*2.5, 18,mid*6] } };
}

/** road fill */
function rl(id, color, classFilter, [min, mid], minzoom) {
  const filter = typeof classFilter === 'string'
    ? ['==', 'class', classFilter] : classFilter;
  return { id, type: 'line', source: 'v', 'source-layer': 'transportation',
    filter, ...(minzoom ? { minzoom } : {}),
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': color,
      'line-width': ['interpolate',['linear'],['zoom'], 6,min, 10,mid, 14,mid*2, 18,mid*5.5] } };
}

export const lightStyle = style(false);
export const darkStyle  = style(true);
export default lightStyle;