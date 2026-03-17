/**
 * Mapy.cz POI Service
 * Fetches POIs with images and descriptions from Mapy.cz API
 * Handles smart zoom-based filtering for "main" vs all POIs
 */

const MAPY_API_KEY = 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';

// Mapy.cz POI category IDs (these are Mapy's internal category codes)
// https://api.mapy.com/doc/#api-Places
export const MAPY_POI_CATEGORIES = {
  // Food & Dining
  restaurants: 101,
  cafes: 102,
  bars: 103,
  fastFood: 104,
  pubs: 105,
  
  // Accommodation
  hotels: 201,
  hostels: 202,
  camping: 203,
  
  // Shopping
  supermarkets: 301,
  shops: 302,
  malls: 303,
  bakeries: 304,
  
  // Services
  banks: 401,
  atms: 402,
  postOffices: 403,
  pharmacies: 404,
  
  // Healthcare
  hospitals: 501,
  clinics: 502,
  dentists: 503,
  veterinarians: 504,
  
  // Education
  schools: 601,
  universities: 602,
  libraries: 603,
  kindergartens: 604,
  
  // Transport
  gasStations: 701,
  parking: 702,
  evCharging: 703,
  trainStations: 704,
  busStops: 705,
  airports: 706,
  
  // Tourism
  museums: 801,
  castles: 802,
  churches: 803,
  monuments: 804,
  viewpoints: 805,
  
  // Leisure
  parks: 901,
  playgrounds: 902,
  gyms: 903,
  cinemas: 904,
  swimmingPools: 905,
  
  // Emergency
  police: 1001,
  fireStations: 1002,
  
  // Facilities
  toilets: 1101,
  
  // Other
  carRepair: 1201,
  speedCameras: 1202,
};

/**
 * Search for POIs in a bounding box using Mapy.cz Places API
 * @param {Object} bounds - { south, west, north, east }
 * @param {number} category - Mapy.cz category ID
 * @param {number} limit - Max results (auto-adjusted by zoom)
 * @param {string} lang - Language code
 */
export async function searchPOIsInBounds(bounds, category, limit = 100, lang = 'en') {
  const { south, west, north, east } = bounds;
  
  // Mapy.cz Places API endpoint
  const url = `https://api.mapy.com/v1/places?apikey=${MAPY_API_KEY}&bbox=${west},${south},${east},${north}&limit=${limit}&lang=${lang}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mapy.cz API error: ${response.status}`);
    }
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching POIs from Mapy.cz:', error);
    return [];
  }
}

/**
 * Search for POIs near a point using Mapy.cz Suggest API (better for large areas)
 * @param {Object} center - { lat, lng }
 * @param {string} query - Search query (e.g., "school", "restaurant")
 * @param {number} radius - Search radius in meters
 * @param {number} limit - Max results
 * @param {string} lang - Language code
 */
export async function searchPOIsNearPoint(center, query, radius = 50000, limit = 50, lang = 'en') {
  const url = `https://api.mapy.com/v1/suggest?apikey=${MAPY_API_KEY}&query=${encodeURIComponent(query)}&lat=${center.lat}&lon=${center.lng}&radius=${radius}&limit=${limit}&lang=${lang}&category=poi`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mapy.cz API error: ${response.status}`);
    }
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching POIs from Mapy.cz:', error);
    return [];
  }
}

/**
 * Get detailed information about a place including images
 * @param {string} placeId - Mapy.cz place ID
 * @param {string} lang - Language code
 */
export async function getPlaceDetails(placeId, lang = 'en') {
  const url = `https://api.mapy.com/v1/places/${placeId}?apikey=${MAPY_API_KEY}&lang=${lang}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mapy.cz API error: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching place details from Mapy.cz:', error);
    return null;
  }
}

/**
 * Get photos for a place from Mapy.cz
 * @param {string} placeId - Mapy.cz place ID
 */
export async function getPlacePhotos(placeId) {
  const url = `https://api.mapy.com/v1/places/${placeId}/photos?apikey=${MAPY_API_KEY}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mapy.cz API error: ${response.status}`);
    }
    const data = await response.json();
    return data.photos || [];
  } catch (error) {
    console.error('Error fetching place photos from Mapy.cz:', error);
    return [];
  }
}

/**
 * Smart POI search that adapts to zoom level
 * At low zoom: fetches "main" POIs using wide-area search
 * At high zoom: fetches all POIs in bounds
 * 
 * @param {Object} params - Search parameters
 * @param {Object} params.bounds - Map bounds { south, west, north, east }
 * @param {Object} params.center - Map center { lat, lng }
 * @param {number} params.zoom - Current zoom level
 * @param {Object} params.category - Category object from POICategories
 * @param {string} params.lang - Language code
 */
