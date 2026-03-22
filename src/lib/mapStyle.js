/**
 * mapStyle.js
 * MapLibre GL style matching Mapy.cz visual design.
 * Uses OpenFreeMap vector tiles (free, no API key, OpenMapTiles schema).
 *
 * Visual reference: Mapy.cz legend
 *  - Warm cream background
 *  - Blue motorways (D1/D2)
 *  - Dark green highways
 *  - Orange international roads (E50)
 *  - Yellow primary/secondary roads
 *  - Light green forests
 *  - Light blue water
 *  - Warm grey buildings
 *  - Clean Noto Sans labels
 */

const FONTS = {
  regular: ['Noto Sans Regular', 'sans-serif'],
  bold:    ['Noto Sans Bold',    'sans-serif'],
  italic:  ['Noto Sans Italic',  'sans-serif'],
};

const C = {
  // Background / land
  bg:           '#f4efe6',
  bgDark:       '#1a1a2e',

  // Land use
  forest:       '#c0d9a8',
  forestDark:   '#1e3d1a',
  farmland:     '#f0ead8',
  farmlandDark: '#1e1e15',
  grass:        '#d8edbe',
  grassDark:    '#1a2e12',
  residential:  '#ede8df',
  residentialDk:'#252525',
  industrial:   '#ddd4cc',
  cemetery:     '#d0ddc0',
  park:         '#c8e8b0',
  parkDark:     '#1a3010',
  beach:        '#f5e8c0',
  glacier:      '#e8f4f8',
  scrub:        '#d0ddb0',
  wetland:      '#c8dcc8',

  // Water
  water:        '#9fc4dd',
  waterDark:    '#0d2a3d',
  waterway:     '#8ab8d0',
  waterwayDark: '#0a2030',

  // Buildings
  building:     '#ddd4c8',
  buildingDark: '#2a2a2a',
  buildingOutline: '#c8bfb0',
  buildingOutlineDk: '#1a1a1a',

  // Roads — matching Mapy.cz legend exactly
  motorway:     '#4a7fc1',   // blue
  motorwayOut:  '#2b5a9e',
  motorwayCase: '#1a4a8e',
  trunk:        '#2e7d32',   // dark green (D highways)
  trunkOut:     '#1b5e20',
  primary:      '#e07b00',   // orange (international/primary)
  primaryOut:   '#b85a00',
  secondary:    '#d4a000',   // golden yellow
  secondaryOut: '#a87800',
  tertiary:     '#b8b08c',   // warm grey
  tertiaryOut:  '#9a9278',
  road:         '#ffffff',   // white residential
  roadOut:      '#c8c0b0',
  path:         '#c0a878',   // tan path
  track:        '#c0a060',   // track
  railway:      '#888888',   // grey railway
  railwayDash:  '#666666',
  tram:         '#aa6688',

  // Hiking trails (Mapy.cz colored)
  hikeRed:    '#cc2222',
  hikeBlue:   '#2244cc',
  hikeGreen:  '#228822',
  hikeYellow: '#ccaa00',

  // Boundaries
  country:    '#aaaaaa',
  province:   '#bbbbbb',
  national_park: '#88aa44',

  // Labels
  label:      '#2a2520',
  labelDark:  '#e0d8cc',
  labelMuted: '#6a6058',
  labelMutedDk: '#9a9288',
  labelWater: '#4a6a8a',
  labelRoad:  '#ffffff',
  labelMotorway: '#ffffff',
};

