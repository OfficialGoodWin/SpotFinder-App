# SpotFinder Project Memory

## Key Architecture
- **Framework**: React + Vite, MapLibre GL (vector tiles), Firebase (Firestore + Auth)
- **Map**: MapLibreMap.jsx is the main map component (large file, use Grep/offset/limit to read)
- **Admin**: superadmin@spotfinder.cz — SuperAdminEditor.jsx panel
- **Auth**: Firebase Auth with email/Google; AuthModal.jsx has client-side rate limiting (5 attempts → 5min lockout)

## Key Files
- `src/components/map/MapLibreMap.jsx` — main map, renders admin POIs, road shields, E-routes
- `src/components/map/SuperAdminEditor.jsx` — admin panel (POIs, Road Closures, Nav Overrides, Road Numbers, E-Routes tabs)
- `src/lib/ambientCategories.js` — AMBIENT_CATEGORIES array used for POI icon/color matching
- `src/lib/POICategories.js` — POI_CATEGORIES for the search filter
- `src/api/firebaseClient.js` — all Firebase operations
- `src/components/map/SearchBar.jsx` — searches Nominatim + POI categories + spots by description
- `firestore.rules` — security rules for all collections

## Admin POI System
- Admin POIs stored in `admin_pois` Firestore collection
- Each POI has: `{ name, description, category (key), icon, color, lat, lon, street, houseNumber, city, postcode }`
- Category key must match AMBIENT_CATEGORIES `key` field for color/icon lookup
- CATEGORY_OPTIONS in SuperAdminEditor.jsx defines the dropdown (31 categories)
- MapLibreMap uses `poi.color` first, then falls back to AMBIENT_CATEGORIES lookup

## Known Bugs Fixed
- `AMBIENT_CATS` was undefined in MapLibreMap.jsx — fixed by defining `const AMBIENT_CATS = AMBIENT_CATEGORIES.filter(c => c.geo)` before `fetchAmbientPOIs`
- `GEO_LOOKUP` must only include entries with non-null `geo` field — new admin-only categories have `geo: null`
- Nominatim CORS: add `/nominatim/:path*` rewrite in vercel.json, use `/nominatim/search` in SearchBar

## Road Shields / E-Routes
- `EURO_ROUTES` object in MapLibreMap.jsx (now `let`, mutable) maps road refs to E-route arrays
- Admin E-route overrides stored in `admin_eroute_overrides` collection
- Admin road number overrides stored in `admin_road_overrides` collection
- These are loaded in Home.jsx and passed as props to MapLibreMap
- Road 27 → E53 in static table; use E-Routes admin tab to remove/modify

## Search
- SearchBar searches: POI categories, Nominatim geocoder, AND spots by title+description
- Spot description search is client-side filtering of the `spots` array passed as prop

## Security
- Client-side brute force: 5 failed logins → 5 min lockout (AuthModal.jsx, session-scoped)
- Firebase handles server-side auth/too-many-requests
- API rate limiting: 10 req/60s per IP in create-checkout-session.js
- Security headers in vercel.json (X-Frame-Options, X-Content-Type-Options, etc.)
- Firestore rules: all admin_ collections restricted to superadmin@spotfinder.cz

## Firebase Collections
- `spots`, `ratings`, `poi_photos`, `poi_ratings`, `ip_bans`
- `admin_pois`, `admin_closures`, `admin_nav_overrides`
- `admin_road_overrides`, `admin_eroute_overrides` (new)
- `feedback`

## Offline Features
When downloading offline maps:
1. **Offline Tiles (Maps)** ✅ — PMTiles vector tiles (OpenMapTiles), zoom 0–16, all of Europe, fully offline
2. **Offline POIs** ✅ — Restaurant, ATM, hotel, pharmacy, parking, supermarket, etc. via Geoapify API
3. **Offline Navigation** ✅ — OSRM routing client-side compatible; uses local OpenRouteService instance or bundled data
4. **Offline Voice (TTS)** ✅ — Web Speech API (always offline on Android), plus native Capacitor TTS fallback
- Downloads are country-by-country in OfflineMapsMenu.jsx
- PDFIncludes no PDFs; depends on external OSRM server for now (can be made offline with local data)
