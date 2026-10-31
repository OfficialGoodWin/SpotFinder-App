import react from '@vitejs/plugin-react'
import path from 'path'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { createSpotPageHandler } from './api/spot-page.js'
import { getSpotPageFixture } from './tests/spot-page-fixtures.js'
import { validateSnapshotArtifacts } from './scripts/public-spots/export.mjs'
import { snapshotRegionDirectory } from './src/new/publicSpotSnapshotFormat.js'

const appRoutes = new Set(['/','/home','/faq','/status','/statusadmin','/admin','/privacypolicy','/termsandconditions','/cookiepolicy','/refundpolicy','/updates']);
let spotfinderBuildTarget;
let snapshotFixtureRoot;
let snapshotCandidateRoot;

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
      name: 'spotfinder-local-snapshot-fixtures',
      configResolved(config) {
        snapshotFixtureRoot = config.command === 'serve' && config.env.VITE_SPOTFINDER_STAGE === 'emulator'
          && config.env.VITE_FIREBASE_EMULATOR_ONLY === 'true'
          && process.env.SPOTFINDER_SNAPSHOT_FIXTURE_DIR
          ? path.resolve(process.env.SPOTFINDER_SNAPSHOT_FIXTURE_DIR) : null
      },
      configureServer(server) {
        if (!snapshotFixtureRoot) return
        server.middlewares.use((request, response, next) => {
          const pathname = new URL(request.url, 'http://localhost').pathname
          if (pathname === '/api/spot-snapshot-revocations') {
            const feedPath = `${snapshotFixtureRoot}.revocations.json`
            response.setHeader('Content-Type', 'application/json; charset=utf-8')
            response.setHeader('Cache-Control', 'no-store')
            if (!existsSync(feedPath)) { response.statusCode = 503; return response.end('{"error":"revocation-unavailable"}') }
            return response.end(readFileSync(feedPath))
          }
          if (!/^\/spot-snapshots\/(?:manifest\.json|v[23]\/r\d+-\d+-[a-f0-9]{20}\.json)$/.test(pathname)) return next()
          const file = path.resolve(snapshotFixtureRoot, `.${pathname.slice('/spot-snapshots'.length)}`)
          if (!file.startsWith(snapshotFixtureRoot + path.sep) || !existsSync(file)) {
            response.statusCode = 404
            return response.end('Snapshot file unavailable')
          }
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('Cache-Control', pathname.endsWith('manifest.json')
            ? 'no-store' : 'public, max-age=31536000, immutable')
          response.end(readFileSync(file))
        })
      },
      transformIndexHtml(html) {
        if (!snapshotFixtureRoot) return html
        // Only the isolated emulator dev server may contact loopback Firebase.
        return html.replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:8080 http://127.0.0.1:9099")
      },
    },
    {
      name: 'spotfinder-staging-snapshot-candidate',
      configResolved(config) {
        snapshotCandidateRoot = null
        if (config.command !== 'build' || config.mode !== 'snapshot-staging') return
        const deployment = process.env.VERCEL_ENV
        if (config.env.VITE_SPOTFINDER_STAGE !== 'staging' || (deployment && deployment !== 'preview')) {
          throw new Error('Snapshot candidate builds require an isolated staging target')
        }
        if (deployment === 'preview' && process.env.SPOTFINDER_SNAPSHOT_PREVIEW_APPROVED !== 'true') {
          throw new Error('Snapshot candidate Preview builds require explicit approval')
        }
        if (!process.env.SPOTFINDER_SNAPSHOT_CANDIDATE_DIRECTORY) {
          throw new Error('Explicit staging snapshot candidate directory required')
        }
        snapshotCandidateRoot = path.resolve(process.env.SPOTFINDER_SNAPSHOT_CANDIDATE_DIRECTORY)
      },
      generateBundle() {
        if (!snapshotCandidateRoot) return
        const manifest = JSON.parse(readFileSync(path.join(snapshotCandidateRoot, 'manifest.json'), 'utf8'))
        const directory = snapshotRegionDirectory(manifest.format)
        const names = Object.values(manifest.regions || {})
        if (names.some(name => typeof name !== 'string' || !/^r\d+-\d+-[a-f0-9]{20}\.json$/.test(name))) {
          throw new Error('Unsafe snapshot candidate reference')
        }
        const files = new Map(names.map(name => [name,
          JSON.parse(readFileSync(path.join(snapshotCandidateRoot, directory, name), 'utf8'))]))
        validateSnapshotArtifacts({ manifest, files })
        this.emitFile({ type: 'asset', fileName: 'spot-snapshots/manifest.json', source: `${JSON.stringify(manifest)}\n` })
        for (const [name, data] of files) this.emitFile({ type: 'asset',
          fileName: `spot-snapshots/${directory}/${name}`, source: `${JSON.stringify(data)}\n` })
      },
    },
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
          if (env.VITE_ORIGINAL_MAP_SNAPSHOTS === 'true') throw new Error('Original map snapshots cannot be enabled in production.');
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
