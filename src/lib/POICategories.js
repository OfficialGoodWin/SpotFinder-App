// Category name translations
const CATEGORY_NAMES = {
  Schools:       { cs:'Školy',       pl:'Szkoły',       de:'Schulen',        sk:'Školy',        uk:'Школи',        ru:'Школы',        fr:'Écoles',       es:'Escuelas',    it:'Scuole',      hu:'Iskolák',    ro:'Școli',     bg:'Училища' },
  Restaurants:   { cs:'Restaurace',  pl:'Restauracje',  de:'Restaurants',    sk:'Reštaurácie',  uk:'Ресторани',    ru:'Рестораны',    fr:'Restaurants',  es:'Restaurantes',it:'Ristoranti',  hu:'Éttermek',   ro:'Restaurante',bg:'Ресторанти' },
  Cafes:         { cs:'Kavárny',     pl:'Kawiarnie',    de:'Cafés',          sk:'Kaviarne',     uk:'Кафе',         ru:'Кафе',         fr:'Cafés',        es:'Cafeterías',  it:'Bar',         hu:'Kávézók',    ro:'Cafenele',  bg:'Кафета' },
  Shops:         { cs:'Obchody',     pl:'Sklepy',       de:'Geschäfte',      sk:'Obchody',      uk:'Магазини',     ru:'Магазины',     fr:'Magasins',     es:'Tiendas',     it:'Negozi',      hu:'Üzletek',    ro:'Magazine',  bg:'Магазини' },
  Supermarkets:  { cs:'Supermarkety',pl:'Supermarkety', de:'Supermärkte',    sk:'Supermarkety', uk:'Супермаркети', ru:'Супермаркеты', fr:'Supermarchés', es:'Supermercados',it:'Supermercati',hu:'Szupermarketek',ro:'Supermarketuri',bg:'Супермаркети' },
  Toilets:       { cs:'Toalety',     pl:'Toalety',      de:'Toiletten',      sk:'Toalety',      uk:'Туалети',      ru:'Туалеты',      fr:'Toilettes',    es:'Baños',       it:'Bagni',       hu:'Mosdók',     ro:'Toalete',   bg:'Тоалетни' },
  Banks:         { cs:'Banky',       pl:'Banki',        de:'Banken',         sk:'Banky',        uk:'Банки',        ru:'Банки',        fr:'Banques',      es:'Bancos',      it:'Banche',      hu:'Bankok',     ro:'Bănci',     bg:'Банки' },
  ATMs:          { cs:'Bankomaty',   pl:'Bankomaty',    de:'Geldautomaten',  sk:'Bankomaty',    uk:'Банкомати',    ru:'Банкоматы',    fr:'Distributeurs',es:'Cajeros',     it:'Bancomat',    hu:'ATM-ek',     ro:'Bancomate',  bg:'Банкомати' },
  Pharmacies:    { cs:'Lékárny',     pl:'Apteki',       de:'Apotheken',      sk:'Lekárne',      uk:'Аптеки',       ru:'Аптеки',       fr:'Pharmacies',   es:'Farmacias',   it:'Farmacie',    hu:'Gyógyszertárak',ro:'Farmacii',  bg:'Аптеки' },
  Hospitals:     { cs:'Nemocnice',   pl:'Szpitale',     de:'Krankenhäuser',  sk:'Nemocnice',    uk:'Лікарні',      ru:'Больницы',     fr:'Hôpitaux',     es:'Hospitales',  it:'Ospedali',    hu:'Kórházak',   ro:'Spitale',   bg:'Болници' },
  Libraries:     { cs:'Knihovny',    pl:'Biblioteki',   de:'Bibliotheken',   sk:'Knižnice',     uk:'Бібліотеки',   ru:'Библиотеки',   fr:'Bibliothèques',es:'Bibliotecas', it:'Biblioteche', hu:'Könyvtárak', ro:'Biblioteci', bg:'Библиотеки' },
  Playgrounds:   { cs:'Hřiště',      pl:'Place zabaw',  de:'Spielplätze',    sk:'Ihriská',      uk:'Ігрові майданчики',ru:'Детские площадки',fr:'Aires de jeux',es:'Parques',   it:'Parchi giochi',hu:'Játszóterek',ro:'Locuri de joacă',bg:'Детски площадки' },
  Hotels:        { cs:'Hotely',      pl:'Hotele',       de:'Hotels',         sk:'Hotely',       uk:'Готелі',       ru:'Отели',        fr:'Hôtels',       es:'Hoteles',     it:'Hotel',       hu:'Szállodák',  ro:'Hoteluri',  bg:'Хотели' },
  Museums:       { cs:'Muzea',       pl:'Muzea',        de:'Museen',         sk:'Múzeá',        uk:'Музеї',        ru:'Музеи',        fr:'Musées',       es:'Museos',      it:'Musei',       hu:'Múzeumok',   ro:'Muzee',     bg:'Музеи' },
  Castles:       { cs:'Hrady',       pl:'Zamki',        de:'Burgen',         sk:'Hrady',        uk:'Замки',        ru:'Замки',        fr:'Châteaux',     es:'Castillos',   it:'Castelli',    hu:'Várak',      ro:'Castele',   bg:'Замъци' },
  Churches:      { cs:'Kostely',     pl:'Kościoły',     de:'Kirchen',        sk:'Kostoly',      uk:'Церкви',       ru:'Церкви',       fr:'Églises',      es:'Iglesias',    it:'Chiese',      hu:'Templomok',  ro:'Biserici',  bg:'Църкви' },
  Gyms:          { cs:'Posilovny',   pl:'Siłownie',     de:'Fitnessstudios', sk:'Posilňovne',   uk:'Спортзали',    ru:'Спортзалы',    fr:'Salles de sport',es:'Gimnasios', it:'Palestre',    hu:'Edzőtermek', ro:'Săli de sport',bg:'Фитнес зали' },
  Cinemas:       { cs:'Kina',        pl:'Kina',         de:'Kinos',          sk:'Kiná',         uk:'Кінотеатри',   ru:'Кинотеатры',   fr:'Cinémas',      es:'Cines',       it:'Cinema',      hu:'Mozik',      ro:'Cinematografe',bg:'Кина' },
  'Car Service': { cs:'Autoservisy', pl:'Warsztaty',    de:'Werkstätten',    sk:'Autoservisy',  uk:'Автосервіси',  ru:'Автосервисы',  fr:'Garages',      es:'Talleres',    it:'Officine',    hu:'Autószerelők',ro:'Service auto',bg:'Автосервизи' },
  'Post Office': { cs:'Pošty',       pl:'Poczty',       de:'Postämter',      sk:'Pošty',        uk:'Пошти',        ru:'Почты',        fr:'Bureaux de poste',es:'Correos',  it:'Uffici postali',hu:'Posta',     ro:'Poștă',     bg:'Пощи' },
  Bars:          { cs:'Bary',        pl:'Bary',         de:'Bars',           sk:'Bary',         uk:'Бари',         ru:'Бары',         fr:'Bars',         es:'Bares',       it:'Bar',         hu:'Bárok',      ro:'Baruri',    bg:'Барове' },
  Police:        { cs:'Policie',     pl:'Policja',      de:'Polizei',        sk:'Polícia',      uk:'Поліція',      ru:'Полиция',      fr:'Police',       es:'Policía',     it:'Polizia',     hu:'Rendőrség',  ro:'Poliție',   bg:'Полиция' },
  'Fire Station':{ cs:'Hasiči',      pl:'Straż pożarna',de:'Feuerwehr',      sk:'Hasiči',       uk:'Пожежна служба',ru:'Пожарная',   fr:'Pompiers',     es:'Bomberos',    it:'Vigili del fuoco',hu:'Tűzoltók',ro:'Pompieri',  bg:'Пожарна' },
  Dentist:       { cs:'Zubaři',      pl:'Dentyści',     de:'Zahnärzte',      sk:'Zubári',       uk:'Стоматологи',  ru:'Стоматологи',  fr:'Dentistes',    es:'Dentistas',   it:'Dentisti',    hu:'Fogorvosok', ro:'Dentiști',  bg:'Зъболекари' },
  Veterinary:    { cs:'Veterináři',  pl:'Weterynarze',  de:'Tierärzte',      sk:'Veterinári',   uk:'Ветеринари',   ru:'Ветеринары',   fr:'Vétérinaires', es:'Veterinarios',it:'Veterinari',  hu:'Állatorvosok',ro:'Veterinari', bg:'Ветеринари' },
  Bakery:        { cs:'Pekárny',     pl:'Piekarnie',    de:'Bäckereien',     sk:'Pekárne',      uk:'Пекарні',      ru:'Пекарни',      fr:'Boulangeries', es:'Panaderías',  it:'Panetterie',  hu:'Pékségek',   ro:'Brutării',  bg:'Пекарни' },
  Parking:       { cs:'Parkoviště',  pl:'Parkingi',     de:'Parkplätze',     sk:'Parkoviská',   uk:'Парковки',     ru:'Парковки',     fr:'Parkings',     es:'Aparcamientos',it:'Parcheggi',  hu:'Parkolók',   ro:'Parcări',   bg:'Паркинги' },
  'Gas Stations':{ cs:'Čerpací stanice',pl:'Stacje paliw',de:'Tankstellen',  sk:'Čerpacie stanice',uk:'АЗС',      ru:'АЗС',          fr:'Stations-service',es:'Gasolineras',it:'Distributori',hu:'Benzinkutak',ro:'Benzinării', bg:'Бензиностанции' },
  'EV Charging': { cs:'Nabíjecí stanice',pl:'Ładowarki EV',de:'Ladestationen',sk:'Nabíjacie stanice',uk:'Зарядні станції',ru:'Зарядные станции',fr:'Bornes de recharge',es:'Cargadores EV',it:'Colonnine EV',hu:'Töltőpontok',ro:'Stații EV',bg:'Зарядни станции' },
  'Speed Cameras':{ cs:'Radary',     pl:'Fotoradary',   de:'Blitzer',        sk:'Radary',       uk:'Радари',       ru:'Радары',       fr:'Radars',       es:'Radares',     it:'Autovelox',   hu:'Traffipaxok',ro:'Radare',    bg:'Радари' },
  'Train Stations':{ cs:'Vlakové stanice',pl:'Stacje kolejowe',de:'Bahnhöfe',sk:'Železničné stanice',uk:'Залізничні станції',ru:'Ж/Д станции',fr:'Gares',    es:'Estaciones de tren',it:'Stazioni',  hu:'Vasútállomások',ro:'Gări',    bg:'Жп гари' },
  'Bus Stops':   { cs:'Zastávky',    pl:'Przystanki',   de:'Bushaltestellen',sk:'Zastávky',     uk:'Зупинки автобуса',ru:'Автобусные остановки',fr:'Arrêts de bus',es:'Paradas de autobús',it:'Fermate bus',hu:'Buszmegállók',ro:'Stații de autobuz',bg:'Автобусни спирки' },
};

