import react from '@vitejs/plugin-react'
import path from 'path'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { createSpotPageHandler } from './api/spot-page.js'
import { getSpotPageFixture } from './tests/spot-page-fixtures.js'

const appRoutes = new Set(['/','/home','/faq','/status','/statusadmin','/admin','/privacypolicy','/termsandconditions','/cookiepolicy','/refundpolicy','/updates']);

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
      name: 'spotfinder-preview-routes',
      configurePreviewServer(preview) {
        const spotHandler = createSpotPageHandler({ lookup: process.env.SPOT_PAGE_FIXTURES === '1' ? getSpotPageFixture : async id => {
          const { adminDb } = await import('./api/_firebaseAdmin.js');
          const snapshot = await adminDb.collection('spots').doc(id).get();
          return snapshot.exists ? snapshot.data() : null;
        } });
        preview.middlewares.use((request, response, next) => {
          if (!['GET', 'HEAD'].includes(request.method)) return next();
          const pathname = new URL(request.url, 'http://localhost').pathname.replace(/\/$/, '') || '/';
          const spotMatch = /^\/spot\/([^/]+)$/i.exec(pathname);
          if (spotMatch) {
            request.query = { spotId: spotMatch[1] };
            return spotHandler(request, response);
          }
          const isJournal = pathname === '/news' || pathname.startsWith('/news/');
          const isAsset = pathname.startsWith('/assets/');
          if (!isJournal && !isAsset) {
            if (appRoutes.has(pathname.toLowerCase()) || pathname === '/new' || pathname.startsWith('/new/')) {
              if (pathname === '/new' || pathname.startsWith('/new/')) response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
              return next();
            }
            const isStaticFile = /^\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+$/.test(pathname) && !pathname.includes('..');
            if (isStaticFile && existsSync(path.resolve(__dirname, 'dist', `.${pathname}`))) return next();
            response.statusCode = 404;
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            if (request.method === 'HEAD') return response.end();
            return response.end(readFileSync(path.resolve(__dirname, 'dist/404.html')));
          }
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
