# SpotFinder Project Guide

**Last Updated:** July 1, 2026  
**Version:** 0.0.0  
**Tech Stack:** React + Vite + MapLibre GL + Firebase + Capacitor

---

## 📌 Project Overview

**SpotFinder** is a community-driven mobile-first web application (with Android native support via Capacitor) that helps users discover, rate, and navigate to parking spots, viewpoints, and rest areas. The app features offline maps, real-time navigation, voice input, and ambient POI discovery.

**Key Features:**
- 🗺️ Interactive map with multiple layer styles (basic, outdoor, winter, aerial)
- 📍 User-generated spots with ratings (parking, beauty, privacy, access)
- 🧭 Turn-by-turn navigation with voice guidance
- 📡 Offline vector tile maps with overzoom support
- 🔍 Smart POI discovery (restaurants, fuel, hotels, etc.)
- 🌐 13 language support
- 🎨 Light/dark theme
- 🔐 Firebase authentication
- 💳 Stripe subscription integration (premium features)

---

## 🏗️ Architecture Overview

```
SpotFinder/
├── src/                      # Main source code
│   ├── api/                  # API clients (Firebase, Stripe, Mapy.cz, etc.)
│   ├── components/           # React components
│   │   ├── auth/            # Authentication modals
│   │   ├── map/             # Map components (MapLibre, layers, controls)
│   │   ├── navigation/      # Navigation panel, route overlay
│   │   ├── offline/         # Offline map management
│   │   ├── spots/           # Spot CRUD, detail panels
│   │   └── ui/              # Radix UI component library
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Core libraries and utilities
│   ├── locales/             # Translation files
│   ├── pages/               # Page components
│   ├── plugins/             # Native bridge plugins (OSRM, navigation)
│   └── utils/               # Utility functions
├── android/                  # Capacitor Android project
├── api/                      # Serverless API functions (Vercel)
├── public/                   # Static assets
├── memory/                   # Project documentation
└── [config files]           # Vite, Tailwind, ESLint, etc.
```

---

## 📂 File-by-File Breakdown

### 🎯 Entry Points

#### **`src/main.jsx`**
- React application entry point
- Mounts the `<App />` component to the DOM

#### **`src/App.jsx`**
- Root component wrapping the entire app
- Sets up:
  - React Router (HashRouter for Capacitor compatibility)
  - Authentication context (`AuthProvider`)
  - Theme context (`ThemeProvider`)
  - Language context (`LanguageProvider`)
  - React Query client for data fetching
  - Navigation tracker
  - Toast notifications
- Renders routing logic with `<Routes>`

#### **`src/pages.config.js`**
- Page routing configuration
- Maps page components to routes
- **Editable:** `mainPage` property controls the landing page
- Currently set to `"Landing"` (the hero landing page)

---

### 📄 Pages

#### **`src/pages/Landing.jsx`**
- **Hero landing page** (current main page)
- Marketing page with feature highlights, stats, and CTAs
- Sets localStorage flag `spotfinder_seen_hero` on mount
- Navigates to `/Home` (main app) or `/faq`

#### **`src/pages/Home.jsx`**
- **Main application page** (the actual map interface)
- Manages all core functionality:
  - Map rendering (MapLibre GL)
  - User location tracking
  - Spot CRUD operations
  - Navigation state
  - POI discovery
  - Offline map management
  - Authentication modals
  - Settings panel
- Contains ~1,400 lines of React state management

#### **`src/pages/FAQ.jsx`**
- Frequently asked questions page
- Uses Radix UI Accordion component

#### **`src/pages/PrivacyPolicy.jsx`** & **`src/pages/TermsOfService.jsx`**
- Legal pages (Privacy Policy and Terms of Service)

---

### 🗺️ Map System

