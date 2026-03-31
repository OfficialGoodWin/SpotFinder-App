# SpotFinder Fix & Feature TODO — ALL COMPLETE ✅

## Bugs Fixed
- [x] 1. Fix: Can't add spots (stale closure in MapLibreMap addMode click handler) ✅
- [x] 2. Fix: Navigation blue line stays after closing NavigationPanel ✅
- [x] 3. Fix: One-way road arrows should be gray (not white) ✅
- [x] 4. Fix: Bike/walk routing used car OSRM server → profile-specific servers ✅
- [x] 5. Fix: Firebase API key hardcoded → VITE_FIREBASE_* env vars with fallback ✅

## Features Implemented
- [x] 6. Superadmin can block/delete ambient POIs (never reload them) ✅
- [x] 7. Edit existing admin POIs with custom icons/colors in SuperAdminEditor ✅
- [x] 8. Blocked POIs tab in SuperAdminEditor (list + unblock) ✅
- [x] 9. Walking paths on map — brown dashed lines (#8B6914 light / #c4a35a dark) ✅
- [x] 10. "Go Elite" subscription button in ProfileMenu (purple gradient pill) ✅
- [x] 11. Ultra subscription prices corrected ($7.99/mo, $45.99/yr) ✅
- [x] 12. Superadmin bypasses subscription gate (Go Elite button hidden) ✅
- [x] 13. Navigation UI overhaul:
         - Green turn-indicator pill at TOP during active nav ✅
         - Bottom bar hidden during active navigation ✅
         - Slide-up drawer: speedometer + speed limit + ETA + distance ✅
         - Expanded drawer: Cancel, Map Style, Settings, Nearby, Mute ✅
         - Car sub-modes: Fastest / Shortest / Eco (Elite-gated) ✅
         - EV Route Planning banner (Ultra-gated) ✅
         - ETA shown in pre-nav screen ✅
         - GPS speed calculated from position deltas ✅
         - Speed limit estimated from road type ✅
- [x] 14. onNavigatingChange prop wired to Home.jsx isActivelyNavigating state ✅

## Files Edited
- src/api/firebaseClient.js ✅
- src/api/firebaseConfig.js ✅
- src/api/osrmServiceClient.js ✅
- src/components/map/MapLibreMap.jsx ✅
- src/components/map/SuperAdminEditor.jsx ✅
- src/components/navigation/NavigationPanel.jsx ✅
- src/components/spots/POIDetailPanel.jsx ✅
- src/components/ProfileMenu.jsx ✅
- src/components/SubscriptionModal.jsx ✅
- src/lib/mapStyle.js ✅
- src/pages/Home.jsx ✅
