import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({ root: resolve('smoke'), base: '/', plugins: [react()],
  resolve: { alias: [{ find: './publicSpotRevocationListener.js',
    replacement: resolve('smoke/no-firebase-listener.js') }] },
  build: { outDir: resolve('smoke/dist'), emptyOutDir: true } });