export async function smartPOISearch({ bounds, center, zoom, category, lang = 'en' }) {
  const { south, west, north, east } = bounds;
  const { minZoom, detailZoom, importance, name } = category;
  
  // Don't search if below minimum zoom
  if (zoom < minZoom) {
    return [];
  }
  
  // Calculate the visible area in km²
  const latDiff = north - south;
  const lngDiff = east - west;
  const areaSize = latDiff * lngDiff * 111 * 111; // Rough km² estimate
  
  // Determine search strategy based on zoom and area
  const isLowZoom = zoom < detailZoom;
  const isLargeArea = areaSize > 10000; // More than 10,000 km²
  
  let pois = [];
  
  if (isLargeArea || zoom < 12) {
    // STRATEGY 1: For very large areas, use point-based search with multiple centers
    // This ensures POIs are distributed across the visible area
    pois = await searchDistributedPOIs(bounds, category, zoom, lang);
  } else if (isLowZoom) {
    // STRATEGY 2: For medium zoom, use bounds search with importance filter
    pois = await searchPOIsInBoundsFiltered(bounds, category, zoom, lang);
  } else {
    // STRATEGY 3: For high zoom, get all POIs in bounds
    pois = await searchPOIsInBounds(bounds, null, getMaxPOIsForZoom(zoom), lang);
  }
  
  // Filter and enhance results
  return pois
    .filter(poi => filterPOIByImportance(poi, category, zoom))
    .slice(0, getMaxPOIsForZoom(zoom));
}

/**
 * Search POIs distributed across the visible area
 * Uses a grid-based approach to ensure coverage
 */
async function searchDistributedPOIs(bounds, category, zoom, lang) {
  const { south, west, north, east } = bounds;
  const pois = [];
  const seen = new Set();
  
  // Create a 3x3 grid of search points
  const latStep = (north - south) / 3;
  const lngStep = (east - west) / 3;
  
  const searchPoints = [
    { lat: south + latStep, lng: west + lngStep },
    { lat: south + latStep, lng: west + 2 * lngStep },
    { lat: south + 2 * latStep, lng: west + lngStep },
    { lat: south + 2 * latStep, lng: west + 2 * lngStep },
    { lat: (north + south) / 2, lng: (east + west) / 2 }, // Center
  ];
  
  // Calculate radius to cover the grid cell
  const radius = Math.max(50000, Math.min(200000, (north - south) * 111000 / 3));
  
  // Search from each point
  const queries = getCategorySearchQueries(category);
  const limit = Math.max(5, Math.min(20, getMaxPOIsForZoom(zoom) / searchPoints.length));
  
  // Use Promise.all for parallel requests
  const results = await Promise.all(
    searchPoints.flatMap(point => 
      queries.map(query => 
        searchPOIsNearPoint(point, query, radius, limit, lang)
          .catch(() => [])
      )
    )
  );
  
  // Merge and deduplicate
  results.flat().forEach(poi => {
    const id = poi.id || `${poi.position?.lat}-${poi.position?.lon}`;
    if (id && !seen.has(id)) {
      seen.add(id);
      pois.push(normalizeMapyPOI(poi, category));
    }
  });
  
  return pois;
}

/**
 * Search POIs in bounds with importance filtering
 */
async function searchPOIsInBoundsFiltered(bounds, category, zoom, lang) {
  const queries = getCategorySearchQueries(category);
  const limit = getMaxPOIsForZoom(zoom);
  
  const results = await Promise.all(
    queries.map(query => 
      searchPOIsNearPoint(
        { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 },
        query,
        50000,
        limit,
        lang
      ).catch(() => [])
    )
  );
  
  const pois = [];
  const seen = new Set();
  
  results.flat().forEach(poi => {
    const id = poi.id || `${poi.position?.lat}-${poi.position?.lon}`;
    if (id && !seen.has(id)) {
      seen.add(id);
      pois.push(normalizeMapyPOI(poi, category));
    }
  });
  
  return pois;
}

/**
 * Get search queries for a category
 * Returns multiple query variations for better coverage
 */
function getCategorySearchQueries(category) {
  // Use keywords for search
  const keywords = category.keywords || [];
  
  // Prioritize the first few keywords
  const queries = keywords.slice(0, 3);
  
  // Always include the category name
  if (!queries.includes(category.name.toLowerCase())) {
    queries.unshift(category.name.toLowerCase());
  }
  
  return queries;
}

/**
 * Normalize Mapy.cz POI to standard format
 */
function normalizeMapyPOI(poi, category) {
  const pos = poi.position || poi.regionalStructure?.[0] || {};
  
  return {
    id: poi.id || `${pos.lat}-${pos.lon}`,
    lat: pos.lat,
    lon: pos.lon || pos.lng,
    lng: pos.lon || pos.lng,
    name: poi.name || poi.label || category.name,
    address: poi.location || poi.regionalStructure?.map(r => r.name).join(', ') || '',
    category: category.name,
    icon: category.icon,
    color: category.color,
    // Mapy.cz specific fields
    mapyId: poi.id,
    source: poi.source,
    types: poi.types,
    // Photos and description if available
    photo: poi.photo || null,
    description: poi.description || null,
    rating: poi.rating || null,
    // Raw data for additional processing
    rawData: poi
  };
}