#### **`src/components/map/MapLibreMap.jsx`** (1,390 lines)
- **Core map component** using MapLibre GL JS
- Handles:
  - **Online mode:** Loads vector tiles from Protomaps/OpenFreeMap
  - **Offline mode:** Custom `offline-vt://` protocol serving from IndexedDB
  - Dynamic style switching (light, dark, outdoor, winter, aerial)
  - User location marker with accuracy circle
  - Spot markers (custom icons based on rating)
  - Navigation route rendering (polyline + turn markers)
  - POI markers (ambient + custom admin POIs)
  - Road closure overlays
  - Map click handlers for adding spots
  - Road shield generation (draws highway shields on canvas)
  - Superadmin editor integration
  - **Zoom configuration:**
    - `maxZoom: 22` (allows zooming very close)
    - Offline tiles stored at max zoom 14, then **overzoomed** to 22
    - `flyTo` uses zoom level 15 by default

#### **`src/components/map/MapLayerSwitcher.jsx`**
- UI component for switching map styles
- Buttons for: Basic, Outdoor, Winter, Aerial

#### **`src/components/map/ZoomSlider.jsx`**
- Half-circle zoom slider on the right edge of the map
- Controls map zoom programmatically

#### **`src/components/map/SearchBar.jsx`**
- Multi-function search bar at the top
- Features:
  - Search locations via Mapy.cz API
  - Toggle spot markers visibility
  - Filter spots by category
  - POI category selector

#### **`src/components/map/AmbientPOILayer.jsx`**
- Renders ambient POI markers from Geoapify API
- Zoom-tiered rendering:
  - Zoom 13+: Hotels, parking, museums, hospitals
  - Zoom 15+: Restaurants, cafes, bars, pharmacies, banks
  - Zoom 16+: ATMs, restrooms
- LRU cache to prevent duplicate API calls

#### **`src/components/map/POILayer.jsx`**
- Renders custom admin POIs from Firebase
- Supports custom categories (schools, police, shops, etc.)

#### **`src/components/map/RoadClosureLayer.jsx`**
- Renders road closure overlays from Firebase admin data
- Visual indicator of closed roads

#### **`src/components/map/UserLocationMarker.jsx`** & **`SpotMarker.jsx`**
- Marker components (deprecated, now handled in MapLibreMap.jsx)

---

### 🧭 Navigation System

#### **`src/components/navigation/NavigationPanel.jsx`**
- Full-screen drawer for turn-by-turn navigation
- Features:
  - Voice guidance (TTS)
  - Distance/ETA display
  - Current speed
  - Next turn preview
  - Route overview
  - Map layer switcher
  - Settings access
- Uses OSRM for routing (online) or native plugin (Android offline)

#### **`src/components/navigation/RouteOverlay.jsx`**
- Renders navigation route on the map (deprecated, now in MapLibreMap)

#### **`src/plugins/OsrmPlugin.js`** & **`OsrmPluginWeb.js`**
- Web-based OSRM routing client
- Fetches routes from public OSRM server

#### **`src/plugins/SpotfinderNavPlugin.js`**
- **Native Android navigation plugin**
- Uses local OSRM C++ library for offline routing
- Requires native bridge (`nativeBridge.js`)

---

### 📍 Spot Management

#### **`src/components/spots/AddSpotModal.jsx`**
- Modal for creating a new spot
- Form fields:
  - Title, description
  - Ratings (parking, beauty, privacy, access)
  - Type (parking, viewpoint, rest area, gas station, shop)
  - Public/private toggle
  - Voice input support (Web Speech API)
  - Photo upload (base64 encoded)

#### **`src/components/spots/EditSpotModal.jsx`**
- Modal for editing existing spots
- Same fields as AddSpotModal

#### **`src/components/spots/SpotDetailModal.jsx`**
- Modal displaying spot details
- Features:
  - View ratings
  - Start navigation
  - Edit/delete (if owner)
  - Rate spot (star rating)
  - View photo
  - Share spot (copy link)

