# Offline Implementation — What Changed

## New files

| File | What it does |
|------|-------------|
| `src/lib/opfsTileStore.js` | Streams `.pmtiles` files into OPFS. One clean function to download, open, list, delete. Replaces all the range-request tile fetching. |
| `src/lib/highZoomCache.js` | LRU IndexedDB cache for zoom 15–19 tiles. Populated as the user browses online. Evicts oldest tiles above 600 MB. |
| `src/lib/routeCache.js` | Saves full calculated routes (GeoJSON + steps) to IndexedDB. Used by the OSRM client as offline fallback. Routes expire after 30 days. Max 100 routes. |
| `src/lib/voiceService.js` | Unified TTS wrapper. Uses `@capacitor-community/text-to-speech` (native Android, best quality) with automatic Web Speech API fallback. |
| `src/plugins/OsrmPlugin.js` | Capacitor JS bridge to the native Android OSRM service. Safe no-op on browser/iOS. |
| `src/plugins/OsrmPluginWeb.js` | Web no-op implementation (required by Capacitor's plugin registration). |
| `android/.../OsrmPlugin.java` | Capacitor plugin that exposes `startOsrm`, `stopOsrm`, `getStatus`, `downloadData` to JS. |
| `android/.../OsrmService.java` | Android Foreground Service that runs the `osrm-routed` binary. Extracts binary from assets on first run. Restarts automatically if killed. |
| `android/.../OsrmDownloader.java` | Streams and extracts the `.tar.gz` OSRM routing data archive to device storage. |
| `server/setup.md` | Step-by-step guide: generate PMTiles per country, generate OSRM data, host on Cloudflare R2 or nginx, compile osrm-routed for ARM64. |

## Modified files

### `src/lib/vectorTileDownloader.js`
- `downloadCountryVectorTiles` now calls `downloadToOPFS()` — single-file stream instead of 50k range requests
- `downloadCountryPOIs` uses adaptive grid scaling (4×4 to 12×12 based on country area) + 3× parallel requests + retry on network error
- Country `sizeMB` values updated to reflect z0–19 OPFS file sizes
- Added `pmtilesFilename()`, `isPointInCountry()`, `getDownloadedCountryAt()` helpers
- Removed the old `vtKey` / IndexedDB tile storage (replaced by OPFS)

### `src/api/osrmServiceClient.js`
- Three-tier routing: local OSRM server → remote OSRM → route cache
- Checks `localhost:5000` first (native OSRM service via Android); 2s timeout to not slow down normal use
- Caches every successful route via `routeCache.saveRoute()`
- On full offline with no server: serves from cache or throws a readable error message

### `src/components/map/MapLibreMap.jsx`
- Registers `offline-base://` protocol: serves z0–14 from the OPFS PMTiles file
- Registers `offline-hz://` protocol: serves z15–19 from IndexedDB tile cache; also caches tiles fetched online for future offline use
- `maxZoom` raised to 19 (was previously 22 but tiles only went to 14)
- Offline badge now shows "No map downloaded" when offline but no country file present

### `src/components/navigation/NavigationPanel.jsx`
- All `window.speechSynthesis` calls replaced with `speak()` / `stopSpeaking()` from `voiceService.js`
- `initVoice()` called on mount (detects Capacitor TTS availability)
- Language synced via `setVoiceLanguage()` when app language changes
- Mute state synced via `setVoiceMuted()`
- Cached route indicator shown in route summary when offline

### `src/components/offline/OfflineMapsMenu.jsx`
- Download button triggers OPFS stream (not range requests)
- New "Download Offline Navigation" button (purple, Android only) — downloads OSRM `.tar.gz`
- Shows OSRM data availability as a "Nav ✓" badge per country
- Tile cache card: shows high-zoom cache size, Clear button
- Route cache card: shows saved route count, Clear button
- `VITE_TILE_SERVER` check: red warning if not configured
- OPFS support check: yellow warning on incompatible browsers

## Setup required (one-time, by developer)

1. **Add env var**: `VITE_TILE_SERVER=https://your-r2-bucket.r2.dev` in `.env`
2. **Generate PMTiles**: Run `pmtiles extract` per country (see `server/setup.md`)
3. **Upload to server**: Upload `.pmtiles` files to Cloudflare R2 or nginx
4. **OSRM binary** (Android only): Cross-compile `osrm-routed` for ARM64, place at `android/app/src/main/assets/osrm-routed-arm64`
5. **Generate OSRM data**: Run OSRM pipeline per country, package as `.tar.gz`, upload to server
6. **Install TTS plugin**: `npm install @capacitor-community/text-to-speech && npx cap sync android`
7. **Register OsrmPlugin**: Add `registerPlugin(OsrmPlugin.class)` in `MainActivity.java`
8. **Add to AndroidManifest**: `<service android:name=".OsrmService" ...>` and foreground service permissions
9. **Add dependency**: `org.apache.commons:commons-compress:1.26.0` in `build.gradle`

## What works offline after setup

| Feature | Offline behavior |
|---------|-----------------|
| Map z0–14 | Served from OPFS PMTiles file |
| Map z15–19 | Served from IndexedDB tile cache (populated while online) |
| Navigation routing | Local OSRM → cached route fallback |
| Voice turn instructions | Capacitor TTS / Web Speech API (device TTS, fully offline) |
| POI markers | Served from IndexedDB (downloaded separately) |
| POI search | Not available offline |
| POI photos | Not available offline |
| Traffic layer | Not available offline (requires TomTom API) |
| Aerial/satellite layer | Not available offline (requires Esri CDN) |
