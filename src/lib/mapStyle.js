/**
 * mapStyle.js — MapLibre GL style matching Mapy.cz visual language.
 *
 * Source: OpenFreeMap (free, no key, weekly OSM updates, OpenMapTiles schema)
 * Dark mode: full dark variant with matching colour relationships
 */

const FONTS = {
  regular: ['Noto Sans Regular'],
  bold:    ['Noto Sans Bold'],
  italic:  ['Noto Sans Italic'],
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
  residential:  '#ddd0b8',
  commercial:   '#ede0d8',
  industrial:   '#ddd4cc',
  hospital:     '#f0e0e0',
  school:       '#f0e8d8',
  water:        '#a8c8e0',
  waterway:     '#90b8d0',
  building:     '#d4c4a8',
  buildingLine: '#b8a888',
  // Roads
  motorway:     '#609e3f',
  motorwayLine: '#3d7a20',
  motorwayStripe: '#f5d800',
  trunk:        '#3a81fc',
  trunkLine:    '#1a5ad0',
  primary:      '#e07b00',
  primaryLine:  '#b85a00',
  secondary:    '#d4a000',
  secondaryLine:'#a87800',
  tertiary:     '#c0b090',
  tertiaryLine: '#a09070',
  road:         '#f8f4ee',
  roadLine:     '#b8b0a0',
  path:         '#d8d0c4',
  track:        '#e8e0d4',
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
  motorway:     '#3d7020',
  motorwayLine: '#2a5010',
  motorwayStripe: '#f5d800',
  trunk:        '#1a5ad0',
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
    glyphs:  'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
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
      lf('lu-wood',      c.forest,    'landuse',   ['in', 'class', 'forest', 'wood']),
      lf('lc-wetland',   c.wetland,   'landcover', ['==', 'class', 'wetland']),
      lf('lc-sand',      c.beach,     'landcover', ['in', 'class', 'sand', 'beach']),
      lf('lc-ice',       c.glacier,   'landcover', ['==', 'class', 'ice']),

      // ── Landuse ───────────────────────────────────────────────────────────
      lf('lu-residential', c.residential, 'landuse', ['in', 'class', 'residential', 'suburb', 'neighbourhood'], 0.7),
      lf('lu-commercial',  c.commercial,  'landuse', ['in', 'class', 'commercial', 'retail'], 0.6),
      lf('lu-industrial',  c.industrial,  'landuse', ['==', 'class', 'industrial'], 0.7),
      lf('lu-cemetery',    c.cemetery,    'landuse', ['==', 'class', 'cemetery']),
      lf('lu-park',        c.park,        'landuse', ['in', 'class', 'park', 'pitch', 'recreation_ground', 'garden']),
      lf('lu-hospital',    c.hospital,    'landuse', ['==', 'class', 'hospital'], 0.7),
      lf('lu-school',      c.school,      'landuse', ['in', 'class', 'school', 'university', 'college'], 0.7),

      // National parks — subtle dashed border, only visible close up
      { id: 'park-border', type: 'line', source: 'v', 'source-layer': 'park',
        minzoom: 9,
        paint: { 'line-color': dark ? '#2a4820' : '#8aaa60', 'line-width': 0.8, 'line-opacity': 0.5, 'line-dasharray': [6, 4] } },

      // ── Water ─────────────────────────────────────────────────────────────
      { id: 'water',  type: 'fill', source: 'v', 'source-layer': 'water',
        paint: { 'fill-color': c.water } },
      { id: 'wway-river', type: 'line', source: 'v', 'source-layer': 'waterway',
        filter: ['in', 'class', 'river', 'canal'],
        paint: { 'line-color': c.waterway, 'line-width': ['interpolate',['linear'],['zoom'], 8,1, 14,3, 18,6] } },
      { id: 'wway-stream', type: 'line', source: 'v', 'source-layer': 'waterway',
        filter: ['in', 'class', 'stream', 'drain', 'ditch'], minzoom: 12,
        paint: { 'line-color': c.waterway, 'line-width': ['interpolate',['linear'],['zoom'], 12,0.5, 18,2] } },

      // ── Tunnels (brunnel=tunnel) — transparent dashed, no solid fill ──────────
      // Casing (gray sides)
      { id:'tunnel-motorway-case', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['==','class','motorway'],['==','brunnel','tunnel']],
        layout:{'line-join':'round','line-cap':'butt'},
        paint:{'line-color':'#888','line-opacity':0.4,
          'line-width':['interpolate',['linear'],['zoom'],6,3,10,5.5,14,10,18,19]} },
      { id:'tunnel-trunk-case', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['==','class','trunk'],['==','brunnel','tunnel']],
        layout:{'line-join':'round','line-cap':'butt'},
        paint:{'line-color':'#888','line-opacity':0.4,
          'line-width':['interpolate',['linear'],['zoom'],6,2.5,10,4.5,14,9,18,17]} },
      { id:'tunnel-primary-case', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['==','class','primary'],['==','brunnel','tunnel']],
        layout:{'line-join':'round','line-cap':'butt'},
        paint:{'line-color':'#888','line-opacity':0.4,
          'line-width':['interpolate',['linear'],['zoom'],8,2,12,4,16,9]} },
      { id:'tunnel-other-case', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['in','class','secondary','tertiary','street','residential'],['==','brunnel','tunnel']],
        layout:{'line-join':'round','line-cap':'butt'},
        paint:{'line-color':'#888','line-opacity':0.35,
          'line-width':['interpolate',['linear'],['zoom'],10,1.5,14,4,18,9]} },
      // Tunnel fill — road color at 0.5 opacity
      { id:'tunnel-motorway', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['==','class','motorway'],['==','brunnel','tunnel']],
        layout:{'line-join':'round','line-cap':'butt'},
        paint:{'line-color':c.motorway,'line-opacity':0.3,
          'line-width':['interpolate',['linear'],['zoom'],6,2,10,4,14,8,18,17]} },
      { id:'tunnel-trunk', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['==','class','trunk'],['==','brunnel','tunnel']],
        layout:{'line-join':'round','line-cap':'butt'},
        paint:{'line-color':c.trunk,'line-opacity':0.3,
          'line-width':['interpolate',['linear'],['zoom'],6,1.5,10,3,14,7,18,15]} },
      { id:'tunnel-primary', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['==','class','primary'],['==','brunnel','tunnel']],
        layout:{'line-join':'round','line-cap':'butt'},
        paint:{'line-color':c.primary,'line-opacity':0.3,
          'line-width':['interpolate',['linear'],['zoom'],8,1,12,2.5,16,7]} },
      { id:'tunnel-other', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['in','class','secondary','tertiary','street','residential'],['==','brunnel','tunnel']],
        layout:{'line-join':'round','line-cap':'butt'},
        paint:{'line-color':c.road,'line-opacity':0.3,
          'line-width':['interpolate',['linear'],['zoom'],10,1,14,3,18,7]} },

      // ── Roads — casings ───────────────────────────────────────────────────
      rc('rc-motorway',  c.motorwayLine, 'motorway',   [2.5, 5]),
      rc('rc-trunk',     c.trunkLine,    'trunk',      [2,   4]),
      rc('rc-primary',   c.primaryLine,  'primary',    [1.5, 3.5]),
      rc('rc-secondary', c.secondaryLine,'secondary',  [1,   3]),
      // Override casing for local secondary roads
      { id:'rc-secondary-local', type:'line', source:'v', 'source-layer':'transportation',
        filter:['==','class','secondary'],
        layout:{ 'line-join':'round', 'line-cap':'round' },
        paint:{ 'line-color':['case',
          ['all',['has','ref'],['>=',['length',['get','ref']],4]],
          c.roadLine,
          'rgba(0,0,0,0)'
        ],
        'line-width':['interpolate',['linear'],['zoom'],6,0.8,10,2.5,14,5,18,12] } },
      rc('rc-tertiary',  c.tertiaryLine, 'tertiary',   [0.8, 2.5], 8),
      rc('rc-local', c.roadLine, ['in', 'class', 'unclassified', 'minor'], [0.5, 2.0], 12),
      rc('rc-street',    c.roadLine,     ['in', 'class', 'street', 'street_limited', 'service', 'residential', 'living_street', 'unclassified', 'minor'], [0.5, 2.0], 13),

      // ── Bridges — gray SIDE RAILS using line-gap-width ───────────────────────
      // line-gap-width = road width → only the side rails (line-width wide) are visible
      { id:'bridge-motorway-side', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['==','class','motorway'],['==','brunnel','bridge']],
        layout:{'line-join':'miter','line-cap':'butt'},
        paint:{'line-color':'#999',
          'line-width':   ['interpolate',['linear'],['zoom'],6,1,10,1.5,14,2,18,3],
          'line-gap-width':['interpolate',['linear'],['zoom'],6,2,10,4,14,8,18,17]} },
      { id:'bridge-trunk-side', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['==','class','trunk'],['==','brunnel','bridge']],
        layout:{'line-join':'miter','line-cap':'butt'},
        paint:{'line-color':'#999',
          'line-width':   ['interpolate',['linear'],['zoom'],6,1,10,1.5,14,2,18,3],
          'line-gap-width':['interpolate',['linear'],['zoom'],6,1.5,10,3,14,7,18,15]} },
      { id:'bridge-primary-side', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['==','class','primary'],['==','brunnel','bridge']],
        layout:{'line-join':'miter','line-cap':'butt'},
        paint:{'line-color':'#999',
          'line-width':   ['interpolate',['linear'],['zoom'],8,0.8,12,1.5,16,2],
          'line-gap-width':['interpolate',['linear'],['zoom'],8,1,12,2.5,16,7]} },
      { id:'bridge-other-side', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['in','class','secondary','tertiary','street','residential'],['==','brunnel','bridge']],
        minzoom:12,
        layout:{'line-join':'miter','line-cap':'butt'},
        paint:{'line-color':'#999',
          'line-width':   ['interpolate',['linear'],['zoom'],10,0.8,14,1.5,18,2.5],
          'line-gap-width':['interpolate',['linear'],['zoom'],10,1,14,3,18,7]} },

      // ── Roads — fills ─────────────────────────────────────────────────────
      { id: 'r-track', type: 'line', source: 'v', 'source-layer': 'transportation',
        filter: ['==', 'class', 'track'], minzoom: 12,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': c.track, 'line-width': 1, 'line-dasharray': [4, 2] } },
      { id: 'r-path', type: 'line', source: 'v', 'source-layer': 'transportation',
        filter: ['in', 'class', 'path', 'footway', 'pedestrian', 'cycleway'], minzoom: 15,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': c.path, 'line-width': 0.8, 'line-dasharray': [3, 2] } },
      rl('r-street',    c.road,      ['in', 'class', 'street', 'street_limited', 'service', 'residential', 'living_street', 'unclassified', 'minor'], [0.4, 1.8], 13),
      rl('r-tertiary',  c.road,      'tertiary',  [0.4, 1.5], 10),
      // Local/district roads (unclassified in OSM → long ref numbers like 50013)
      rl('r-local', c.road, ['in', 'class', 'unclassified', 'minor'], [0.4, 1.8], 12),
      rl('r-secondary', c.secondary, 'secondary', [0.5, 2]),
      // Override: secondary roads with 4+ digit numeric refs (2347, 10801) → white like streets
      { id:'r-secondary-local', type:'line', source:'v', 'source-layer':'transportation',
        filter:['==','class','secondary'],
        layout:{ 'line-join':'round', 'line-cap':'round' },
        paint:{ 'line-color':['case',
          ['all',['has','ref'],['>=',['length',['get','ref']],4]],
          c.road,
          'rgba(0,0,0,0)'  // transparent if short ref — let golden show through
        ],
        'line-width':['interpolate',['linear'],['zoom'],6,0.5,10,2,14,4,18,11] } },
      // Road fills — exclude tunnels (tunnels get their own dimmed layer below)
      { id:'r-primary', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['==','class','primary'],['!=','brunnel','tunnel']],
        layout:{'line-join':'round','line-cap':'round'},
        paint:{'line-color':c.primary,
          'line-width':['interpolate',['linear'],['zoom'],6,1,10,2,14,5,18,14]} },
      { id:'r-trunk', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['==','class','trunk'],['!=','brunnel','tunnel']],
        layout:{'line-join':'round','line-cap':'round'},
        paint:{'line-color':c.trunk,
          'line-width':['interpolate',['linear'],['zoom'],6,1.5,10,3,14,7,18,15]} },
      { id:'r-motorway', type:'line', source:'v', 'source-layer':'transportation',
        filter:['all',['==','class','motorway'],['!=','brunnel','tunnel']],
        layout:{'line-join':'round','line-cap':'round'},
        paint:{'line-color':c.motorway,
          'line-width':['interpolate',['linear'],['zoom'],6,2,10,4,14,8,18,17]} },


      // ── Buildings (after roads so they render on top of tunnels) ────────────
      { id: 'bldg-fill', type: 'fill', source: 'v', 'source-layer': 'building', minzoom: 13,
        paint: { 'fill-color': c.building,
          'fill-opacity': ['interpolate',['linear'],['zoom'], 13,0, 14,0.8, 16,1] } },
      { id: 'bldg-line', type: 'line', source: 'v', 'source-layer': 'building', minzoom: 14,
        paint: { 'line-color': c.buildingLine, 'line-width': 0.5 } },

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

      // ── Road shields (via styleimagemissing) ────────────────────────────────
      // Image name: "shield-{class}-{ref}" e.g. "shield-motorway-D1"
      // Uses ref field (OpenMapTiles/OpenFreeMap schema)
      // E-routes (E50 etc) are OSM route RELATIONS — not stored per-way in tiles, skip them

      // D1/D5/D7 motorway — RED shield
      { id:'shield-motorway', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['all',['==','class','motorway'],['has','ref']],
        minzoom:9,
        layout:{
          'icon-image':['concat','shield-motorway-',['get','ref']],
          'icon-allow-overlap':false,
          'icon-rotation-alignment':'viewport',
          'symbol-placement':'line',
          'symbol-spacing':350,
          'text-field':'',
        },
        paint:{ 'icon-opacity':1 } },

      // R26, 48, MO trunk — BRIGHT BLUE shield
      { id:'shield-trunk', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['all',['==','class','trunk'],['has','ref']],
        minzoom:10,
        layout:{
          'icon-image':['concat','shield-trunk-',['get','ref']],
          'icon-allow-overlap':false,
          'icon-rotation-alignment':'viewport',
          'symbol-placement':'line',
          'symbol-spacing':320,
          'text-field':'',
        },
        paint:{ 'icon-opacity':1 } },

      // 27, 9 primary — BRIGHT BLUE shield
      { id:'shield-primary', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['all',['==','class','primary'],['has','ref']],
        minzoom:11,
        layout:{
          'icon-image':['concat','shield-primary-',['get','ref']],
          'icon-allow-overlap':false,
          'icon-rotation-alignment':'viewport',
          'symbol-placement':'line',
          'symbol-spacing':300,
          'text-field':'',
        },
        paint:{ 'icon-opacity':1 } },

      // 605, 431 secondary — BRIGHT BLUE shield
      { id:'shield-secondary', type:'symbol', source:'v', 'source-layer':'transportation_name',
        filter:['all',['in','class','secondary','tertiary'],['has','ref']],
        minzoom:13,
        layout:{
          'icon-image':['concat','shield-secondary-',['get','ref']],
          'icon-allow-overlap':false,
          'icon-rotation-alignment':'viewport',
          'symbol-placement':'line',
          'symbol-spacing':280,
          'text-field':'',
        },
        paint:{ 'icon-opacity':1 } },

      // ── Road name labels ──────────────────────────────────────────────────
      { id: 'lbl-primary', type: 'symbol', source: 'v', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'primary', 'trunk'], minzoom: 13,
        layout: { 'text-field': ['get', 'name'], 'text-font': FONTS.regular, 'text-size': 10,
          'symbol-placement': 'line', 'symbol-spacing': 250, 'text-max-angle': 30 },
        paint: { 'text-color': c.label, 'text-halo-color': c.bg, 'text-halo-width': 2 } },
      { id: 'lbl-street', type: 'symbol', source: 'v', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'secondary', 'tertiary', 'residential', 'unclassified', 'service'], minzoom: 14,
        layout: { 'text-field': ['get', 'name'], 'text-font': FONTS.regular, 'text-size': 10,
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
        filter: ['all', ['>=', 'admin_level', 6], ['<=', 'admin_level', 10]],
        minzoom: 10,
        paint: {
          'line-color': dark ? '#7a5a3a' : '#cfb99f',
          'line-width': 1.0,
          'line-dasharray': [3, 2],
          'line-opacity': 0.85,
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