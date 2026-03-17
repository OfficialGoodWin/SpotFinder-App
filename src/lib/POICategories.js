// POI Categories with icons, colors, zoom levels, and OSM tags
export const POI_CATEGORIES = [
  // Zoom 18+ (local amenities)
  { 
    name: 'Schools', 
    geoapifyCategory: 'education.school',
    keywords: ['school', 'škola', 'schule', 'école', 'escuela', 'scuola', 'szkoła'],
    icon: '🏫', 
    color: '#4A90E2',
    osmTag: 'amenity=school',
    minZoom: 14,
    desc: 'Elementary, high schools, universities'
  },
  { 
    name: 'Restaurants', 
    geoapifyCategory: 'catering.restaurant',
    keywords: ['restaurant', 'restaurace', 'food', 'jídlo', 'essen', 'nourriture', 'comida', 'ristorante'],
    icon: '🍽️', 
    color: '#E74C3C',
    osmTag: 'amenity=restaurant',
    minZoom: 14,
    desc: 'Dining and food places'
  },
  { 
    name: 'Cafes', 
    geoapifyCategory: 'catering.cafe',
    keywords: ['cafe', 'coffee', 'kavárna', 'kaffee', 'café', 'caffè', 'kawa'],
    icon: '☕', 
    color: '#8B4513',
    osmTag: 'amenity=cafe',
    minZoom: 14,
    desc: 'Coffee shops and cafes'
  },
  { 
    name: 'Shops', 
    geoapifyCategory: 'commercial',
    keywords: ['shop', 'store', 'obchod', 'geschäft', 'magasin', 'tienda', 'negozio', 'sklep'],
    icon: '🛍️', 
    color: '#9B59B6',
    osmTag: 'shop',
    minZoom: 14,
    desc: 'Retail stores and shops'
  },
  { 
    name: 'Supermarkets', 
    geoapifyCategory: 'commercial.supermarket',
    keywords: ['supermarket', 'grocery', 'potraviny', 'lebensmittel', 'alimentación', 'spożywczy'],
    icon: '🏪', 
    color: '#27AE60',
    osmTag: 'shop=supermarket',
    minZoom: 14,
    desc: 'Grocery stores'
  },
  { 
    name: 'Toilets', 
    geoapifyCategory: 'service.toilets',
    keywords: ['toilet', 'wc', 'restroom', 'záchod', 'toilette', 'baño', 'bagno', 'toaleta'],
    icon: '🚻', 
    color: '#3498DB',
    osmTag: 'amenity=toilets',
    minZoom: 14,
    desc: 'Public restrooms'
  },
  { 
    name: 'Banks', 
    geoapifyCategory: 'service.financial.bank',
    keywords: ['bank', 'banka', 'banco', 'banque', 'banca'],
    icon: '🏦', 
    color: '#F39C12',
    osmTag: 'amenity=bank',
    minZoom: 14,
    desc: 'Banking services'
  },
  { 
    name: 'ATMs', 
    geoapifyCategory: 'service.financial.atm',
    keywords: ['atm', 'bankomat', 'cash', 'geldautomat', 'cajero', 'bancomat'],
    icon: '💳', 
    color: '#16A085',
    osmTag: 'amenity=atm',
    minZoom: 14,
    desc: 'Cash machines'
  },
  { 
    name: 'Pharmacies', 
    geoapifyCategory: 'healthcare.pharmacy',
    keywords: ['pharmacy', 'lékárna', 'apotheke', 'farmacia', 'pharmacie', 'apteka'],
    icon: '💊', 
    color: '#E67E22',
    osmTag: 'amenity=pharmacy',
    minZoom: 14,
    desc: 'Medicine and healthcare'
  },
  { 
    name: 'Hospitals', 
    geoapifyCategory: 'healthcare.hospital',
    keywords: ['hospital', 'nemocnice', 'krankenhaus', 'hôpital', 'ospedale', 'szpital'],
    icon: '🏥', 
    color: '#C0392B',
    osmTag: 'amenity=hospital',
    minZoom: 14,
    desc: 'Medical centers'
  },
  { 
    name: 'Libraries', 
    geoapifyCategory: 'education.library',
    keywords: ['library', 'knihovna', 'bibliothek', 'bibliothèque', 'biblioteca', 'biblioteka'],
    icon: '📚', 
    color: '#8E44AD',
    osmTag: 'amenity=library',
    minZoom: 14,
    desc: 'Public libraries'
  },
  { 
    name: 'Playgrounds', 
    geoapifyCategory: 'leisure.playground',
    keywords: ['playground', 'hřiště', 'spielplatz', 'aire de jeux', 'parque infantil', 'plac zabaw'],
    icon: '🎮', 
    color: '#F1C40F',
    osmTag: 'leisure=playground',
    minZoom: 14,
    desc: 'Children play areas'
  },
  { 
    name: 'Hotels', 
    geoapifyCategory: 'accommodation.hotel',
    keywords: ['hotel', 'accommodation', 'ubytování', 'unterkunft', 'hébergement', 'alojamiento', 'nocleg'],
    icon: '🏨', 
    color: '#2980B9',
    osmTag: 'tourism=hotel',
    minZoom: 14,
    desc: 'Hotels and lodging'
  },
  { 
    name: 'Museums', 
    geoapifyCategory: 'entertainment.museum',
    keywords: ['museum', 'muzeum', 'musée', 'museo', 'muzeum'],
    icon: '🏛️', 
    color: '#34495E',
    osmTag: 'tourism=museum',
    minZoom: 14,
    desc: 'Art and history museums'
  },
  { 
    name: 'Castles', 
    geoapifyCategory: 'heritage.castle',
    keywords: ['castle', 'hrad', 'schloss', 'château', 'castello', 'castillo', 'zamek'],
    icon: '🏰', 
    color: '#95A5A6',
    osmTag: 'historic=castle',
    minZoom: 14,
    desc: 'Historic castles and fortresses'
  },
  { 
    name: 'Churches', 
    geoapifyCategory: 'religion',
    keywords: ['church', 'kostel', 'kirche', 'église', 'iglesia', 'chiesa', 'kościół'],
    icon: '⛪', 
    color: '#7F8C8D',
    osmTag: 'amenity=place_of_worship',
    minZoom: 14,
    desc: 'Places of worship'
  },
  { 
    name: 'Gyms', 
    geoapifyCategory: 'sport.fitness',
    keywords: ['gym', 'fitness', 'posilovna', 'fitnessstudio', 'gimnasio', 'palestra', 'siłownia'],
    icon: '💪', 
    color: '#E74C3C',
    osmTag: 'leisure=fitness_centre',
    minZoom: 14,
    desc: 'Fitness centers'
  },
  { 
    name: 'Cinemas', 
    geoapifyCategory: 'entertainment.cinema',
    keywords: ['cinema', 'movie', 'kino', 'cine', 'film'],
    icon: '🎬', 
    color: '#9B59B6',
    osmTag: 'amenity=cinema',
    minZoom: 14,
    desc: 'Movie theaters'
  },
  { 
    name: 'Car Service', 
    geoapifyCategory: 'service.vehicle.car_repair',
    keywords: ['car service', 'repair', 'autoservis', 'werkstatt', 'taller', 'officina', 'warsztat'],
    icon: '🔧', 
    color: '#E67E22',
    osmTag: 'shop=car_repair',
    minZoom: 14,
    desc: 'Auto repair shops'
  },
  { 
    name: 'Post Office', 
    geoapifyCategory: 'service.post_office',
    keywords: ['post', 'pošta', 'correos', 'bureau de poste', 'ufficio postale', 'poczta'],
    icon: '📮', 
    color: '#F39C12',
    osmTag: 'amenity=post_office',
    minZoom: 14,
    desc: 'Postal services'
  },
  { 
    name: 'Bars', 
    geoapifyCategory: 'catering.bar',
    keywords: ['bar', 'pub', 'hospoda', 'kneipe', 'bar'],
    icon: '🍺', 
    color: '#D68910',
    osmTag: 'amenity=bar',
    minZoom: 14,
    desc: 'Bars and pubs'
  },
  { 
    name: 'Police', 
    geoapifyCategory: 'service.police',
    keywords: ['police', 'policie', 'polizei', 'policía', 'polizia', 'policja'],
    icon: '👮', 
    color: '#2C3E50',
    osmTag: 'amenity=police',
    minZoom: 14,
    desc: 'Police stations'
  },
  { 
    name: 'Fire Station', 
    geoapifyCategory: 'service.fire_station',
    keywords: ['fire station', 'hasičská', 'feuerwehr', 'bomberos', 'pompieri', 'straż pożarna'],
    icon: '🚒', 
    color: '#E74C3C',
    osmTag: 'amenity=fire_station',
    minZoom: 14,
    desc: 'Fire departments'
  },
  { 
    name: 'Dentist', 
    geoapifyCategory: 'healthcare.dentist',
    keywords: ['dentist', 'zubař', 'zahnarzt', 'dentiste', 'dentista', 'dentysta'],
    icon: '🦷', 
    color: '#16A085',
    osmTag: 'amenity=dentist',
    minZoom: 14,
    desc: 'Dental clinics'
  },
  { 
    name: 'Veterinary', 
    geoapifyCategory: 'healthcare.vet',
    keywords: ['vet', 'veterinary', 'veterinář', 'tierarzt', 'veterinario', 'weterynarz'],
    icon: '🐾', 
    color: '#27AE60',
    osmTag: 'amenity=veterinary',
    minZoom: 14,
    desc: 'Animal hospitals'
  },
  { 
    name: 'Bakery', 
    geoapifyCategory: 'commercial.food_and_drink.bakery',
    keywords: ['bakery', 'pekárna', 'bäckerei', 'boulangerie', 'panadería', 'panetteria', 'piekarnia'],
    icon: '🥖', 
    color: '#D4A574',
    osmTag: 'shop=bakery',
    minZoom: 14,
    desc: 'Bakeries and bread shops'
  },
  
  // Zoom 15+ (parking)
  { 
    name: 'Parking', 
    geoapifyCategory: 'parking',
    keywords: ['parking', 'parkování', 'parken', 'estacionamiento', 'parcheggio', 'parkowanie'],
    icon: '🅿️', 
    color: '#3498DB',
    osmTag: 'amenity=parking',
    minZoom: 15,
    desc: 'Parking lots and garages'
  },
  
  // Zoom 13+ (travel/infrastructure)
  { 
    name: 'Gas Stations', 
    geoapifyCategory: 'service.vehicle.fuel',
    keywords: ['gas', 'fuel', 'petrol', 'benzín', 'tankstelle', 'essence', 'gasolina', 'benzina', 'stacja paliw'],
    icon: '⛽', 
    color: '#E74C3C',
    osmTag: 'amenity=fuel',
    minZoom: 13,
    desc: 'Fuel stations'
  },
  { 
    name: 'EV Charging', 
    geoapifyCategory: 'service.vehicle.charging_station',
    keywords: ['charging', 'electric', 'ev', 'nabíjení', 'ladestation', 'recarga', 'ładowanie'],
    icon: '🔌', 
    color: '#27AE60',
    osmTag: 'amenity=charging_station',
    minZoom: 13,
    desc: 'Electric vehicle charging'
  },
  { 
    name: 'Speed Cameras', 
    geoapifyCategory: null,
    keywords: ['speed camera', 'radar', 'rychlost', 'geschwindigkeit', 'velocidad', 'velocità', 'prędkość'],
    icon: '📷', 
    color: '#C0392B',
    osmTag: 'highway=speed_camera',
    minZoom: 13,
    desc: 'Speed enforcement cameras'
  },
  { 
    name: 'Train Stations', 
    geoapifyCategory: 'public_transport.train',
    keywords: ['train', 'railway', 'vlak', 'bahnhof', 'gare', 'estación', 'stazione', 'dworzec'],
    icon: '🚆', 
    color: '#34495E',
    osmTag: 'railway=station',
    minZoom: 13,
    desc: 'Railway stations'
  },
  { 
    name: 'Bus Stops', 
    geoapifyCategory: 'public_transport.bus',
    keywords: ['bus', 'autobus', 'bushaltestelle', 'arrêt de bus', 'fermata'],
    icon: '🚌', 
    color: '#F39C12',
    osmTag: 'highway=bus_stop',
    minZoom: 15,
    desc: 'Public bus stops'
  }
];

// Function to filter categories by query
export function filterCategories(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  
  return POI_CATEGORIES.filter(cat => 
    cat.keywords.some(keyword => keyword.includes(q)) ||
    cat.name.toLowerCase().includes(q)
  );
}

// Stub icon map (kept for import compatibility with POILayer)
export const POI_ICON_MAP = {};

// Returns the display name for a category
export function getCategoryName(category, language) {
  if (!category) return '';
  return category.name || '';
}