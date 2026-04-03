/**
 * OsrmPlugin.js — JS-side Capacitor wrapper for the native OsrmPlugin.
 *
 * Provides a clean API over the native Android OSRM service.
 * On non-Android platforms (browser, iOS), all methods return safe no-ops.
 *
 * Usage:
 *   import OsrmPlugin from '@/plugins/OsrmPlugin';
 *   const { running } = await OsrmPlugin.getStatus();
 *   await OsrmPlugin.startOsrm({ dataPath: '/data/...' });
 */

import { registerPlugin, Capacitor } from '@capacitor/core';

const PLUGIN_NAME = 'OsrmPlugin';

// Register the native plugin bridge
// Falls back to a no-op web implementation if not running on Android
const NativePlugin = registerPlugin(PLUGIN_NAME, {
  web: () => import('./OsrmPluginWeb').then(m => new m.OsrmPluginWeb()),
});

class OsrmPluginWrapper {
  constructor() {
    this._available = Capacitor.isPluginAvailable(PLUGIN_NAME);
  }

  /** Returns true if the native plugin is wired up (Android only) */
  get isAvailable() { return this._available; }

  /**
   * Start the local OSRM server with the given .osrm data file.
   * @param {Object} options
   * @param {string} options.dataPath - Absolute path to the .osrm file on device storage
   * @returns {Promise<{ started: boolean, port: number }>}
   */
  async startOsrm({ dataPath }) {
    if (!this._available) return { started: false, port: 0 };
    return NativePlugin.startOsrm({ dataPath });
  }

  /**
   * Stop the local OSRM server.
   * @returns {Promise<{ stopped: boolean }>}
   */
  async stopOsrm() {
    if (!this._available) return { stopped: false };
    return NativePlugin.stopOsrm();
  }

  /**
   * Check if the OSRM server is currently running.
   * @returns {Promise<{ running: boolean, port: number, url: string|null }>}
   */
  async getStatus() {
    if (!this._available) return { running: false, port: 0, url: null };
    return NativePlugin.getStatus();
  }

  /**
   * Download OSRM routing data for a country from the tile server.
   * Progress is emitted as 'osrmDownloadProgress' events.
   *
   * @param {Object} options
   * @param {string} options.url          - Download URL for the .tar.gz archive
   * @param {string} options.countryCode  - e.g. 'CZ'
   * @param {Function} options.onProgress - Called with { countryCode, pct: 0-100 }
   * @returns {Promise<{ dataPath: string, countryCode: string }>}
   */
  async downloadData({ url, countryCode, onProgress }) {
    if (!this._available) throw new Error('OSRM native plugin not available on this platform');

    let listenerHandle = null;
    if (onProgress) {
      listenerHandle = await NativePlugin.addListener('osrmDownloadProgress', (data) => {
        if (data.countryCode === countryCode) onProgress(data);
      });
    }

    try {
      const result = await NativePlugin.downloadData({ url, countryCode });
      return result;
    } finally {
      listenerHandle?.remove();
    }
  }

  /**
   * Download a file using OkHttp and write it to the Android app's private files directory.
   * Progress is emitted as 'downloadProgress' events.
   *
   * @param {Object} options
   * @param {string} options.url          - Download URL for the file
   * @param {string} options.filename     - Output filename
   * @param {Function} options.onProgress - Called with { filename, pct: 0-100 }
   * @returns {Promise<{ filePath: string, filename: string }>}
   */
  async downloadFile({ url, filename, onProgress }) {
    if (!this._available) throw new Error('OSRM native plugin not available on this platform');

    let listenerHandle = null;
    if (onProgress) {
      listenerHandle = await NativePlugin.addListener('downloadProgress', (data) => {
        if (data.filename === filename) onProgress(data);
      });
    }

    try {
      const result = await NativePlugin.downloadFile({ url, filename });
      return result;
    } finally {
      listenerHandle?.remove();
    }
  }
}

const OsrmPlugin = new OsrmPluginWrapper();
export default OsrmPlugin;
