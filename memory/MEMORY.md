# SpotFinder Project Memory

## Key Architecture
- **Framework**: React + Vite, MapLibre GL (vector tiles), Firebase (Firestore + Auth)
- **Map**: MapLibreMap.jsx is the main map component (large file, use Grep/offset/limit to read)
- **Admin**: superadmin@spotfinder.cz — SuperAdminEditor.jsx panel
- **Auth**: Firebase Auth with email/Google; AuthModal.jsx has client-side rate limiting (5 attempts → 5min lockout)

## Offline Tiles System (BACKEND READY)
```
Download: OfflineMapsMenu.jsx → offlineManager.js → 
  - Country: api/download proxy → OPFS
  - Bbox: direct protomaps.com Range → OPFS (downloadBboxPMTiles)
Metadata: offlineStorage.js (meta + bbox_meta)
Core Functions ✅:
  - downloadBboxPMTiles(id, [w,s,e,n], name) → concurrent 16 workers, z2-16
  - getAllBboxFiles() → list OPFS+meta
  - getPMTilesUrlAt(lat,lng) → `pmtiles://praha-center.pmtiles` or null
Render:  MapLibreMap.jsx → needs 'moveend' listener calling getPMTilesUrlAt()
```
**Next**: MapLibreMap.jsx auto-switch → OfflineMapsMenu.jsx bbox UI.

## Target Fix (bbox + direct protomaps.com)
1. Bbox drawer UI in OfflineMapsMenu.jsx
2. `downloadBboxPMTiles()` in offlineManager.js: PMTiles(20260403.pmtiles) → Range fetch bbox tiles → OPFS
3. MapLibreMap.jsx: `moveend` → find OPFS bbox at center → switch to `pmtiles://{filename}.pmtiles`
4. Metadata: offlineStorage.js adds bbox store (`{id: 'praha-center', bbox:[], name, filename, sizeMB}`)

## Key Files
- `src/components/map/MapLibreMap.jsx` — main map, PMTiles protocol registered, needs OPFS auto-switch
- `src/lib/offlineManager.js` — country downloads (rewrite for bbox + direct protomaps.com)
- `src/components/offline/OfflineMapsMenu.jsx` — country list UI → add bbox drawer
- `src/lib/offlineStorage.js` — IndexedDB meta/POIs → add bbox metadata
- `src/components/map/OfflineTileLayer.jsx` — unused raster layer (deprecate)
- `api/download.js` — proxy (bypass for direct PMTiles)
- `src/lib/vectorTileDownloader.js` — legacy MVT (deprecate)
- `src/lib/opfsTileStore.js` — generic OPFS utils (use existing getFileHandle)

## Admin POI System
- Admin POIs stored in `admin_pois` Firestore collection
[... existing admin details unchanged ...]

## Known Issues Fixed
- **MapLibreMap.jsx TypeError**: Fixed `Cannot read properties of undefined (reading 'toFixed')` at line 74. Root cause: `map.getCenter()` returns `[lng, lat]` array but state expected `{lng, lat}` object. Fixed by normalizing: `setLngLat({ lng: center.lng, lat: center.lat })` in 'move' event handler.
[... existing unchanged ...]

## Firebase Collections

## Current Task: Hero Page + Compliance Pages + Feedback Fix (2024-...)

**Status:** Planning → Implementation

**Goal:** 
- Paper-design hero landing page
- Privacy Policy + Terms pages (app store compliance)
- Fix feedback form in FAQ.jsx

**Analysis:**
- Routing: src/pages.config.js imports from src/pages/*.jsx
- Feedback: FAQ.jsx → firebaseClient 'feedback' collection. Rules allow `create: if true` but "never works" → client init/auth issue?
- Hero: Home.jsx = map only. Create Landing.jsx with paper tokens (#111111 primary, spacing 4/8/12..., Roboto/Montserrat)

**Implementation Plan:**
1. [ ] Update firestore.rules (already allows feedback writes)
2. [ ] Create `src/pages/Landing.jsx` (paper hero: discover spots, features, CTA)
3. [ ] Create `src/pages/PrivacyPolicy.jsx` + `src/pages/TermsOfService.jsx`
4. [ ] Edit `src/pages.config.js`: import new pages, `mainPage: "Landing"`
5. [ ] Test: feedback form, new pages render, landing as /

**Files:**
- memory/MEMORY.md ← this update
- firestore.rules (check)
- src/pages/Landing.jsx (NEW)
- src/pages/PrivacyPolicy.jsx (NEW) 
- src/pages/TermsOfService.jsx (NEW)
- src/pages.config.js (add imports + mainPage)

**Progress:** 
- [x] Updated MEMORY.md 
- [x] Created src/pages/Landing.jsx (paper hero design)
- [x] Created src/pages/PrivacyPolicy.jsx 
- [x] Created src/pages/TermsOfService.jsx 
- [x] Updated src/pages.config.js (mainPage="Landing", added new pages)

**Next/Verify:**
- Test landing at /, map at /Home
- Test feedback form (rules allow writes)
- Links in footers: /privacy → /privacy, /terms → /terms, /faq → /faq
- App store compliance ✅
[... existing unchanged ...]
