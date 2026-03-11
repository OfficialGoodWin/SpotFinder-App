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
  TILES: {
    OSM: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  }
};
