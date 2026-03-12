/**
 * API Configuration
 * Centralizes all API keys and constants
 */

export const API_CONFIG = {
  ORS: {
    BASE_URL: 'https://api.openrouteservice.org/v2',
    API_KEY: import.meta.env.VITE_ORS_API_KEY,
    PROFILE_MAP: {
      'car_fast_traffic': 'driving-car',
      'car_fast': 'driving-car',
      'bike_road': 'cycling-regular',
      'foot_fast': 'foot-hiking'
    }
  },
  OSRM: {
    BASE_URL: 'https://router.project-osrm.org/route/v1',
    PROFILE_MAP: {
      'car_fast': 'driving',
      'bike': 'cycling',
      'pedestrian': 'foot'
    }
  },
  TILES: {
    OSM: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  }
};

export const API_CONFIG = {
  // ... other configs
  OSRM: {
    BASE_URL: 'https://router.project-osrm.org/route/v1'
  }
};