#### **`src/components/spots/SpotsPanel.jsx`**
- Toggle panel to show/hide spot markers
- Spot list sorted by distance
- Quick navigation to nearest spot

#### **`src/components/spots/MySpotsPanel.jsx`**
- Shows spots created by the current user
- Fly to spot on click

#### **`src/components/spots/POIPanel.jsx`**
- Shows list of POIs for a selected category
- Sorted by distance from user
- Navigate to POI

#### **`src/components/spots/POIDetailPanel.jsx`**
- Shows details for a single POI
- Navigate to POI
- Superadmin: Block ambient POI

---

### 📡 Offline Maps System

#### **`src/components/offline/OfflineMapsMenu.jsx`**
- Full-screen menu for offline map management
- Features:
  - **Draw custom bbox on map** (pan/zoom to select area)
  - **Select max zoom level:** 12, 13, or 14
  - **Download vector tiles** for selected area
  - **View downloaded areas** (bboxes)
  - **Delete offline areas**
  - **Storage usage indicator** (used/quota)
- **Important:** Zoom level 14 is recommended maximum
  - Higher zoom = exponentially more tiles
  - Overzoom scales zoom 14 tiles up to zoom 22

#### **`src/lib/vectorTileDownloader.js`**
- **Core offline map downloader**
- Uses **Protomaps PMTiles** format
- Fetches tiles via HTTP Range Requests from Protomaps API
- Stores tiles in IndexedDB with key format `vt|z/x/y`
- **Key function:** `downloadCountryVectorTiles()`
  - `maxZoom` parameter (default 14, capped at 14)
  - Generates all tiles for bbox at zoom 0-14
  - Parallel download with 32 workers
  - Progress reporting (tiles/sec, ETA)
- Countries pre-defined (Europe, 18 countries)
- Custom bbox support for user-drawn areas

#### **`src/lib/offlineStorage.js`**
- IndexedDB wrapper for offline data
- Stores:
  - **Vector tiles** (`vt|z/x/y`)
  - **Metadata** (country/bbox info, download stats)
  - **POIs** (ambient POIs from Geoapify)
- **Functions:**
  - `getTile(key)` / `setTile(key, data)`
  - `getAllBboxMeta()` - retrieves all downloaded areas
  - `deleteBboxMeta(id)` - deletes an area
  - `estimateStorageUsage()` - calculates used/quota MB

#### **`src/lib/highZoomCache.js`**
- **LRU cache for zoom 15-19 tiles**
- When online and browsing at street level, tiles are saved here
- When offline, serves from cache
- Max size: 600 MB
- Evicts oldest-accessed tiles when full
- **Key:** Only caches tiles with zoom >= 15

#### **`src/lib/opfsTileStore.js`**
- Legacy OPFS (Origin Private File System) storage
- Used by old PMTiles offline system
- **Status:** Deprecated, replaced by vectorTileDownloader.js

#### **`src/lib/offlineManager.js`**
- **LEGACY offline system** (PMTiles + OPFS)
- **Status:** Deprecated, kept for backward compatibility
- Do not use for new downloads

---

### 🔐 Authentication & User

#### **`src/lib/AuthContext.jsx`**
- React Context for authentication state
- Wraps Firebase Auth
- Provides:
  - `user` - current user object
  - `isAuthenticated` - boolean
  - `isLoadingAuth` - loading state
  - `authError` - error state
  - `login()`, `logout()`, `register()`

#### **`src/components/auth/AuthModal.jsx`**
- Login/register modal
- Email/password authentication
- Guest mode support

#### **`src/components/ProfileMenu.jsx`**
- Dropdown menu in top-right corner
- Shows user email, avatar
- Links:
  - My Spots
  - Subscription
  - Sign Out
  - Delete Account
  - Superadmin Editor (if superadmin)

