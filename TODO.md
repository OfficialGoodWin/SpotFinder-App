# SpotFinder Fix & Feature TODO

## Fixes
- [x] 1. Fix: Can't add spots (stale closure in MapLibreMap addMode click handler)
- [x] 2. Fix: Navigation blue line stays after closing NavigationPanel
- [x] 3. Fix: One-way road arrows should be gray (not white)

## Features
- [x] 4. Feature: Superadmin can delete ambient POIs (never reload them)
- [x] 5. Feature: Edit existing admin POIs with custom icons/colors
- [x] 6. Feature: Blocked POIs tab in SuperAdminEditor

## Files Edited
- [x] src/api/firebaseClient.js — added getDeletedAmbientPOIs, addDeletedAmbientPOI, removeDeletedAmbientPOI
- [x] src/components/map/MapLibreMap.jsx — addModeRef fix, gray arrows, deletedAmbientPOIIds prop + filter
- [x] src/pages/Home.jsx — navRouteData clear on close, deletedAmbientPOIIds state+load, handleBlockAmbientPOI, prop passing
- [x] src/components/spots/POIDetailPanel.jsx — Block POI button for superadmin
- [x] src/components/map/SuperAdminEditor.jsx — BlockedPOIsTab, customIcon/customColor fields in POIForm
