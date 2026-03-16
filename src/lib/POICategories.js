import { 
  GraduationCap, Utensils, Coffee, ShoppingBag, ShoppingCart, 
  Toilet, Building2, CreditCard, Pill, Hospital, BookOpen, 
  Gamepad2, Hotel, Landmark, Castle, Church, Dumbbell, Film,
  Wrench, Mail, Beer, ShieldAlert, Flame, Cross, Paw, Sandwich,
  ParkingCircle, Fuel, Plug, Camera, Train, Bus
} from 'lucide-react';

// POI Categories with multilingual support, proper icons, and zoom levels
export const POI_CATEGORIES = [
  // Zoom 18+ (local amenities)
  { 
    nameKey: 'school',
    translations: {
      en: 'School',
      cs: 'Škola',
      de: 'Schule',
      fr: 'École',
      es: 'Escuela',
      it: 'Scuola',
      pl: 'Szkoła'
    },
    keywords: ['school', 'schools', 'škola', 'školy', 'schule', 'schulen', 'école', 'écoles', 'escuela', 'escuelas', 'scuola', 'scuole', 'szkoła', 'szkoły', 'university', 'univerzita'],
    icon: GraduationCap,
    color: '#4A90E2',
    osmTag: 'amenity=school',
    minZoom: 18,
    descKey: 'Elementary, high schools, universities'
  },
  { 
    nameKey: 'restaurant',
    translations: {
      en: 'Restaurant',
      cs: 'Restaurace',
      de: 'Restaurant',
      fr: 'Restaurant',
      es: 'Restaurante',
      it: 'Ristorante',
      pl: 'Restauracja'
    },
    keywords: ['restaurant', 'restaurants', 'restaurace', 'food', 'jídlo', 'essen', 'nourriture', 'comida', 'ristorante', 'restauracja', 'dining', 'eat'],
    icon: Utensils,
    color: '#E74C3C',
    osmTag: 'amenity=restaurant',
    minZoom: 18,
    descKey: 'Dining and food places'
  },
  { 
    nameKey: 'cafe',
    translations: {
      en: 'Cafe',
      cs: 'Kavárna',
      de: 'Café',
      fr: 'Café',
      es: 'Café',
      it: 'Caffè',
      pl: 'Kawiarnia'
    },
    keywords: ['cafe', 'cafes', 'coffee', 'kavárna', 'kavarny', 'kaffee', 'café', 'cafés', 'caffè', 'kawiarnia', 'kawy'],
    icon: Coffee,
    color: '#8B4513',
    osmTag: 'amenity=cafe',
    minZoom: 18,
    descKey: 'Coffee shops and cafes'
  },
  { 
    nameKey: 'shop',
    translations: {
      en: 'Shop',
      cs: 'Obchod',
      de: 'Geschäft',
      fr: 'Magasin',
      es: 'Tienda',
      it: 'Negozio',
      pl: 'Sklep'
    },
    keywords: ['shop', 'shops', 'store', 'stores', 'obchod', 'obchody', 'geschäft', 'geschäfte', 'magasin', 'magasins', 'tienda', 'tiendas', 'negozio', 'negozi', 'sklep', 'sklepy'],
    icon: ShoppingBag,
    color: '#9B59B6',
    osmTag: 'shop',
    minZoom: 18,
    descKey: 'Retail stores and shops'
  },
  { 
    nameKey: 'supermarket',
    translations: {
      en: 'Supermarket',
      cs: 'Supermarket',
      de: 'Supermarkt',
      fr: 'Supermarché',
      es: 'Supermercado',
      it: 'Supermercato',
      pl: 'Supermarket'
    },
    keywords: ['supermarket', 'supermarkets', 'grocery', 'potraviny', 'lebensmittel', 'alimentación', 'spożywczy'],
    icon: ShoppingCart,
    color: '#27AE60',
    osmTag: 'shop=supermarket',
    minZoom: 18,
    descKey: 'Grocery stores'
  },
  { 
    nameKey: 'toilet',
    translations: {
      en: 'Toilet',
      cs: 'Záchod',
      de: 'Toilette',
      fr: 'Toilette',
      es: 'Baño',
      it: 'Bagno',
      pl: 'Toaleta'
    },
    keywords: ['toilet', 'toilets', 'wc', 'restroom', 'záchod', 'záchody', 'toilette', 'toiletten', 'baño', 'baños', 'bagno', 'toaleta', 'toalety'],
    icon: Toilet,
    color: '#3498DB',
    osmTag: 'amenity=toilets',
    minZoom: 18,
    descKey: 'Public restrooms'
  },
  { 
    nameKey: 'bank',
    translations: {
      en: 'Bank',
      cs: 'Banka',
      de: 'Bank',
      fr: 'Banque',
      es: 'Banco',
      it: 'Banca',
      pl: 'Bank'
    },
    keywords: ['bank', 'banks', 'banka', 'banky', 'banco', 'bancos', 'banque', 'banques', 'banca'],
    icon: Building2,
    color: '#F39C12',
    osmTag: 'amenity=bank',
    minZoom: 18,
    descKey: 'Banking services'
  },
  { 
    nameKey: 'atm',
    translations: {
      en: 'ATM',
      cs: 'Bankomat',
      de: 'Geldautomat',
      fr: 'Distributeur',
      es: 'Cajero',
      it: 'Bancomat',
      pl: 'Bankomat'
    },
    keywords: ['atm', 'atms', 'bankomat', 'bankomaty', 'cash', 'geldautomat', 'cajero', 'distributeur'],
    icon: CreditCard,
    color: '#16A085',
    osmTag: 'amenity=atm',
    minZoom: 18,
    descKey: 'Cash machines'
  },
  { 
    nameKey: 'pharmacy',
    translations: {
      en: 'Pharmacy',
      cs: 'Lékárna',
      de: 'Apotheke',
      fr: 'Pharmacie',
      es: 'Farmacia',
      it: 'Farmacia',
      pl: 'Apteka'
    },
    keywords: ['pharmacy', 'pharmacies', 'lékárna', 'lékárny', 'apotheke', 'apotheken', 'farmacia', 'farmacias', 'pharmacie', 'apteka', 'apteki'],
    icon: Pill,
    color: '#E67E22',
    osmTag: 'amenity=pharmacy',
    minZoom: 18,
    descKey: 'Medicine and healthcare'
  },
  { 
    nameKey: 'hospital',
    translations: {
      en: 'Hospital',
      cs: 'Nemocnice',
      de: 'Krankenhaus',
      fr: 'Hôpital',
      es: 'Hospital',
      it: 'Ospedale',
      pl: 'Szpital'
    },
    keywords: ['hospital', 'hospitals', 'nemocnice', 'krankenhaus', 'hôpital', 'ospedale', 'szpital', 'szpitale'],
    icon: Hospital,
    color: '#C0392B',
    osmTag: 'amenity=hospital',
    minZoom: 18,
    descKey: 'Medical centers'
  },
  { 
    nameKey: 'library',
    translations: {
      en: 'Library',
      cs: 'Knihovna',
      de: 'Bibliothek',
      fr: 'Bibliothèque',
      es: 'Biblioteca',
      it: 'Biblioteca',
      pl: 'Biblioteka'
    },
    keywords: ['library', 'libraries', 'knihovna', 'knihovny', 'bibliothek', 'bibliotheken', 'bibliothèque', 'biblioteca', 'biblioteka'],
    icon: BookOpen,
    color: '#8E44AD',
    osmTag: 'amenity=library',
    minZoom: 18,
    descKey: 'Public libraries'
  },
  { 
    nameKey: 'playground',
    translations: {
      en: 'Playground',
      cs: 'Hřiště',
      de: 'Spielplatz',
      fr: 'Aire de jeux',
      es: 'Parque infantil',
      it: 'Parco giochi',
      pl: 'Plac zabaw'
    },
    keywords: ['playground', 'playgrounds', 'hřiště', 'spielplatz', 'aire de jeux', 'parque infantil', 'plac zabaw'],
    icon: Gamepad2,
    color: '#F1C40F',
    osmTag: 'leisure=playground',
    minZoom: 18,
    descKey: 'Children play areas'
  },
  { 
    nameKey: 'hotel',
    translations: {
      en: 'Hotel',
      cs: 'Hotel',
      de: 'Hotel',
      fr: 'Hôtel',
      es: 'Hotel',
      it: 'Hotel',
      pl: 'Hotel'
    },
    keywords: ['hotel', 'hotels', 'accommodation', 'ubytování', 'unterkunft', 'hébergement', 'alojamiento', 'nocleg'],
    icon: Hotel,
    color: '#2980B9',
    osmTag: 'tourism=hotel',
    minZoom: 18,
    descKey: 'Hotels and lodging'
  },
  { 
    nameKey: 'museum',
    translations: {
      en: 'Museum',
      cs: 'Muzeum',
      de: 'Museum',
      fr: 'Musée',
      es: 'Museo',
      it: 'Museo',
      pl: 'Muzeum'
    },
    keywords: ['museum', 'museums', 'muzeum', 'muzea', 'musée', 'musées', 'museo', 'musei'],
    icon: Landmark,
    color: '#34495E',
    osmTag: 'tourism=museum',
    minZoom: 18,
    descKey: 'Art and history museums'
  },
  { 
    nameKey: 'castle',
    translations: {
      en: 'Castle',
      cs: 'Hrad',
      de: 'Schloss',
      fr: 'Château',
      es: 'Castillo',
      it: 'Castello',
      pl: 'Zamek'
    },
    keywords: ['castle', 'castles', 'hrad', 'hrady', 'schloss', 'château', 'castillo', 'castello', 'zamek', 'zamki'],
    icon: Castle,
    color: '#95A5A6',
    osmTag: 'historic=castle',
    minZoom: 18,
    descKey: 'Historic castles and fortresses'
  },
  { 
    nameKey: 'church',
    translations: {
      en: 'Church',
      cs: 'Kostel',
      de: 'Kirche',
      fr: 'Église',
      es: 'Iglesia',
      it: 'Chiesa',
      pl: 'Kościół'
    },
    keywords: ['church', 'churches', 'kostel', 'kostely', 'kirche', 'kirchen', 'église', 'églises', 'iglesia', 'chiesa', 'kościół'],
    icon: Church,
    color: '#7F8C8D',
    osmTag: 'amenity=place_of_worship',
    minZoom: 18,
    descKey: 'Places of worship'
  },
  { 
    nameKey: 'gym',
    translations: {
      en: 'Gym',
      cs: 'Posilovna',
      de: 'Fitnessstudio',
      fr: 'Salle de sport',
      es: 'Gimnasio',
      it: 'Palestra',
      pl: 'Siłownia'
    },
    keywords: ['gym', 'gyms', 'fitness', 'posilovna', 'fitnessstudio', 'gimnasio', 'palestra', 'siłownia'],
    icon: Dumbbell,
    color: '#E74C3C',
    osmTag: 'leisure=fitness_centre',
    minZoom: 18,
    descKey: 'Fitness centers'
  },
  { 
    nameKey: 'cinema',
    translations: {
      en: 'Cinema',
      cs: 'Kino',
      de: 'Kino',
      fr: 'Cinéma',
      es: 'Cine',
      it: 'Cinema',
      pl: 'Kino'
    },
    keywords: ['cinema', 'cinemas', 'movie', 'movies', 'kino', 'cine', 'cinéma', 'film'],
    icon: Film,
    color: '#9B59B6',
    osmTag: 'amenity=cinema',
    minZoom: 18,
    descKey: 'Movie theaters'
  },
  { 
    nameKey: 'car_service',
    translations: {
      en: 'Car Service',
      cs: 'Autoservis',
      de: 'Autowerkstatt',
      fr: 'Garage',
      es: 'Taller',
      it: 'Officina',
      pl: 'Warsztat'
    },
    keywords: ['car service', 'repair', 'autoservis', 'werkstatt', 'autowerkstatt', 'taller', 'officina', 'warsztat', 'garage'],
    icon: Wrench,
    color: '#E67E22',
    osmTag: 'shop=car_repair',
    minZoom: 18,
    descKey: 'Auto repair shops'
  },
  { 
    nameKey: 'post_office',
    translations: {
      en: 'Post Office',
      cs: 'Pošta',
      de: 'Postamt',
      fr: 'Bureau de poste',
      es: 'Correos',
      it: 'Ufficio postale',
      pl: 'Poczta'
    },
    keywords: ['post', 'post office', 'pošta', 'postamt', 'correos', 'bureau de poste', 'ufficio postale', 'poczta'],
    icon: Mail,
    color: '#F39C12',
    osmTag: 'amenity=post_office',
    minZoom: 18,
    descKey: 'Postal services'
  },
  { 
    nameKey: 'bar',
    translations: {
      en: 'Bar',
      cs: 'Bar',
      de: 'Bar',
      fr: 'Bar',
      es: 'Bar',
      it: 'Bar',
      pl: 'Bar'
    },
    keywords: ['bar', 'bars', 'pub', 'pubs', 'hospoda', 'kneipe', 'pivnice'],
    icon: Beer,
    color: '#D68910',
    osmTag: 'amenity=bar',
    minZoom: 18,
    descKey: 'Bars and pubs'
  },
  { 
    nameKey: 'police',
    translations: {
      en: 'Police',
      cs: 'Policie',
      de: 'Polizei',
      fr: 'Police',
      es: 'Policía',
      it: 'Polizia',
      pl: 'Policja'
    },
    keywords: ['police', 'policie', 'polizei', 'policía', 'polizia', 'policja'],
    icon: ShieldAlert,
    color: '#2C3E50',
    osmTag: 'amenity=police',
    minZoom: 18,
    descKey: 'Police stations'
  },
  { 
    nameKey: 'fire_station',
    translations: {
      en: 'Fire Station',
      cs: 'Hasičská stanice',
      de: 'Feuerwehr',
      fr: 'Caserne de pompiers',
      es: 'Estación de bomberos',
      it: 'Caserma dei pompieri',
      pl: 'Straż pożarna'
    },
    keywords: ['fire station', 'hasičská', 'hasiči', 'feuerwehr', 'bomberos', 'pompiers', 'straż pożarna'],
    icon: Flame,
    color: '#E74C3C',
    osmTag: 'amenity=fire_station',
    minZoom: 18,
    descKey: 'Fire departments'
  },
  { 
    nameKey: 'dentist',
    translations: {
      en: 'Dentist',
      cs: 'Zubař',
      de: 'Zahnarzt',
      fr: 'Dentiste',
      es: 'Dentista',
      it: 'Dentista',
      pl: 'Dentysta'
    },
    keywords: ['dentist', 'dentists', 'zubař', 'zubaři', 'zahnarzt', 'dentiste', 'dentista', 'dentysta'],
    icon: Cross,
    color: '#16A085',
    osmTag: 'amenity=dentist',
    minZoom: 18,
    descKey: 'Dental clinics'
  },
  { 
    nameKey: 'veterinary',
    translations: {
      en: 'Veterinary',
      cs: 'Veterinář',
      de: 'Tierarzt',
      fr: 'Vétérinaire',
      es: 'Veterinario',
      it: 'Veterinario',
      pl: 'Weterynarz'
    },
    keywords: ['vet', 'veterinary', 'veterinář', 'tierarzt', 'vétérinaire', 'veterinario', 'weterynarz'],
    icon: Paw,
    color: '#27AE60',
    osmTag: 'amenity=veterinary',
    minZoom: 18,
    descKey: 'Animal hospitals'
  },
  { 
    nameKey: 'bakery',
    translations: {
      en: 'Bakery',
      cs: 'Pekárna',
      de: 'Bäckerei',
      fr: 'Boulangerie',
      es: 'Panadería',
      it: 'Panetteria',
      pl: 'Piekarnia'
    },
    keywords: ['bakery', 'bakeries', 'pekárna', 'pekárny', 'bäckerei', 'boulangerie', 'panadería', 'panetteria', 'piekarnia'],
    icon: Sandwich,
    color: '#D4A574',
    osmTag: 'shop=bakery',
    minZoom: 18,
    descKey: 'Bakeries and bread shops'
  },
  
  // Zoom 15+ (parking)
  { 
    nameKey: 'parking',
    translations: {
      en: 'Parking',
      cs: 'Parkování',
      de: 'Parkplatz',
      fr: 'Parking',
      es: 'Estacionamiento',
      it: 'Parcheggio',
      pl: 'Parking'
    },
    keywords: ['parking', 'parkování', 'parken', 'parkplatz', 'estacionamiento', 'parcheggio', 'parkowanie'],
    icon: ParkingCircle,
    color: '#3498DB',
    osmTag: 'amenity=parking',
    minZoom: 15,
    descKey: 'Parking lots and garages'
  },
  
  // Zoom 13+ (travel/infrastructure)
  { 
    nameKey: 'gas_station',
    translations: {
      en: 'Gas Station',
      cs: 'Čerpací stanice',
      de: 'Tankstelle',
      fr: 'Station-service',
      es: 'Gasolinera',
      it: 'Stazione di servizio',
      pl: 'Stacja paliw'
    },
    keywords: ['gas', 'fuel', 'petrol', 'benzín', 'tankstelle', 'essence', 'gasolina', 'benzina', 'stacja paliw', 'čerpací'],
    icon: Fuel,
    color: '#E74C3C',
    osmTag: 'amenity=fuel',
    minZoom: 13,
    descKey: 'Fuel stations'
  },
  { 
    nameKey: 'ev_charging',
    translations: {
      en: 'EV Charging',
      cs: 'Nabíjecí stanice',
      de: 'Ladestation',
      fr: 'Borne de recharge',
      es: 'Estación de carga',
      it: 'Stazione di ricarica',
      pl: 'Stacja ładowania'
    },
    keywords: ['charging', 'electric', 'ev', 'nabíjení', 'nabíjecí', 'ladestation', 'recarga', 'ładowanie', 'borne de recharge'],
    icon: Plug,
    color: '#27AE60',
    osmTag: 'amenity=charging_station',
    minZoom: 13,
    descKey: 'Electric vehicle charging'
  },
  { 
    nameKey: 'speed_camera',
    translations: {
      en: 'Speed Camera',
      cs: 'Rychlostní radar',
      de: 'Blitzer',
      fr: 'Radar',
      es: 'Radar de velocidad',
      it: 'Autovelox',
      pl: 'Fotoradar'
    },
    keywords: ['speed camera', 'radar', 'rychlost', 'blitzer', 'geschwindigkeit', 'velocidad', 'velocità', 'prędkość', 'fotoradar'],
    icon: Camera,
    color: '#C0392B',
    osmTag: 'highway=speed_camera',
    minZoom: 13,
    descKey: 'Speed enforcement cameras'
  },
  { 
    nameKey: 'train_station',
    translations: {
      en: 'Train Station',
      cs: 'Vlakové nádraží',
      de: 'Bahnhof',
      fr: 'Gare',
      es: 'Estación de tren',
      it: 'Stazione ferroviaria',
      pl: 'Dworzec kolejowy'
    },
    keywords: ['train', 'railway', 'vlak', 'nádraží', 'bahnhof', 'gare', 'estación', 'stazione', 'dworzec'],
    icon: Train,
    color: '#34495E',
    osmTag: 'railway=station',
    minZoom: 13,
    descKey: 'Railway stations'
  },
  { 
    nameKey: 'bus_stop',
    translations: {
      en: 'Bus Stop',
      cs: 'Autobusová zastávka',
      de: 'Bushaltestelle',
      fr: 'Arrêt de bus',
      es: 'Parada de autobús',
      it: 'Fermata dell\'autobus',
      pl: 'Przystanek autobusowy'
    },
    keywords: ['bus', 'autobus', 'zastávka', 'bushaltestelle', 'arrêt', 'parada', 'fermata', 'przystanek'],
    icon: Bus,
    color: '#F39C12',
    osmTag: 'highway=bus_stop',
    minZoom: 15,
    descKey: 'Public bus stops'
  }
];

// Get category name in current language
export function getCategoryName(category, language = 'en') {
  return category.translations[language] || category.translations['en'];
}

// Function to filter categories by query
export function filterCategories(query, language = 'en') {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  
  return POI_CATEGORIES.filter(cat => {
    // Check if query matches any keyword
    const keywordMatch = cat.keywords.some(keyword => keyword.toLowerCase().includes(q));
    
    // Check if query matches translated name
    const nameMatch = Object.values(cat.translations).some(name => 
      name.toLowerCase().includes(q)
    );
    
    return keywordMatch || nameMatch;
  });
}