#### **`src/components/SettingsModal.jsx`**
- App settings modal
- Options:
  - Language selector (13 languages)
  - Theme toggle (light/dark)
  - Voice guidance (on/off)
  - Map layer preference

#### **`src/components/SubscriptionModal.jsx`**
- Stripe subscription management
- Premium features upsell

---

### 🌐 API Clients

#### **`src/api/firebaseClient.js`**
- Firebase Firestore client
- Collections:
  - `spots` - user-generated spots
  - `spotRatings` - spot ratings
  - `adminPOIs` - custom admin POIs
  - `adminClosures` - road closures
  - `adminERouteOverrides` - E-route overrides
  - `adminRoadOverrides` - road ref overrides
  - `deletedAmbientPOIs` - blocked ambient POIs
- Functions:
  - `getPublicSpots(limit)` - fetch visible spots
  - `createSpot(data)` - create new spot
  - `updateSpot(id, data)` - update spot
  - `deleteSpot(id)` - delete spot
  - `rateSpot(spotId, rating)` - add star rating
  - Superadmin CRUD for POIs, closures, etc.

#### **`src/api/firebaseConfig.js`**
- Firebase initialization
- Environment variables from `.env`

#### **`src/api/mapyClient.js`**
- **Mapy.cz API client**
- Used for:
  - Address geocoding (search bar)
  - Reverse geocoding (lat/lng → address)

#### **`src/api/mapy-photos.js`**
- Fetch photos from Mapy.cz Panorama API

#### **`src/api/openrouteServiceClient.js`**
- OpenRouteService routing client (deprecated)

#### **`src/api/osrmServiceClient.js`**
- OSRM routing client
- Fetches driving routes from public OSRM server

#### **`src/api/mapyPOIService.js`**
- Mapy.cz POI API client (deprecated)

#### **`src/api/base44Client.js`**
- Base44 API client (unknown purpose, likely deprecated)

#### **`src/api/stripe.js`**
- Stripe subscription client
- Create checkout sessions
- Check subscription status

---

### 🎨 Styling & UI

#### **`src/lib/ThemeContext.jsx`**
- React Context for theme management
- Provides:
  - `isDark` - boolean
  - `toggleTheme()` - switch light/dark

#### **`src/lib/LanguageContext.jsx`**
- React Context for i18n
- Provides:
  - `language` - current locale (e.g., "en", "cs")
  - `t(key)` - translation function
  - `setLanguage(locale)` - change language

#### **`src/locales/translations.js`**
- Translation strings for 13 languages
- JSON object keyed by locale

#### **`src/components/ui/`**
- Radix UI component library (shadcn/ui style)
- Pre-built accessible components:
  - Button, Dialog, Toast, Accordion, etc.

#### **`src/index.css`**
- Global Tailwind CSS styles
- Custom CSS variables for theme colors

#### **`tailwind.config.js`**
- Tailwind configuration
- Custom colors, fonts, animations

---

### 🛠️ Utilities & Helpers

#### **`src/lib/mapStyle.js`**
- **MapLibre GL style definitions**
- Exports:
  - `lightStyle` - default light map
  - `darkStyle` - dark mode map
  - `outdoorStyle` - topographic style
  - `winterStyle` - winter theme (blue/white)
- Vector source configuration:
  - Online: Protomaps/OpenFreeMap tiles
  - Offline: `offline-vt://` protocol
- Layer definitions (roads, buildings, water, labels, etc.)

#### **`src/lib/ambientCategories.js`**
- POI category definitions
- Each category has:
  - `key` - unique identifier
  - `minZoom` - minimum zoom to render
  - `icon` - emoji icon
  - `color` - marker color
  - `geo` - Geoapify category string

#### **`src/lib/POICategories.js`**
- Same as ambientCategories.js (duplicate)

#### **`src/lib/voiceService.js`**
- Text-to-Speech wrapper
- Uses Web Speech API
- Turn instruction announcements

