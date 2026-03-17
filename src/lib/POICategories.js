// POI Categories with icons, colors, zoom levels, and OSM tags
// Smart zoom handling: lower zoom = only "main" POIs, higher zoom = all POIs
export const POI_CATEGORIES = [
  // === EDUCATION ===
  { 
    name: 'Schools', 
    keywords: ['school', 'škola', 'schule', 'école', 'escuela', 'scuola', 'szkoła'],
    icon: '🏫', 
    color: '#4A90E2',
    osmTag: 'amenity=school',
    minZoom: 10,  // Show major schools at lower zoom
    detailZoom: 16,  // Show all schools at this zoom
    desc: 'Elementary, high schools, universities',
    importance: 'high'  // high = always show, medium = show when zoomed in more, low = only at detail zoom
  },
  
  // === FOOD & DINING ===
  { 
    name: 'Restaurants', 
    keywords: ['restaurant', 'restaurace', 'food', 'jídlo', 'essen', 'nourriture', 'comida', 'ristorante'],
    icon: '🍽️', 
    color: '#E74C3C',
    osmTag: 'amenity=restaurant',
    minZoom: 12,  // Show popular restaurants at lower zoom
    detailZoom: 17,
    desc: 'Dining and food places',
    importance: 'medium'
  },
  { 
    name: 'Cafes', 
    keywords: ['cafe', 'coffee', 'kavárna', 'kaffee', 'café', 'caffè', 'kawa'],
    icon: '☕', 
    color: '#8B4513',
    osmTag: 'amenity=cafe',
    minZoom: 14,
    detailZoom: 17,
    desc: 'Coffee shops and cafes',
    importance: 'medium'
  },
  { 
    name: 'Bars', 
    keywords: ['bar', 'pub', 'hospoda', 'kneipe', 'bar'],
    icon: '🍺', 
    color: '#D68910',
    osmTag: 'amenity=bar',
    minZoom: 14,
    detailZoom: 17,
    desc: 'Bars and pubs',
    importance: 'low'
  },
  { 
    name: 'Bakery', 
    keywords: ['bakery', 'pekárna', 'bäckerei', 'boulangerie', 'panadería', 'panetteria', 'piekarnia'],
    icon: '🥖', 
    color: '#D4A574',
    osmTag: 'shop=bakery',
    minZoom: 14,
    detailZoom: 17,
    desc: 'Bakeries and bread shops',
    importance: 'low'
  },
  
  // === SHOPPING ===
  { 
    name: 'Shops', 
    keywords: ['shop', 'store', 'obchod', 'geschäft', 'magasin', 'tienda', 'negozio', 'sklep'],
    icon: '🛍️', 
    color: '#9B59B6',
    osmTag: 'shop',
    minZoom: 14,
    detailZoom: 17,
    desc: 'Retail stores and shops',
    importance: 'low'
  },
  { 
    name: 'Supermarkets', 
    keywords: ['supermarket', 'grocery', 'potraviny', 'lebensmittel', 'alimentación', 'spożywczy'],
    icon: '🏪', 
    color: '#27AE60',
    osmTag: 'shop=supermarket',
    minZoom: 12,  // Important - show at lower zoom
    detailZoom: 16,
    desc: 'Grocery stores',
    importance: 'high'
  },
  
  // === FACILITIES ===
  { 
    name: 'Toilets', 
    keywords: ['toilet', 'wc', 'restroom', 'záchod', 'toilette', 'baño', 'bagno', 'toaleta'],
    icon: '🚻', 
    color: '#3498DB',
    osmTag: 'amenity=toilets',
    minZoom: 15,
    detailZoom: 18,
    desc: 'Public restrooms',
    importance: 'low'
  },
  { 
    name: 'Banks', 
    keywords: ['bank', 'banka', 'banco', 'banque', 'banca'],
    icon: '🏦', 
    color: '#F39C12',
    osmTag: 'amenity=bank',
    minZoom: 12,
    detailZoom: 16,
    desc: 'Banking services',
    importance: 'high'
  },
  { 
    name: 'ATMs', 
    keywords: ['atm', 'bankomat', 'cash', 'geldautomat', 'cajero', 'bancomat'],
    icon: '💳', 
    color: '#16A085',
    osmTag: 'amenity=atm',
    minZoom: 14,
    detailZoom: 17,
    desc: 'Cash machines',
    importance: 'medium'
  },
  { 
    name: 'Post Office', 
    keywords: ['post', 'pošta', 'correos', 'bureau de poste', 'ufficio postale', 'poczta'],
    icon: '📮', 
    color: '#F39C12',
    osmTag: 'amenity=post_office',
    minZoom: 12,
    detailZoom: 16,
    desc: 'Postal services',
    importance: 'high'
  },
  
  // === HEALTHCARE ===
  { 
    name: 'Pharmacies', 
    keywords: ['pharmacy', 'lékárna', 'apotheke', 'farmacia', 'pharmacie', 'apteka'],
    icon: '💊', 
    color: '#E67E22',
    osmTag: 'amenity=pharmacy',
    minZoom: 12,  // Important - show at lower zoom
    detailZoom: 16,
    desc: 'Medicine and healthcare',
    importance: 'high'
  },
  { 
    name: 'Hospitals', 
    keywords: ['hospital', 'nemocnice', 'krankenhaus', 'hôpital', 'ospedale', 'szpital'],
    icon: '🏥', 
    color: '#C0392B',
    osmTag: 'amenity=hospital',
    minZoom: 10,  // Very important - show at low zoom
    detailZoom: 15,
    desc: 'Medical centers',
    importance: 'high'
  },
  { 
    name: 'Dentist', 
    keywords: ['dentist', 'zubař', 'zahnarzt', 'dentiste', 'dentista', 'dentysta'],
    icon: '🦷', 
    color: '#16A085',
    osmTag: 'amenity=dentist',
    minZoom: 14,
    detailZoom: 17,
    desc: 'Dental clinics',
    importance: 'medium'
  },
  { 
    name: 'Veterinary', 
    keywords: ['vet', 'veterinary', 'veterinář', 'tierarzt', 'veterinario', 'weterynarz'],
    icon: '🐾', 
    color: '#27AE60',
    osmTag: 'amenity=veterinary',
    minZoom: 14,
    detailZoom: 17,
    desc: 'Animal hospitals',
    importance: 'low'
  },
  
  // === CULTURE & LEISURE ===
  { 
    name: 'Libraries', 
    keywords: ['library', 'knihovna', 'bibliothek', 'bibliothèque', 'biblioteca', 'biblioteka'],
    icon: '📚', 
    color: '#8E44AD',
    osmTag: 'amenity=library',
    minZoom: 12,
    detailZoom: 16,
    desc: 'Public libraries',
    importance: 'medium'
  },
  { 
    name: 'Playgrounds', 
    keywords: ['playground', 'hřiště', 'spielplatz', 'aire de jeux', 'parque infantil', 'plac zabaw'],
    icon: '🎮', 
    color: '#F1C40F',
    osmTag: 'leisure=playground',
    minZoom: 15,
    detailZoom: 18,
    desc: 'Children play areas',
    importance: 'low'
  },
  { 
    name: 'Gyms', 
    keywords: ['gym', 'fitness', 'posilovna', 'fitnessstudio', 'gimnasio', 'palestra', 'siłownia'],
    icon: '💪', 
    color: '#E74C3C',
    osmTag: 'leisure=fitness_centre',
    minZoom: 14,
    detailZoom: 17,
    desc: 'Fitness centers',
    importance: 'low'
  },
  { 
    name: 'Cinemas', 
    keywords: ['cinema', 'movie', 'kino', 'cine', 'film'],
    icon: '🎬', 
    color: '#9B59B6',
    osmTag: 'amenity=cinema',
    minZoom: 12,
    detailZoom: 16,
    desc: 'Movie theaters',
    importance: 'medium'
  },
  
  // === ACCOMMODATION & TOURISM ===
  { 
    name: 'Hotels', 
    keywords: ['hotel', 'accommodation', 'ubytování', 'unterkunft', 'hébergement', 'alojamiento', 'nocleg'],
    icon: '🏨', 
    color: '#2980B9',
    osmTag: 'tourism=hotel',
    minZoom: 10,  // Important for travelers
    detailZoom: 15,
    desc: 'Hotels and lodging',
    importance: 'high'
  },
  { 
    name: 'Museums', 
    keywords: ['museum', 'muzeum', 'musée', 'museo', 'muzeum'],
    icon: '🏛️', 
    color: '#34495E',
    osmTag: 'tourism=museum',
    minZoom: 10,
    detailZoom: 15,
    desc: 'Art and history museums',
    importance: 'high'
  },
  { 
    name: 'Castles', 
    keywords: ['castle', 'hrad', 'schloss', 'château', 'castello', 'castillo', 'zamek'],
    icon: '🏰', 
    color: '#95A5A6',
    osmTag: 'historic=castle',
    minZoom: 8,  // Very important landmarks
    detailZoom: 14,
    desc: 'Historic castles and fortresses',
    importance: 'high'
  },
  { 
    name: 'Churches', 
    keywords: ['church', 'kostel', 'kirche', 'église', 'iglesia', 'chiesa', 'kościół'],
    icon: '⛪', 
    color: '#7F8C8D',
    osmTag: 'amenity=place_of_worship',
    minZoom: 12,
    detailZoom: 16,
    desc: 'Places of worship',
    importance: 'medium'
  },
  
  // === SERVICES ===
  { 
    name: 'Car Service', 
    keywords: ['car service', 'repair', 'autoservis', 'werkstatt', 'taller', 'officina', 'warsztat'],
    icon: '🔧', 
    color: '#E67E22',
    osmTag: 'shop=car_repair',
    minZoom: 13,
    detailZoom: 16,
    desc: 'Auto repair shops',
    importance: 'medium'
  },
  
  // === EMERGENCY ===
  { 
    name: 'Police', 
    keywords: ['police', 'policie', 'polizei', 'policía', 'polizia', 'policja'],
    icon: '👮', 
    color: '#2C3E50',
    osmTag: 'amenity=police',
    minZoom: 12,
    detailZoom: 16,
    desc: 'Police stations',
    importance: 'high'
  },
  { 
    name: 'Fire Station', 
    keywords: ['fire station', 'hasičská', 'feuerwehr', 'bomberos', 'pompieri', 'straż pożarna'],
    icon: '🚒', 
    color: '#E74C3C',
    osmTag: 'amenity=fire_station',
    minZoom: 12,
    detailZoom: 16,
    desc: 'Fire departments',
    importance: 'high'
  },
  
  // === PARKING ===
  { 
    name: 'Parking', 
    keywords: ['parking', 'parkování', 'parken', 'estacionamiento', 'parcheggio', 'parkowanie'],
    icon: '🅿️', 
    color: '#3498DB',
    osmTag: 'amenity=parking',
    minZoom: 13,
    detailZoom: 16,
    desc: 'Parking lots and garages',
    importance: 'medium'
  },
  
  // === TRANSPORT ===
  { 
    name: 'Gas Stations', 
    keywords: ['gas', 'fuel', 'petrol', 'benzín', 'tankstelle', 'essence', 'gasolina', 'benzina', 'stacja paliw'],
    icon: '⛽', 
    color: '#E74C3C',
    osmTag: 'amenity=fuel',
    minZoom: 10,  // Important for travelers
    detailZoom: 15,
    desc: 'Fuel stations',
    importance: 'high'
  },
  { 
    name: 'EV Charging', 
    keywords: ['charging', 'electric', 'ev', 'nabíjení', 'ladestation', 'recarga', 'ładowanie'],
    icon: '🔌', 
    color: '#27AE60',
    osmTag: 'amenity=charging_station',
    minZoom: 12,
    detailZoom: 16,
    desc: 'Electric vehicle charging',
    importance: 'medium'
  },
  { 
    name: 'Speed Cameras', 
    keywords: ['speed camera', 'radar', 'rychlost', 'geschwindigkeit', 'velocidad', 'velocità', 'prędkość'],
    icon: '📷', 
    color: '#C0392B',
    osmTag: 'highway=speed_camera',
    minZoom: 13,
    detailZoom: 16,
    desc: 'Speed enforcement cameras',
    importance: 'medium'
  },
  { 
    name: 'Train Stations', 
    keywords: ['train', 'railway', 'vlak', 'bahnhof', 'gare', 'estación', 'stazione', 'dworzec'],
    icon: '🚆', 
    color: '#34495E',
    osmTag: 'railway=station',
    minZoom: 8,  // Major transport hubs
    detailZoom: 14,
    desc: 'Railway stations',
    importance: 'high'
  },
  { 
    name: 'Bus Stops', 
    keywords: ['bus', 'autobus', 'bushaltestelle', 'arrêt de bus', 'fermata'],
    icon: '🚌', 
    color: '#F39C12',
    osmTag: 'highway=bus_stop',
    minZoom: 14,
    detailZoom: 17,
    desc: 'Public bus stops',
    importance: 'low'
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

// Get max POI count based on zoom level
export function getMaxPOICount(zoom, category) {
  // At very low zoom, show fewer POIs
  if (zoom < 10) return 20;
  if (zoom < 12) return 50;
  if (zoom < 14) return 100;
  if (zoom < 16) return 200;
  return 500;  // At high zoom, show many
}

// Determine if a POI should be shown based on zoom and importance
export function shouldShowPOI(zoom, category, poi) {
  // Always show if zoom is high enough
  if (zoom >= category.detailZoom) return true;
  
  // At lower zoom, only show "high" importance POIs or those with special tags
  if (zoom >= category.minZoom) {
    if (category.importance === 'high') return true;
    
    // Check for importance indicators in POI tags
    const tags = poi.tags || {};
    
    // Universities, major hospitals, etc.
    if (tags.university === 'yes' || 
        tags.college === 'yes' ||
        tags.emergency === 'yes' ||
        tags['emergency'] === 'hospital') {
      return true;
    }
    
    // Named POIs with Wikipedia/wikidata are usually important
    if (tags.wikipedia || tags.wikidata) return true;
    
    // Brand names indicate importance
    if (tags.brand) return true;
    
    // At medium zoom, show medium importance
    if (zoom >= 14 && category.importance === 'medium') return true;
  }
  
  return false;
}

// === UTILITY FUNCTIONS ===

// Get category name by key or id
export function getCategoryName(categoryId) {
  if (!categoryId) return '';
  
  // Handle non-string inputs
  if (typeof categoryId !== 'string') {
    // If it's an object with a name property
    if (typeof categoryId === 'object' && categoryId?.name) {
      return categoryId.name;
    }
    // Convert to string as fallback
    return String(categoryId);
  }
  
  // If it's already a name, find the category
  const category = POI_CATEGORIES.find(cat => 
    cat.name.toLowerCase() === categoryId.toLowerCase() ||
    cat.osmTag === categoryId
  );
  
  return category?.name || categoryId;
}

// Get category by name or id
export function getCategoryById(categoryId) {
  if (!categoryId) return null;
  
  // Handle non-string inputs
  if (typeof categoryId !== 'string') {
    // If it's already a category object
    if (typeof categoryId === 'object' && categoryId?.name) {
      return categoryId;
    }
    return null;
  }
  
  return POI_CATEGORIES.find(cat => 
    cat.name.toLowerCase() === categoryId.toLowerCase() ||
    cat.osmTag === categoryId
  ) || null;
}

