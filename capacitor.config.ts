import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.spotfinder.app',
  appName: 'spotfinder',
  webDir: 'dist',
  server: {
    allowNavigation: ['spot-finder-app.vercel.app']
  }
};

export default config;