#### **`src/lib/routeCache.js`**
- In-memory cache for navigation routes
- Prevents duplicate OSRM requests

#### **`src/lib/nativeBridge.js`**
- **Capacitor native bridge**
- Provides native functionality:
  - `isNative()` - check if running on native platform
  - `nativeDownloadFile()` - download large files (bypasses CORS)
  - `nativeReadFileAsBase64()` - read file to base64
  - `nativeDeleteFile()` - delete file
  - `nativeComputeRoute()` - offline OSRM routing (Android)

#### **`src/lib/NavigationTracker.jsx`**
- Tracks page navigation events
- Logs to console for debugging

#### **`src/lib/ErrorBoundary.jsx`**
- React error boundary
- Catches unhandled errors and displays fallback UI

#### **`src/lib/PageNotFound.jsx`**
- 404 page component

#### **`src/lib/query-client.js`**
- React Query client configuration
- Used for data fetching/caching

#### **`src/lib/utils.js`**
- General utility functions (e.g., `cn()` for Tailwind class merging)

#### **`src/lib/app-params.js`**
- Application parameters and constants

#### **`src/lib/leaflet-fix.js`**
- Fixes Leaflet marker icon paths (legacy, not used with MapLibre)

---

### 🏗️ Build & Config

#### **`vite.config.js`**
- Vite bundler configuration
- React plugin
- Path aliases (`@/` → `src/`)

#### **`capacitor.config.ts`**
- Capacitor configuration for native Android build
- App ID, name, web directory

#### **`android/`**
- Capacitor Android project
- Built with Gradle
- Native OSRM C++ library integration

#### **`.env`**
- Environment variables:
  - Firebase config
  - Geoapify API key
  - Protomaps API key
  - Stripe keys

#### **`package.json`**
- Dependencies:
  - React 18
  - MapLibre GL JS
  - Firebase
  - Stripe
  - Radix UI
  - TanStack React Query
  - Tailwind CSS
  - Capacitor

---

## 🔍 Key Concepts

### Offline Maps System

**How it works:**
1. User selects a bbox (bounding box) on the map (feature removed from UI but backend intact)
2. User selects max zoom level (12, 13, 14, or **15 - new maximum**)
3. App calculates all tiles needed for that bbox at zoom 0-15
4. App downloads tiles from Protomaps PMTiles via HTTP Range Requests
5. Tiles stored in IndexedDB with key `vt|z/x/y`
6. MapLibre custom protocol `offline-vt://` serves tiles from IndexedDB
7. **Overzooming:** When user zooms past 15, MapLibre scales zoom 15 tiles
8. **High zoom cache:** Tiles at zoom 16-19 are cached when online
9. **No panning restrictions:** Users can freely pan outside downloaded areas (fixed in latest update)

**Why max zoom 15?**
- Protomaps basemap generates tiles only up to zoom 15 (not 14 as previously thought)
- Zoom 15 covers 100% of map detail at street level
- Overzooming from 15→22 is visually acceptable for vector tiles
- Zoom 15 downloads are ~4x larger than zoom 14 (acceptable tradeoff for full detail)

### Navigation System

**Routing:**
- **Online:** OSRM public server (via osrmServiceClient.js)
- **Offline (Android):** Native OSRM C++ library (via SpotfinderNavPlugin.js)
- **Route data:** Array of `[lng, lat]` coordinates + turn instructions

**Voice guidance:**
- Uses Web Speech API (`SpeechSynthesis`)
- Announces turn instructions based on distance
- Configurable in Settings

### Spot System

**Data model:**
- `lat`, `lng` - coordinates
- `title`, `description` - user-provided text
- `type` - enum (parking, viewpoint, rest_area, gas_station, shop)
- `ratings` - object with `parking`, `beauty`, `privacy`, `access` (1-5)
- `public` - boolean (visible to all users or just creator)
- `photo` - base64 image string
- `createdBy` - Firebase Auth UID
- `createdAt` - timestamp

