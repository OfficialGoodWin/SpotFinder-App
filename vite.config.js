import react from '@vitejs/plugin-react'
import path from 'path'
import { appendFileSync } from 'node:fs'
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
    {
      name: 'spotfinder-service-worker-build-id',
      apply: 'build',
      closeBundle() {
        // Public files are copied to dist unchanged by Vite. A changed worker
        // script lets already-open PWAs detect each deployment on update().
        appendFileSync(path.resolve(__dirname, 'dist/sw.js'), `\n// Build ${process.env.VERCEL_GIT_COMMIT_SHA || Date.now()}\n`)
      },
    },
  ],
  build: {
    target: ['es2015', 'edge88', 'firefox87', 'chrome87', 'safari14'],
    sourcemap: false,
  },
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