function makeStyle(dark = false) {
  const bg        = dark ? C.bgDark        : C.bg;
  const lbl       = dark ? C.labelDark     : C.label;
  const lblMuted  = dark ? C.labelMutedDk  : C.labelMuted;
  const forest    = dark ? C.forestDark    : C.forest;
  const farmland  = dark ? C.farmlandDk    : C.farmland;
  const grass     = dark ? C.grassDark     : C.grass;
  const park      = dark ? C.parkDark      : C.park;
  const resid     = dark ? C.residentialDk : C.residential;
  const water     = dark ? C.waterDark     : C.water;
  const waterway  = dark ? C.waterwayDark  : C.waterway;
  const bldg      = dark ? C.buildingDark  : C.building;
  const bldgOut   = dark ? C.buildingOutlineDk : C.buildingOutline;

  return {
    version: 8,
    name:    dark ? 'SpotFinder Dark' : 'SpotFinder',
    glyphs:  'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sprite:  'https://tiles.openfreemap.org/sprites/liberty/sprite',

    sources: {
      openmaptiles: {
        type:        'vector',
        url:         'https://tiles.openfreemap.org/planet',
        attribution: '© <a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },

    layers: [
      // ── Background ──────────────────────────────────────────────────────────
      { id: 'background', type: 'background', paint: { 'background-color': bg } },

      // ── Land cover ──────────────────────────────────────────────────────────
      {
        id: 'landcover-farmland', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
        filter: ['==', 'class', 'farmland'],
        paint: { 'fill-color': dark ? '#1c1c0e' : '#f0ead8', 'fill-opacity': 0.7 },
      },
      {
        id: 'landcover-grass', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
        filter: ['in', 'class', 'grass', 'meadow'],
        paint: { 'fill-color': grass, 'fill-opacity': 0.8 },
      },
      {
        id: 'landcover-scrub', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
        filter: ['==', 'class', 'scrub'],
        paint: { 'fill-color': dark ? '#1a2810' : C.scrub, 'fill-opacity': 0.7 },
      },
      {
        id: 'landcover-forest', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
        filter: ['in', 'class', 'wood', 'forest'],
        paint: { 'fill-color': forest, 'fill-opacity': 0.9 },
      },
      {
        id: 'landcover-wetland', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
        filter: ['==', 'class', 'wetland'],
        paint: { 'fill-color': dark ? '#101e10' : C.wetland, 'fill-opacity': 0.8 },
      },
      {
        id: 'landcover-sand', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
        filter: ['in', 'class', 'sand', 'beach'],
        paint: { 'fill-color': dark ? '#2a2010' : C.beach, 'fill-opacity': 0.9 },
      },
      {
        id: 'landcover-glacier', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
        filter: ['==', 'class', 'ice'],
        paint: { 'fill-color': dark ? '#102030' : C.glacier, 'fill-opacity': 0.9 },
      },

      // ── Land use ────────────────────────────────────────────────────────────
      {
        id: 'landuse-residential', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
        filter: ['in', 'class', 'residential', 'suburb', 'neighbourhood'],
        paint: { 'fill-color': resid, 'fill-opacity': 0.6 },
      },
      {
        id: 'landuse-commercial', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
        filter: ['in', 'class', 'commercial', 'retail'],
        paint: { 'fill-color': dark ? '#1e1818' : '#ede0d8', 'fill-opacity': 0.6 },
      },
      {
        id: 'landuse-industrial', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
        filter: ['==', 'class', 'industrial'],
        paint: { 'fill-color': dark ? '#1e1e18' : C.industrial, 'fill-opacity': 0.7 },
      },
      {
        id: 'landuse-cemetery', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
        filter: ['==', 'class', 'cemetery'],
        paint: { 'fill-color': dark ? '#151e10' : C.cemetery, 'fill-opacity': 0.8 },
      },
      {
        id: 'landuse-park', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
        filter: ['in', 'class', 'park', 'pitch', 'stadium', 'recreation_ground'],
        paint: { 'fill-color': park, 'fill-opacity': 0.8 },
      },
      {
        id: 'landuse-hospital', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
        filter: ['==', 'class', 'hospital'],
        paint: { 'fill-color': dark ? '#1e1010' : '#f0e0e0', 'fill-opacity': 0.7 },
      },
      {
        id: 'landuse-school', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
        filter: ['in', 'class', 'school', 'university', 'college'],
        paint: { 'fill-color': dark ? '#181818' : '#f0e8d8', 'fill-opacity': 0.7 },
      },

      // ── Water ───────────────────────────────────────────────────────────────
      {
        id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water',
        paint: { 'fill-color': water, 'fill-opacity': 1 },
      },
      {
        id: 'waterway-river', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway',
        filter: ['in', 'class', 'river', 'canal'],
        paint: { 'line-color': waterway, 'line-width': ['interpolate',['linear'],['zoom'], 8,1, 14,3, 18,6] },
      },
      {
        id: 'waterway-stream', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway',
        filter: ['in', 'class', 'stream', 'drain', 'ditch'],
        paint: { 'line-color': waterway, 'line-width': ['interpolate',['linear'],['zoom'], 12,0.5, 18,2] },
        minzoom: 12,
      },

      // ── Protected areas / National parks ────────────────────────────────────
      {
        id: 'park-border', type: 'line', source: 'openmaptiles', 'source-layer': 'park',
        paint: {
          'line-color': dark ? '#2a4020' : C.national_park,
          'line-width': 1.5,
          'line-dasharray': [4, 3],
        },
      },

      // ── Buildings ───────────────────────────────────────────────────────────
      {
        id: 'building-fill', type: 'fill', source: 'openmaptiles', 'source-layer': 'building',
        minzoom: 13,
        paint: { 'fill-color': bldg, 'fill-opacity': ['interpolate',['linear'],['zoom'], 13,0, 14,0.8, 16,1] },
      },
      {
        id: 'building-outline', type: 'line', source: 'openmaptiles', 'source-layer': 'building',
        minzoom: 14,
        paint: { 'line-color': bldgOut, 'line-width': 0.5 },
      },

      // ── Transportation — casings (drawn below fill for outline effect) ───────
      {
        id: 'road-motorway-case', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', 'class', 'motorway'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': C.motorwayCase,
          'line-width': ['interpolate',['linear'],['zoom'], 6,2.5, 10,5, 14,9, 18,18],
          'line-opacity': 1,
        },
      },
      {
        id: 'road-trunk-case', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', 'class', 'trunk'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': C.trunkOut,
          'line-width': ['interpolate',['linear'],['zoom'], 6,2, 10,4, 14,8, 18,16],
        },
      },
      {
        id: 'road-primary-case', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', 'class', 'primary'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': C.primaryOut,
          'line-width': ['interpolate',['linear'],['zoom'], 8,1.5, 12,3.5, 16,8],
        },
      },
      {
        id: 'road-secondary-case', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', 'class', 'secondary'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': C.secondaryOut,
          'line-width': ['interpolate',['linear'],['zoom'], 8,1, 12,3, 16,7],
        },
      },
      {
        id: 'road-tertiary-case', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', 'class', 'tertiary'],
        minzoom: 10,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': C.tertiaryOut,
          'line-width': ['interpolate',['linear'],['zoom'], 10,1, 14,2.5, 18,6],
        },
      },
      {
        id: 'road-street-case', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['in', 'class', 'street', 'street_limited', 'service', 'residential', 'living_street'],
        minzoom: 13,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': C.roadOut,
          'line-width': ['interpolate',['linear'],['zoom'], 13,1, 16,3, 18,7],
        },
      },

      // ── Transportation — fills ───────────────────────────────────────────────
      {
        id: 'road-track', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', 'class', 'track'],
        minzoom: 12,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': dark ? '#6a5a40' : C.track,
          'line-width': 1,
          'line-dasharray': [4, 2],
        },
      },
      {
        id: 'road-path', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['in', 'class', 'path', 'footway', 'pedestrian', 'cycleway'],
        minzoom: 13,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': dark ? '#7a6a50' : C.path,
          'line-width': 0.8,
          'line-dasharray': [3, 2],
        },
      },
      {
        id: 'road-street', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['in', 'class', 'street', 'street_limited', 'service', 'residential', 'living_street', 'unclassified'],
        minzoom: 13,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': dark ? '#3a3a3a' : C.road,
          'line-width': ['interpolate',['linear'],['zoom'], 13,0.5, 16,2.5, 18,6],
        },
      },
      {
        id: 'road-tertiary', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', 'class', 'tertiary'],
        minzoom: 10,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': dark ? '#5a5040' : C.tertiary,
          'line-width': ['interpolate',['linear'],['zoom'], 10,0.5, 14,1.5, 18,5],
        },
      },
      {
        id: 'road-secondary', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', 'class', 'secondary'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': dark ? '#b08000' : C.secondary,
          'line-width': ['interpolate',['linear'],['zoom'], 8,0.5, 12,2, 16,6],
        },
      },
      {
        id: 'road-primary', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', 'class', 'primary'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': dark ? '#c06000' : C.primary,
          'line-width': ['interpolate',['linear'],['zoom'], 8,1, 12,2.5, 16,7],
        },
      },
      {
        id: 'road-trunk', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', 'class', 'trunk'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': dark ? '#1a5020' : C.trunk,
          'line-width': ['interpolate',['linear'],['zoom'], 6,1.5, 10,3, 14,7, 18,15],
        },
      },
      {
        id: 'road-motorway', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', 'class', 'motorway'],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': dark ? '#1a3a7a' : C.motorway,
          'line-width': ['interpolate',['linear'],['zoom'], 6,2, 10,4, 14,8, 18,17],
        },
      },
      // Motorway center stripe (yellow line like Mapy.cz)
      {
        id: 'road-motorway-stripe', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', 'class', 'motorway'],
        minzoom: 11,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#f5d800',
          'line-width': ['interpolate',['linear'],['zoom'], 11,0.5, 14,1.5, 18,3],
          'line-dasharray': [6, 4],
        },
      },

      // ── Railway ─────────────────────────────────────────────────────────────
      {
        id: 'railway-case', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', 'class', 'rail'],
        minzoom: 8,
        paint: {
          'line-color': dark ? '#444444' : '#999999',
          'line-width': ['interpolate',['linear'],['zoom'], 8,1, 14,4, 18,8],
        },
      },
      {
        id: 'railway', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['==', 'class', 'rail'],
        minzoom: 8,
        paint: {
          'line-color': dark ? '#666666' : '#f4efe6',
          'line-width': ['interpolate',['linear'],['zoom'], 8,0.5, 14,2, 18,5],
          'line-dasharray': [6, 3],
        },
      },
      {
        id: 'railway-transit', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['in', 'class', 'transit', 'subway'],
        minzoom: 11,
        paint: {
          'line-color': dark ? '#884466' : C.tram,
          'line-width': 1.5,
          'line-dasharray': [4, 2],
        },
      },

      // ── Boundaries ──────────────────────────────────────────────────────────
      {
        id: 'boundary-country', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary',
        filter: ['==', 'admin_level', 2],
        paint: {
          'line-color': dark ? '#888888' : C.country,
          'line-width': 1.5,
          'line-dasharray': [4, 2, 1, 2],
        },
      },
      {
        id: 'boundary-province', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary',
        filter: ['==', 'admin_level', 4],
        minzoom: 6,
        paint: {
          'line-color': dark ? '#666666' : C.province,
          'line-width': 0.8,
          'line-dasharray': [3, 2],
        },
      },

      // ── Road labels ─────────────────────────────────────────────────────────
      {
        id: 'road-label-motorway', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name',
        filter: ['==', 'class', 'motorway'],
        minzoom: 10,
        layout: {
          'text-field': ['get', 'ref'],
          'text-font': FONTS.bold,
          'text-size': 10,
          'symbol-placement': 'line',
          'symbol-spacing': 300,
          'text-max-angle': 30,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': C.motorway,
          'text-halo-width': 3,
        },
      },
      {
        id: 'road-label-primary', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'primary', 'trunk'],
        minzoom: 12,
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': FONTS.regular,
          'text-size': 10,
          'symbol-placement': 'line',
          'symbol-spacing': 250,
          'text-max-angle': 30,
        },
        paint: {
          'text-color': dark ? '#f0e8d8' : '#2a2520',
          'text-halo-color': dark ? '#1a1a1a' : '#ffffff',
          'text-halo-width': 2,
        },
      },
      {
        id: 'road-label-street', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'secondary', 'tertiary', 'street', 'residential'],
        minzoom: 14,
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': FONTS.regular,
          'text-size': 10,
          'symbol-placement': 'line',
          'symbol-spacing': 200,
          'text-max-angle': 30,
        },
        paint: {
          'text-color': dark ? '#c0b8a8' : '#3a3028',
          'text-halo-color': dark ? '#1a1a1a' : '#ffffff',
          'text-halo-width': 1.5,
        },
      },

      // ── POI labels ──────────────────────────────────────────────────────────
      {
        id: 'poi-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi',
        minzoom: 15,
        filter: ['in', 'class', 'restaurant', 'cafe', 'bar', 'hotel', 'hospital', 'pharmacy', 'bank', 'shop', 'fuel', 'parking', 'museum', 'school'],
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': FONTS.regular,
          'text-size': 10,
          'text-anchor': 'top',
          'text-offset': [0, 0.8],
          'text-max-width': 8,
          'icon-optional': true,
        },
        paint: {
          'text-color': dark ? '#c0b8a8' : '#3a3028',
          'text-halo-color': dark ? '#1a1a1a80' : '#ffffffc0',
          'text-halo-width': 1,
        },
      },

      // ── Water labels ─────────────────────────────────────────────────────────
      {
        id: 'water-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'water_name',
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': FONTS.italic,
          'text-size': ['interpolate',['linear'],['zoom'], 8,10, 14,14],
        },
        paint: {
          'text-color': dark ? '#4a7aaa' : C.labelWater,
          'text-halo-color': dark ? '#0a1a2a80' : '#ffffff80',
          'text-halo-width': 1,
        },
      },

      // ── Place labels ─────────────────────────────────────────────────────────
      {
        id: 'place-village', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
        filter: ['in', 'class', 'village', 'hamlet', 'suburb', 'neighbourhood', 'quarter'],
        minzoom: 11,
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': FONTS.regular,
          'text-size': ['interpolate',['linear'],['zoom'], 11,9, 15,12],
          'text-max-width': 8,
        },
        paint: {
          'text-color': dark ? '#b0a898' : lblMuted,
          'text-halo-color': dark ? '#1a1a1a' : '#ffffff',
          'text-halo-width': 1.5,
        },
      },
      {
        id: 'place-town', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
        filter: ['==', 'class', 'town'],
        minzoom: 8,
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': FONTS.regular,
          'text-size': ['interpolate',['linear'],['zoom'], 8,10, 13,14],
          'text-max-width': 8,
        },
        paint: {
          'text-color': dark ? '#c0b8a8' : lbl,
          'text-halo-color': dark ? '#1a1a1a' : '#ffffff',
          'text-halo-width': 2,
        },
      },
      {
        id: 'place-city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
        filter: ['in', 'class', 'city', 'capital'],
        minzoom: 5,
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': FONTS.bold,
          'text-size': ['interpolate',['linear'],['zoom'], 5,10, 8,13, 12,18],
          'text-max-width': 8,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': dark ? '#e0d8cc' : '#1a1510',
          'text-halo-color': dark ? '#1a1a1a' : '#ffffff',
          'text-halo-width': 2,
        },
      },
      {
        id: 'place-country', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
        filter: ['==', 'class', 'country'],
        maxzoom: 8,
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
          'text-font': FONTS.bold,
          'text-size': ['interpolate',['linear'],['zoom'], 2,8, 6,14],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.1,
        },
        paint: {
          'text-color': dark ? '#c0b0a0' : '#3a2a20',
          'text-halo-color': dark ? '#1a1a1a60' : '#ffffff80',
          'text-halo-width': 2,
        },
      },
    ],
  };
}

export const lightStyle = makeStyle(false);
export const darkStyle  = makeStyle(true);
export default lightStyle;