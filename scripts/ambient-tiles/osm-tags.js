// OSM category mapping for the local Geofabrik -> osmium -> GeoJSON -> PMTiles pipeline.
// Keep category keys in sync with src/lib/ambientCategories.js.
export const OSM_TAG_MAP = {
  train:         { key: 'railway', value: 'station' },
  fuel:          { key: 'amenity', value: 'fuel' },
  charging:      { key: 'amenity', value: 'charging_station' },
  hotel:         { key: 'tourism', value: 'hotel' },
  museum:        { key: 'tourism', value: 'museum' },
  heritage:      { key: 'historic', value: null },
  hospital:      { key: 'amenity', value: 'hospital' },
  restaurant:    { key: 'amenity', value: 'restaurant' },
  cafe:          { key: 'amenity', value: 'cafe' },
  bar:           { key: 'amenity', value: 'bar' },
  pharmacy:      { key: 'amenity', value: 'pharmacy' },
  bank:          { key: 'amenity', value: 'bank' },
  supermarket:   { key: 'shop',    value: 'supermarket' },
  atm:            { key: 'amenity', value: 'atm' },
  bakery:        { key: 'shop',    value: 'bakery' },
  parking:       { key: 'amenity', value: 'parking' },
  viewpoint:     { key: 'tourism', value: 'viewpoint' },
  camp_site:     { key: 'tourism', value: 'camp_site' },
  caravan_site:  { key: 'tourism', value: 'caravan_site' },
  toilets:       { key: 'amenity', value: 'toilets' },
  drinking_water:{ key: 'amenity', value: 'drinking_water' },
  picnic_site:   { key: 'tourism', value: 'picnic_site' },
};

// Tags worth keeping in the GeoJSON/PMTiles and details-enrichment input.
export const KEPT_TAGS = [
  'name', 'description', 'note', 'phone', 'contact:phone', 'website', 'contact:website',
  'opening_hours', 'wikidata', 'wikimedia_commons', 'image', 'addr:full',
  'addr:street', 'addr:housenumber',
];

export const FILTER_EXPRESSIONS = Object.values(OSM_TAG_MAP).map(({ key, value }) =>
  `nwr/${key}${value ? `=${value}` : ''}`
);