**Permissions:**
- Any user can create spots
- Only creator can edit/delete their own spots
- Spots can be rated by any user (star rating 1-5)

---

## 🚀 Getting Started (For Another AI)

### Development Setup
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Type check
npm run typecheck
```

### Environment Variables
Create `.env` file:
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_GEOAPIFY_KEY=...
VITE_PROTOMAPS_KEY=...
VITE_STRIPE_PUBLISHABLE_KEY=...
```

### Android Build
```bash
# Build web assets
npm run build

# Sync to Capacitor
npx cap sync

# Open Android Studio
npx cap open android

# Build APK in Android Studio
```

---

## 📝 Common Tasks

### Add a new page
1. Create component in `src/pages/MyPage.jsx`
2. Add import in `src/pages.config.js`
3. Add to `PAGES` object: `"MyPage": MyPage`
4. Page available at `/#/MyPage`

### Change landing page
Edit `src/pages.config.js`:
```js
export const pagesConfig = {
  mainPage: "Home", // Currently set to "Home" (main app), was "Landing" (hero page)
  Pages: PAGES,
  Layout: __Layout,
};
```
**Note:** Landing page was removed from routing in latest update. To restore, add back to PAGES object.

### Add a new map layer
1. Define style in `src/lib/mapStyle.js`
2. Add button in `src/components/map/MapLayerSwitcher.jsx`
3. Update `mapLayer` state in `Home.jsx`

### Add a new POI category
1. Add to `src/lib/ambientCategories.js`:
```js
{ key: 'newcat', minZoom: 15, icon: '🏢', color: '#123456', geo: 'category.name' }
```
2. Update `POI_CATS` in `vectorTileDownloader.js` if downloadable

### Modify offline zoom limit
⚠️ **Current:** Max zoom is now 15 (Protomaps maximum)
1. Edit `src/lib/vectorTileDownloader.js`:
```js
const cappedMaxZoom = Math.min(15, Math.max(0, Number(maxZoom) || 15));
```
2. Edit `src/components/offline/OfflineMapsMenu.jsx`:
```js
<option value={15}>15 (Maximum Detail - Recommended)</option>
```
**Note:** 15 is the highest zoom level supported by Protomaps. Higher values won't provide more detail.

---

## 🐛 Known Issues & Limitations

1. **~~Offline map "locking"~~:** ✅ **FIXED** - Users can now pan freely outside downloaded areas
2. **~~Max zoom 14 hardcoded~~:** ✅ **FIXED** - Now supports up to zoom 15 (Protomaps maximum)
3. **~~Hero landing page~~:** ✅ **REMOVED** - App now loads directly to map
4. **Offline maps download UI:** ⚠️ **Hidden** - UI removed, backend functionality intact
5. **Large country downloads:** Some countries (Germany, France) are 600+ MB at zoom 15 → **Solution:** Pre-split into regions
6. **Native routing:** Only works on Android, not iOS or web

---

## 🔗 External Services

- **Firebase:** Authentication, Firestore (spots, ratings, admin data)
- **Geoapify:** Ambient POI data (restaurants, hotels, etc.)
- **Protomaps:** Vector tile data (offline maps)
- **Mapy.cz:** Geocoding, photos, search
- **OSRM:** Routing engine (online + native)
- **Stripe:** Subscription payments
- **Vercel:** Hosting (serverless functions)

---

## 📚 Further Reading

- MapLibre GL JS Docs: https://maplibre.org/maplibre-gl-js/docs/
- Protomaps PMTiles: https://docs.protomaps.com/pmtiles/
- Geoapify API: https://www.geoapify.com/places-api
- OSRM API: http://project-osrm.org/docs/v5.24.0/api/
- Firebase Docs: https://firebase.google.com/docs
- Capacitor Docs: https://capacitorjs.com/docs

---

**End of Guide**
