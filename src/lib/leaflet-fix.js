// Leaflet marker icon fix for React - this file can be imported once at app startup
import L from 'leaflet';

// Fix for Leaflet marker icons in React
// This addresses the issue where marker icons don't load properly
export const fixLeafletIcons = () => {
  // Delete the _getIconUrl property from the prototype
  // Using bracket notation to avoid TypeScript issues
  delete L.Icon.Default.prototype['_getIconUrl'];
  
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
};

export default fixLeafletIcons;
