import react from '@vitejs/plugin-react'
import path from 'path'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { createSpotPageHandler } from './api/spot-page.js'
import { getSpotPageFixture } from './tests/spot-page-fixtures.js'

const appRoutes = new Set(['/','/home','/faq','/status','/statusadmin','/admin','/privacypolicy','/termsandconditions','/cookiepolicy','/refundpolicy','/updates']);
let spotfinderBuildTarget;

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
      name: 'spotfinder-firebase-isolation',
      configResolved(config) {
        const env = config.env;
        const stage = env.VITE_SPOTFINDER_STAGE || '';
        const deployment = process.env.VERCEL_ENV || '';
        if (config.command !== 'build') return;
        if (deployment === 'production') {
          if (stage && stage !== 'production') throw new Error('Production build has a nonproduction Firebase stage.');
          if (env.VITE_FIREBASE_EMULATOR_ONLY === 'true') throw new Error('Production build cannot use Firebase emulators.');
        } else if (stage === 'emulator') {
          if (deployment || env.VITE_FIREBASE_EMULATOR_ONLY !== 'true') throw new Error('Emulator build is local only.');
        } else if (stage !== 'staging') {
          throw new Error('Nonproduction build requires an isolated staging or emulator Firebase target.');
        }
        if (stage === 'staging') {
          const required = ['VITE_FIREBASE_STAGING_API_KEY', 'VITE_FIREBASE_STAGING_AUTH_DOMAIN',
            'VITE_FIREBASE_STAGING_PROJECT_ID', 'VITE_FIREBASE_STAGING_APP_ID',
            'VITE_FIREBASE_STAGING_MESSAGING_SENDER_ID', 'VITE_FIREBASE_STAGING_STORAGE_BUCKET',
            'VITE_FIREBASE_APP_CHECK_SITE_KEY'];
          if (required.some(key => !env[key]?.trim()) || env.VITE_FIREBASE_STAGING_PROJECT_ID === 'spotfinderapp-cdc7b') {
            throw new Error('Staging Firebase and App Check web configuration is incomplete or points to production.');
          }
          if (deployment === 'preview' && process.env.FIREBASE_PROJECT_ID !== env.VITE_FIREBASE_STAGING_PROJECT_ID) {
            throw new Error('Preview server Firebase project does not match the isolated staging web project.');
          }
        }
        spotfinderBuildTarget = { stage, projectId: stage === 'staging'
          ? env.VITE_FIREBASE_STAGING_PROJECT_ID : stage === 'emulator' ? 'demo-spotfinder-local' : 'spotfinderapp-cdc7b' };
      },
      generateBundle() {
        if (spotfinderBuildTarget) this.emitFile({ type: 'asset', fileName: 'spotfinder-build-target.json',
          source: JSON.stringify(spotfinderBuildTarget) });
      },
      configurePreviewServer(preview) {
        const targetPath = path.resolve(__dirname, 'dist/spotfinder-build-target.json');
        const target = existsSync(targetPath) ? JSON.parse(readFileSync(targetPath, 'utf8')) : null;
        if (!target || !['staging', 'emulator'].includes(target.stage)
          || target.projectId === 'spotfinderapp-cdc7b') {
          throw new Error('Local preview requires an isolated staging or emulator build.');
        }
      },
    },
    {
      name: 'spotfinder-preview-routes',
      configurePreviewServer(preview) {
        // Local Vite preview always uses synthetic spot-page fixtures.
        const spotHandler = createSpotPageHandler({ lookup: getSpotPageFixture });
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
