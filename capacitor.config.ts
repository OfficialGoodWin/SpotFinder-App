import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.spotfinder.app',
  appName: 'spotfinder',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'spot-finder-app.vercel.app',
      'spot-finder-app-git-feature-officialgoodwins-projects.vercel.app',
    ],
  },
}; 

export default config;
