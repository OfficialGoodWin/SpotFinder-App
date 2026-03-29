/**
 * OsrmPluginWeb.js — No-op web implementation of OsrmPlugin.
 * Used automatically by Capacitor when running in browser or on iOS.
 */

import { WebPlugin } from '@capacitor/core';

export class OsrmPluginWeb extends WebPlugin {
  async startOsrm()    { return { started: false, port: 0 }; }
  async stopOsrm()     { return { stopped: false }; }
  async getStatus()    { return { running: false, port: 0, url: null }; }
  async downloadData() { throw new Error('OSRM native download requires Android'); }
}