export function getCategoryName(category, language) {
  if (!category) return '';
  if (!language || language === 'en') return category.name;
  return CATEGORY_NAMES[category.name]?.[language] || category.name;
}

// Category descriptions per language
const CATEGORY_DESCS = {
  Schools:       { cs:'Základní školy, gymnázia, univerzity', uk:'Школи, університети' },
  Restaurants:   { cs:'Restaurace a jídlo', uk:'Ресторани та їжа' },
  Cafes:         { cs:'Kavárny a káva', uk:'Кафе та кава' },
};

export function getCategoryDesc(category, language) {
  if (!category) return '';
  if (!language || language === 'en') return category.desc || '';
  return CATEGORY_DESCS[category.name]?.[language] || category.desc || '';
}

export const POI_CATEGORIES = [
  { name: 'Schools', geoapifyCategory: 'education.school', keywords: ['school', 'škola', 'schule', 'école', 'escuela', 'scuola', 'szkoła', 'школа', 'школи'], icon: '🏫', color: '#4A90E2', osmTag: 'amenity=school', minZoom: 14, desc: 'Elementary, high schools, universities' },
  { name: 'Restaurants', geoapifyCategory: 'catering.restaurant', keywords: ['restaurant', 'restaurace', 'food', 'jídlo', 'essen', 'nourriture', 'comida', 'ristorante', 'ресторан', 'ресторани'], icon: '🍽️', color: '#E74C3C', osmTag: 'amenity=restaurant', minZoom: 14, desc: 'Dining and food places' },
  { name: 'Cafes', geoapifyCategory: 'catering.cafe', keywords: ['cafe', 'coffee', 'kavárna', 'kaffee', 'café', 'caffè', 'kawa', 'кафе'], icon: '☕', color: '#8B4513', osmTag: 'amenity=cafe', minZoom: 14, desc: 'Coffee shops and cafes' },
  { name: 'Shops', geoapifyCategory: 'commercial', keywords: ['shop', 'store', 'obchod', 'geschäft', 'magasin', 'tienda', 'negozio', 'sklep', 'магазин'], icon: '🛍️', color: '#9B59B6', osmTag: 'shop', minZoom: 14, desc: 'Retail stores and shops' },
  { name: 'Supermarkets', geoapifyCategory: 'commercial.supermarket', keywords: ['supermarket', 'grocery', 'potraviny', 'lebensmittel', 'alimentación', 'spożywczy', 'супермаркет'], icon: '🏪', color: '#27AE60', osmTag: 'shop=supermarket', minZoom: 14, desc: 'Grocery stores' },
  { name: 'Toilets', geoapifyCategory: 'service.toilets', keywords: ['toilet', 'wc', 'restroom', 'záchod', 'toilette', 'baño', 'bagno', 'toaleta', 'туалет'], icon: '🚻', color: '#3498DB', osmTag: 'amenity=toilets', minZoom: 14, desc: 'Public restrooms' },
  { name: 'Banks', geoapifyCategory: 'service.financial.bank', keywords: ['bank', 'banka', 'banco', 'banque', 'banca', 'банк'], icon: '🏦', color: '#F39C12', osmTag: 'amenity=bank', minZoom: 14, desc: 'Banking services' },
  { name: 'ATMs', geoapifyCategory: 'service.financial.atm', keywords: ['atm', 'bankomat', 'cash', 'geldautomat', 'cajero', 'bancomat', 'банкомат'], icon: '💳', color: '#16A085', osmTag: 'amenity=atm', minZoom: 14, desc: 'Cash machines' },
  { name: 'Pharmacies', geoapifyCategory: 'healthcare.pharmacy', keywords: ['pharmacy', 'lékárna', 'apotheke', 'farmacia', 'pharmacie', 'apteka', 'аптека'], icon: '💊', color: '#E67E22', osmTag: 'amenity=pharmacy', minZoom: 14, desc: 'Medicine and healthcare' },
  { name: 'Hospitals', geoapifyCategory: 'healthcare.hospital', keywords: ['hospital', 'nemocnice', 'krankenhaus', 'hôpital', 'ospedale', 'szpital', 'лікарня', 'больница'], icon: '🏥', color: '#C0392B', osmTag: 'amenity=hospital', minZoom: 14, desc: 'Medical centers' },
  { name: 'Libraries', geoapifyCategory: 'education.library', keywords: ['library', 'knihovna', 'bibliothek', 'bibliothèque', 'biblioteca', 'biblioteka', 'бібліотека'], icon: '📚', color: '#8E44AD', osmTag: 'amenity=library', minZoom: 14, desc: 'Public libraries' },
  { name: 'Playgrounds', geoapifyCategory: 'leisure.playground', keywords: ['playground', 'hřiště', 'spielplatz', 'aire de jeux', 'parque infantil', 'plac zabaw', 'ігровий майданчик'], icon: '🎮', color: '#F1C40F', osmTag: 'leisure=playground', minZoom: 14, desc: 'Children play areas' },
  { name: 'Hotels', geoapifyCategory: 'accommodation.hotel', keywords: ['hotel', 'accommodation', 'ubytování', 'unterkunft', 'hébergement', 'alojamiento', 'nocleg', 'готель'], icon: '🏨', color: '#2980B9', osmTag: 'tourism=hotel', minZoom: 14, desc: 'Hotels and lodging' },
  { name: 'Museums', geoapifyCategory: 'entertainment.museum', keywords: ['museum', 'muzeum', 'musée', 'museo', 'музей'], icon: '🏛️', color: '#34495E', osmTag: 'tourism=museum', minZoom: 14, desc: 'Art and history museums' },
  { name: 'Castles', geoapifyCategory: 'heritage.castle', keywords: ['castle', 'hrad', 'schloss', 'château', 'castello', 'castillo', 'zamek', 'замок'], icon: '🏰', color: '#95A5A6', osmTag: 'historic=castle', minZoom: 14, desc: 'Historic castles and fortresses' },
  { name: 'Churches', geoapifyCategory: 'religion', keywords: ['church', 'kostel', 'kirche', 'église', 'iglesia', 'chiesa', 'kościół', 'церква', 'церковь'], icon: '⛪', color: '#7F8C8D', osmTag: 'amenity=place_of_worship', minZoom: 14, desc: 'Places of worship' },
  { name: 'Gyms', geoapifyCategory: 'sport.fitness', keywords: ['gym', 'fitness', 'posilovna', 'fitnessstudio', 'gimnasio', 'palestra', 'siłownia', 'спортзал'], icon: '💪', color: '#E74C3C', osmTag: 'leisure=fitness_centre', minZoom: 14, desc: 'Fitness centers' },
  { name: 'Cinemas', geoapifyCategory: 'entertainment.cinema', keywords: ['cinema', 'movie', 'kino', 'cine', 'film', 'кінотеатр'], icon: '🎬', color: '#9B59B6', osmTag: 'amenity=cinema', minZoom: 14, desc: 'Movie theaters' },
  { name: 'Car Service', geoapifyCategory: 'service.vehicle.car_repair', keywords: ['car service', 'repair', 'autoservis', 'werkstatt', 'taller', 'officina', 'warsztat', 'автосервіс'], icon: '🔧', color: '#E67E22', osmTag: 'shop=car_repair', minZoom: 14, desc: 'Auto repair shops' },
  { name: 'Post Office', geoapifyCategory: 'service.post_office', keywords: ['post', 'pošta', 'correos', 'bureau de poste', 'ufficio postale', 'poczta', 'пошта'], icon: '📮', color: '#F39C12', osmTag: 'amenity=post_office', minZoom: 14, desc: 'Postal services' },
  { name: 'Bars', geoapifyCategory: 'catering.bar', keywords: ['bar', 'pub', 'hospoda', 'kneipe', 'бар'], icon: '🍺', color: '#D68910', osmTag: 'amenity=bar', minZoom: 14, desc: 'Bars and pubs' },
  { name: 'Police', geoapifyCategory: 'service.police', keywords: ['police', 'policie', 'polizei', 'policía', 'polizia', 'policja', 'поліція', 'полиция'], icon: '👮', color: '#2C3E50', osmTag: 'amenity=police', minZoom: 14, desc: 'Police stations' },
  { name: 'Fire Station', geoapifyCategory: 'service.fire_station', keywords: ['fire station', 'hasičská', 'feuerwehr', 'bomberos', 'pompieri', 'straż pożarna', 'пожежна'], icon: '🚒', color: '#E74C3C', osmTag: 'amenity=fire_station', minZoom: 14, desc: 'Fire departments' },
  { name: 'Dentist', geoapifyCategory: 'healthcare.dentist', keywords: ['dentist', 'zubař', 'zahnarzt', 'dentiste', 'dentista', 'dentysta', 'стоматолог'], icon: '🦷', color: '#16A085', osmTag: 'amenity=dentist', minZoom: 14, desc: 'Dental clinics' },
  { name: 'Veterinary', geoapifyCategory: 'healthcare.vet', keywords: ['vet', 'veterinary', 'veterinář', 'tierarzt', 'veterinario', 'weterynarz', 'ветеринар'], icon: '🐾', color: '#27AE60', osmTag: 'amenity=veterinary', minZoom: 14, desc: 'Animal hospitals' },
  { name: 'Bakery', geoapifyCategory: 'commercial.food_and_drink.bakery', keywords: ['bakery', 'pekárna', 'bäckerei', 'boulangerie', 'panadería', 'panetteria', 'piekarnia', 'пекарня'], icon: '🥖', color: '#D4A574', osmTag: 'shop=bakery', minZoom: 14, desc: 'Bakeries and bread shops' },
  { name: 'Parking', geoapifyCategory: 'parking', keywords: ['parking', 'parkování', 'parken', 'estacionamiento', 'parcheggio', 'parkowanie', 'парковка'], icon: '🅿️', color: '#3498DB', osmTag: 'amenity=parking', minZoom: 15, desc: 'Parking lots and garages' },
  { name: 'Gas Stations', geoapifyCategory: 'service.vehicle.fuel', keywords: ['gas', 'fuel', 'petrol', 'benzín', 'tankstelle', 'essence', 'gasolina', 'benzina', 'stacja paliw', 'азс'], icon: '⛽', color: '#E74C3C', osmTag: 'amenity=fuel', minZoom: 13, desc: 'Fuel stations' },
  { name: 'EV Charging', geoapifyCategory: 'service.vehicle.charging_station', keywords: ['charging', 'electric', 'ev', 'nabíjení', 'ladestation', 'recarga', 'ładowanie', 'зарядна'], icon: '🔌', color: '#27AE60', osmTag: 'amenity=charging_station', minZoom: 13, desc: 'Electric vehicle charging' },
  { name: 'Speed Cameras', geoapifyCategory: null, keywords: ['speed camera', 'radar', 'rychlost', 'geschwindigkeit', 'velocidad', 'velocità', 'prędkość', 'радар'], icon: '📷', color: '#C0392B', osmTag: 'highway=speed_camera', minZoom: 13, desc: 'Speed enforcement cameras' },
  { name: 'Train Stations', geoapifyCategory: 'public_transport.train', keywords: ['train', 'railway', 'vlak', 'bahnhof', 'gare', 'estación', 'stazione', 'dworzec', 'залізнична станція'], icon: '🚆', color: '#34495E', osmTag: 'railway=station', minZoom: 13, desc: 'Railway stations' },
  { name: 'Bus Stops', geoapifyCategory: 'public_transport.bus', keywords: ['bus', 'autobus', 'bushaltestelle', 'arrêt de bus', 'fermata', 'автобус', 'зупинка'], icon: '🚌', color: '#F39C12', osmTag: 'highway=bus_stop', minZoom: 15, desc: 'Public bus stops' },
];

export function filterCategories(query, language) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return POI_CATEGORIES.filter(cat => {
    if (cat.keywords.some(k => k.includes(q))) return true;
    if (cat.name.toLowerCase().includes(q)) return true;
    // Also match translated name
    const translated = CATEGORY_NAMES[cat.name]?.[language];
    if (translated && translated.toLowerCase().includes(q)) return true;
    return false;
  });
}

export const POI_ICON_MAP = {};