// POI Categories with icons, colors, zoom levels, and OSM tags
export const POI_CATEGORIES = [
  // Zoom 18+ (local amenities)
  { 
    name: 'Schools', 
    keywords: ['school', 'škola', 'schule', 'école', 'escuela', 'scuola', 'szkoła'],
    icon: '🏫', 
    color: '#4A90E2',
    osmTag: 'amenity=school',
    minZoom: 18,
    desc: 'Elementary, high schools, universities'
  },
  { 
    name: 'Restaurants', 
    keywords: ['restaurant', 'restaurace', 'food', 'jídlo', 'essen', 'nourriture', 'comida', 'ristorante'],
    icon: '🍽️', 
    color: '#E74C3C',
    osmTag: 'amenity=restaurant',
    minZoom: 18,
    desc: 'Dining and food places'
  },
  { 
    name: 'Cafes', 
    keywords: ['cafe', 'coffee', 'kavárna', 'kaffee', 'café', 'caffè', 'kawa'],
    icon: '☕', 
    color: '#8B4513',
    osmTag: 'amenity=cafe',
    minZoom: 18,
    desc: 'Coffee shops and cafes'
  },
  { 
    name: 'Shops', 
    keywords: ['shop', 'store', 'obchod', 'geschäft', 'magasin', 'tienda', 'negozio', 'sklep'],
    icon: '🛍️', 
    color: '#9B59B6',
    osmTag: 'shop',
    minZoom: 18,
    desc: 'Retail stores and shops'
  },
  { 
    name: 'Supermarkets', 
    keywords: ['supermarket', 'grocery', 'potraviny', 'lebensmittel', 'alimentación', 'spożywczy'],
    icon: '🏪', 
    color: '#27AE60',
    osmTag: 'shop=supermarket',
    minZoom: 18,
    desc: 'Grocery stores'
  },
  { 
    name: 'Toilets', 
    keywords: ['toilet', 'wc', 'restroom', 'záchod', 'toilette', 'baño', 'bagno', 'toaleta'],
    icon: '🚻', 
    color: '#3498DB',
    osmTag: 'amenity=toilets',
    minZoom: 18,
    desc: 'Public restrooms'
  },
  { 
    name: 'Banks', 
    keywords: ['bank', 'banka', 'banco', 'banque', 'banca'],
    icon: '🏦', 
    color: '#F39C12',
    osmTag: 'amenity=bank',
    minZoom: 18,
    desc: 'Banking services'
  },
  { 
    name: 'ATMs', 
    keywords: ['atm', 'bankomat', 'cash', 'geldautomat', 'cajero', 'bancomat'],
    icon: '💳', 
    color: '#16A085',
    osmTag: 'amenity=atm',
    minZoom: 18,
    desc: 'Cash machines'
  },
  { 
    name: 'Pharmacies', 
    keywords: ['pharmacy', 'lékárna', 'apotheke', 'farmacia', 'pharmacie', 'apteka'],
    icon: '💊', 
    color: '#E67E22',
    osmTag: 'amenity=pharmacy',
    minZoom: 18,
    desc: 'Medicine and healthcare'
  },
  { 
    name: 'Hospitals', 
    keywords: ['hospital', 'nemocnice', 'krankenhaus', 'hôpital', 'ospedale', 'szpital'],
    icon: '🏥', 
    color: '#C0392B',
    osmTag: 'amenity=hospital',
    minZoom: 18,
    desc: 'Medical centers'
  },
  { 
    name: 'Libraries', 
    keywords: ['library', 'knihovna', 'bibliothek', 'bibliothèque', 'biblioteca', 'biblioteka'],
    icon: '📚', 
    color: '#8E44AD',
    osmTag: 'amenity=library',
    minZoom: 18,
    desc: 'Public libraries'
  },
  { 
    name: 'Playgrounds', 
    keywords: ['playground', 'hřiště', 'spielplatz', 'aire de jeux', 'parque infantil', 'plac zabaw'],
    icon: '🎮', 
    color: '#F1C40F',
    osmTag: 'leisure=playground',
    minZoom: 18,
    desc: 'Children play areas'
  },
  { 
    name: 'Hotels', 
    keywords: ['hotel', 'accommodation', 'ubytování', 'unterkunft', 'hébergement', 'alojamiento', 'nocleg'],
    icon: '🏨', 
    color: '#2980B9',
    osmTag: 'tourism=hotel',
    minZoom: 18,
    desc: 'Hotels and lodging'
  },
  { 
    name: 'Museums', 
    keywords: ['museum', 'muzeum', 'musée', 'museo', 'muzeum'],
    icon: '🏛️', 
    color: '#34495E',
    osmTag: 'tourism=museum',
    minZoom: 18,
    desc: 'Art and history museums'
  },
  { 
    name: 'Castles', 
    keywords: ['castle', 'hrad', 'schloss', 'château', 'castello', 'castillo', 'zamek'],
    icon: '🏰', 
    color: '#95A5A6',
    osmTag: 'historic=castle',
    minZoom: 18,
    desc: 'Historic castles and fortresses'
  },
  { 
    name: 'Churches', 
    keywords: ['church', 'kostel', 'kirche', 'église', 'iglesia', 'chiesa', 'kościół'],
    icon: '⛪', 
    color: '#7F8C8D',
    osmTag: 'amenity=place_of_worship',
    minZoom: 18,
    desc: 'Places of worship'
  },
  { 
    name: 'Gyms', 
    keywords: ['gym', 'fitness', 'posilovna', 'fitnessstudio', 'gimnasio', 'palestra', 'siłownia'],
    icon: '💪', 
    color: '#E74C3C',
    osmTag: 'leisure=fitness_centre',
    minZoom: 18,
    desc: 'Fitness centers'
  },
  { 
    name: 'Cinemas', 
    keywords: ['cinema', 'movie', 'kino', 'cine', 'film'],
    icon: '🎬', 
    color: '#9B59B6',
    osmTag: 'amenity=cinema',
    minZoom: 18,
    desc: 'Movie theaters'
  },
  { 
    name: 'Car Service', 
    keywords: ['car service', 'repair', 'autoservis', 'werkstatt', 'taller', 'officina', 'warsztat'],
    icon: '🔧', 
    color: '#E67E22',
    osmTag: 'shop=car_repair',
    minZoom: 18,
    desc: 'Auto repair shops'
  },
  { 
    name: 'Post Office', 
    keywords: ['post', 'pošta', 'correos', 'bureau de poste', 'ufficio postale', 'poczta'],
    icon: '📮', 
    color: '#F39C12',
    osmTag: 'amenity=post_office',
    minZoom: 18,
    desc: 'Postal services'
  },
  { 
    name: 'Bars', 
    keywords: ['bar', 'pub', 'hospoda', 'kneipe', 'bar'],
    icon: '🍺', 
    color: '#D68910',
    osmTag: 'amenity=bar',
    minZoom: 18,
    desc: 'Bars and pubs'
  },
  { 
    name: 'Police', 
    keywords: ['police', 'policie', 'polizei', 'policía', 'polizia', 'policja'],
    icon: '👮', 
    color: '#2C3E50',
    osmTag: 'amenity=police',
    minZoom: 18,
    desc: 'Police stations'
  },
  { 
    name: 'Fire Station', 
    keywords: ['fire station', 'hasičská', 'feuerwehr', 'bomberos', 'pompieri', 'straż pożarna'],
    icon: '🚒', 
    color: '#E74C3C',
    osmTag: 'amenity=fire_station',
    minZoom: 18,
    desc: 'Fire departments'
  },
  { 
    name: 'Dentist', 
    keywords: ['dentist', 'zubař', 'zahnarzt', 'dentiste', 'dentista', 'dentysta'],
    icon: '🦷', 
    color: '#16A085',
    osmTag: 'amenity=dentist',
    minZoom: 18,
    desc: 'Dental clinics'
  },
  { 
    name: 'Veterinary', 
    keywords: ['vet', 'veterinary', 'veterinář', 'tierarzt', 'veterinario', 'weterynarz'],
    icon: '🐾', 
    color: '#27AE60',
    osmTag: 'amenity=veterinary',
    minZoom: 18,
    desc: 'Animal hospitals'
  },
  { 
    name: 'Bakery', 
    keywords: ['bakery', 'pekárna', 'bäckerei', 'boulangerie', 'panadería', 'panetteria', 'piekarnia'],
    icon: '🥖', 
    color: '#D4A574',
    osmTag: 'shop=bakery',
    minZoom: 18,
    desc: 'Bakeries and bread shops'
  },
  
  // Zoom 15+ (parking)
  { 
    name: 'Parking', 
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
    keywords: ['gas', 'fuel', 'petrol', 'benzín', 'tankstelle', 'essence', 'gasolina', 'benzina', 'stacja paliw'],
    icon: '⛽', 
    color: '#E74C3C',
    osmTag: 'amenity=fuel',
    minZoom: 13,
    desc: 'Fuel stations'
  },
  { 
    name: 'EV Charging', 
    keywords: ['charging', 'electric', 'ev', 'nabíjení', 'ladestation', 'recarga', 'ładowanie'],
    icon: '🔌', 
    color: '#27AE60',
    osmTag: 'amenity=charging_station',
    minZoom: 13,
    desc: 'Electric vehicle charging'
  },
  { 
    name: 'Speed Cameras', 
    keywords: ['speed camera', 'radar', 'rychlost', 'geschwindigkeit', 'velocidad', 'velocità', 'prędkość'],
    icon: '📷', 
    color: '#C0392B',
    osmTag: 'highway=speed_camera',
    minZoom: 13,
    desc: 'Speed enforcement cameras'
  },
  { 
    name: 'Train Stations', 
    keywords: ['train', 'railway', 'vlak', 'bahnhof', 'gare', 'estación', 'stazione', 'dworzec'],
    icon: '🚆', 
    color: '#34495E',
    osmTag: 'railway=station',
    minZoom: 13,
    desc: 'Railway stations'
  },
  { 
    name: 'Bus Stops', 
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

// Returns the display name for a category (with optional language support)
export function getCategoryName(category, language) {
  if (!category) return '';
  return category.name || '';
}