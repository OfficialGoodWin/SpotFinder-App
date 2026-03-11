import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
  ],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/ors-api': {
        target: 'https://api.openrouteservice.org/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ors-api/, ''),
      }
    }
  }
})