/**
 * Filter POI by importance based on zoom level
 */
function filterPOIByImportance(poi, category, zoom) {
  // At detail zoom, show everything
  if (zoom >= (category.detailZoom || 16)) return true;
  
  // Check if POI has importance indicators
  const poiData = poi.rawData || poi;
  
  // POIs with ratings are usually more popular
  if (poiData.rating || poi.rating) return true;
  
  // POIs with photos are usually notable
  if (poiData.photo || poi.photo) return true;
  
  // POIs with types indicating importance
  if (poiData.types) {
    const types = Array.isArray(poiData.types) ? poiData.types : [poiData.types];
    if (types.some(t => ['major', 'popular', 'featured'].includes(t?.toLowerCase?.()))) {
      return true;
    }
  }
  
  // At medium zoom, include based on category importance
  if (zoom >= 14 && category.importance === 'high') return true;
  if (zoom >= 15 && category.importance === 'medium') return true;
  
  // At low zoom, only high importance
  if (zoom < 14 && category.importance === 'high') return true;
  
  return category.importance === 'high';
}

/**
 * Get maximum number of POIs for a zoom level
 */
function getMaxPOIsForZoom(zoom) {
  if (zoom < 8) return 20;
  if (zoom < 10) return 30;
  if (zoom < 12) return 50;
  if (zoom < 14) return 100;
  if (zoom < 16) return 200;
  return 500;
}

/**
 * Fetch place image and description from Mapy.cz detail API
 * @param {Object} poi - POI object
 * @param {string} lang - Language code
 */
export async function enrichPOIWithDetails(poi, lang = 'en') {
  if (!poi.mapyId && !poi.id) return poi;
  
  try {
    const placeId = poi.mapyId || poi.id;
    
    // Fetch place details
    const details = await getPlaceDetails(placeId, lang);
    
    if (details) {
      return {
        ...poi,
        description: details.description || poi.description,
        photo: details.photo || details.image || poi.photo,
        photos: details.photos || [],
        rating: details.rating || poi.rating,
        openingHours: details.openingHours,
        phone: details.phone,
        website: details.website,
        email: details.email,
        priceLevel: details.priceLevel,
        // Additional amenities
        amenities: details.amenities || {},
      };
    }
    
    // Try to fetch photos separately
    const photos = await getPlacePhotos(placeId);
    if (photos.length > 0) {
      return {
        ...poi,
        photos,
        photo: photos[0]?.url || photos[0]?.thumbnail || poi.photo,
      };
    }
  } catch (error) {
    console.warn('Could not enrich POI details:', error);
  }
  
  return poi;
}

/**
 * Search for places using Mapy.cz suggest API with POI focus
 * This is useful for getting photos and descriptions
 */
export async function searchPlacesWithDetails(query, center, lang = 'en', limit = 10) {
  const near = center ? `&lat=${center.lat}&lon=${center.lng}&radius=50000` : '';
  const url = `https://api.mapy.com/v1/suggest?apikey=${MAPY_API_KEY}&query=${encodeURIComponent(query)}&lang=${lang}&limit=${limit}${near}&category=poi`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mapy.cz API error: ${response.status}`);
    }
    const data = await response.json();
    
    // Enrich results with details
    const enrichedResults = await Promise.all(
      (data.items || []).map(async (item) => {
        const pos = item.position || item.regionalStructure?.[0] || {};
        
        // Try to get additional details
        if (item.id) {
          try {
            const details = await getPlaceDetails(item.id, lang);
            return {
              id: item.id,
              name: item.name || item.label,
              lat: pos.lat,
              lon: pos.lon || pos.lng,
              lng: pos.lon || pos.lng,
              address: item.location || '',
              description: details?.description || '',
              photo: details?.photo || details?.image || item.photo || null,
              photos: details?.photos || [],
              rating: details?.rating || null,
              openingHours: details?.openingHours,
              phone: details?.phone,
              website: details?.website,
            };
          } catch {
            // Return basic info if details fail
            return {
              id: item.id,
              name: item.name || item.label,
              lat: pos.lat,
              lon: pos.lon || pos.lng,
              lng: pos.lon || pos.lng,
              address: item.location || '',
            };
          }
        }
        
        return {
          id: item.id,
          name: item.name || item.label,
          lat: pos.lat,
          lon: pos.lon || pos.lng,
          lng: pos.lon || pos.lng,
          address: item.location || '',
        };
      })
    );
    
    return enrichedResults;
  } catch (error) {
    console.error('Error searching places:', error);
    return [];
  }
}

export default {
  searchPOIsInBounds,
  searchPOIsNearPoint,
  getPlaceDetails,
  getPlacePhotos,
  smartPOISearch,
  enrichPOIWithDetails,
  searchPlacesWithDetails,
  MAPY_POI_CATEGORIES,
};
