import { registerPlugin, Capacitor } from '@capacitor/core';

const PLUGIN_NAME = 'SpotfinderNav';

const NativePlugin = registerPlugin(PLUGIN_NAME, {
  web: () => ({
    downloadRegion: async () => ({ regionId: null, mbtilesPath: null }),
    calculateRoute: async () => ({ geojson: null, maneuvers: [], summary: null }),
    startNavigation: async () => ({ started: false }),
    showNativeMap: async () => ({ shown: false }),
    addListener: async () => ({ remove: () => {} }),
  }),
});

class SpotfinderNavWrapper {
  constructor() {
    this._available = Capacitor.isPluginAvailable(PLUGIN_NAME);
  }

  get isAvailable() {
    return this._available;
  }

  async downloadRegion({ bbox, regionId, onProgress }) {
    if (!this._available) return { regionId: null, mbtilesPath: null };
    let listenerHandle = null;

    if (onProgress) {
      listenerHandle = await NativePlugin.addListener('downloadProgress', data => {
        if (!regionId || data.regionId === regionId) onProgress(data);
      });
    }

    try {
      return await NativePlugin.downloadRegion({ bbox, regionId });
    } finally {
      listenerHandle?.remove?.();
    }
  }

  async calculateRoute({ points, osrmRegionPath }) {
    if (!this._available) return { geojson: null, maneuvers: [], summary: null };
    return NativePlugin.calculateRoute({ points, osrmRegionPath });
  }

  async startNavigation({ routeGeoJson }) {
    if (!this._available) return { started: false };
    return NativePlugin.startNavigation({ routeGeoJson });
  }

  async showNativeMap({ mbtilesPath }) {
    if (!this._available) return { shown: false };
    return NativePlugin.showNativeMap({ mbtilesPath });
  }
}

const SpotfinderNavPlugin = new SpotfinderNavWrapper();
export default SpotfinderNavPlugin;
