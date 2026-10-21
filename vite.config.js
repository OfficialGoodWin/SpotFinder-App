import react from '@vitejs/plugin-react'
import path from 'path'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
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
      name: 'spotfinder-journal-preview-routes',
      configurePreviewServer(preview) {
        preview.middlewares.use((request, response, next) => {
          if (!['GET', 'HEAD'].includes(request.method)) return next();
          const pathname = new URL(request.url, 'http://localhost').pathname.replace(/\/$/, '') || '/';
          const isJournal = pathname === '/news' || pathname.startsWith('/news/');
          const isAsset = pathname.startsWith('/assets/');
          if (!isJournal && !isAsset) return next();
          const safeJournalPath = pathname === '/news' || /^\/news\/(?:cs\/)?[a-z0-9-]+$/.test(pathname);
          const safeAssetPath = /^\/assets\/[A-Za-z0-9._-]+$/.test(pathname);
          if ((isJournal && !safeJournalPath) || (isAsset && !safeAssetPath)) {
            response.statusCode = 404;
            return response.end('Not found');
          }
          const output = path.resolve(__dirname, 'dist', `.${pathname}${isJournal ? '.html' : ''}`);
          if (!existsSync(output)) {
            response.statusCode = 404;
            return response.end('Not found');
          }
          if (isAsset) return next();
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          if (request.method === 'HEAD') return response.end();
          return response.end(readFileSync(output));
        });
      },
    },
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
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        journal: path.resolve(__dirname, 'news-shell.html'),
      },
    },
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
