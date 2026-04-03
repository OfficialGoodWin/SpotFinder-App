import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// Vite plugin to emulate the Vercel Edge Function locally for downloading PMTiles
function localDownloadProxyPlugin() {
  return {
    name: 'local-download-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url.startsWith('/api/download?')) {
          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.end();
            return;
          }

          const urlObj = new URL(req.url, `http://${req.headers.host}`);
          const country = urlObj.searchParams.get('country');
          if (!country) {
            res.statusCode = 400;
            return res.end('Missing country');
          }

          try {
            const target = `https://github.com/OfficialGoodWin/SpotFinder-App/releases/latest/download/${country}.pmtiles`;
            const githubRes = await fetch(target, { redirect: 'follow' });
            
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
            
            if (!githubRes.ok) {
              res.statusCode = githubRes.status;
              return res.end(`Error: ${githubRes.status}`);
            }
            
            res.statusCode = githubRes.status;
            githubRes.headers.forEach((val, key) => {
              // Exclude some headers that could interfere with node HTTP responses
              if (['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) return;
              res.setHeader(key, val);
            });
            
            const reader = githubRes.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
            res.end();
          } catch (e) {
            res.statusCode = 500;
            res.end(e.message);
          }
          return;
        }
        next();
      });
    }
  };
}

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
    localDownloadProxyPlugin(),
  ],
  build: {
    target: ['es2015', 'edge88', 'firefox87', 'chrome87', 'safari14'],
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
