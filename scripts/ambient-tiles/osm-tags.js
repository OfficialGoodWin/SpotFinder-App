// Maps each ambient-POI category key (see src/lib/ambientCategories.js) to
// the OSM tag that identifies it, for the Overpass extraction in build.js.
//
// Keep this in sync with ambientCategories.js: if you add a new
// Geoapify-backed category there, add its OSM equivalent here too, and vice
// versa. `value: null` means "any value for this key" (e.g. historic=*).
export const OSM_TAG_MAP = {
  train:       { key: 'railway', value: 'station' },
  fuel:        { key: 'amenity', value: 'fuel' },
  charging:    { key: 'amenity', value: 'charging_station' },
  hotel:       { key: 'tourism', value: 'hotel' },
  museum:      { key: 'tourism', value: 'museum' },
  heritage:    { key: 'historic', value: null },
  hospital:    { key: 'amenity', value: 'hospital' },
  restaurant:  { key: 'amenity', value: 'restaurant' },
  cafe:        { key: 'amenity', value: 'cafe' },
  bar:         { key: 'amenity', value: 'bar' },
  pharmacy:    { key: 'amenity', value: 'pharmacy' },
  bank:        { key: 'amenity', value: 'bank' },
  supermarket: { key: 'shop',    value: 'supermarket' },
  atm:         { key: 'amenity', value: 'atm' },
  bakery:      { key: 'shop',    value: 'bakery' },
  parking:     { key: 'amenity', value: 'parking' },
};

// Tags worth keeping per feature (beyond the category itself) — mirrors
// what POILayer/POIDetailPanel actually read. Keeping this list short is
// what keeps the resulting PMTiles file small.
export const KEPT_TAGS = [
  'name', 'phone', 'contact:phone', 'website', 'contact:website',
  'opening_hours', 'wikidata', 'wikimedia_commons', 'image', 'addr:full',
  'addr:street', 'addr:housenumber',
];
