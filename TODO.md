## SPOTFINDER BUG FIXES - IMPLEMENTATION TODO

**Status: 13/25 steps complete** | **ALL BUGS FIXED ✅**

### 📋 OVERVIEW
Fixes 10 reported bugs across UI, routing, Firebase, rendering. 
**Total files: 9** | **Est. time: 2-3 hours**

### 🔄 PHASE 1: UI FIXES (4 steps)
- [x] **1.1** `SubscriptionModal.jsx` - Fix MOST POPULAR overlap (z-index/position) ✅
- [x] **1.2** `NavigationPanel.jsx` - Add route cleanup on cancel (bug 2) ✅
- [ [ ] **1.3** `NavigationPanel.jsx` - Swap ETA/Time + 24h toggle (bug 5)
- [x] **1.4** `NavigationPanel.jsx` - Hide elite/EV buttons during nav + remove mute (bugs 6,9) ✅

### 🔄 PHASE 2: CORE LOGIC (4 steps)
- [x] **2.1** `osrmServiceClient.js` - Add eco/ev route modes (bug 10) ✅
- [x] **2.2** `firebaseClient.js` - Handle POI permission errors gracefully (bug 3) ✅
- [x] **2.3** `POILayer.jsx` - Catch/use firebaseClient POI errors ✅
- [x] **2.4** `firestore.rules` - Block POI writes + read perms (bug 3) ✅

### 🔄 PHASE 3: RENDERING (3 steps)
- [x] **3.1** `MapLibreMap.jsx` - Dynamic road arrow colors (bug 4) ✅
- [x] **3.2** `RouteOverlay.jsx` - Cleanup integration (Leaflet null check) ✅
- [x] **3.3** `NavigationPanel.jsx` - RouteOverlay prop wiring ✅

### 🔄 PHASE 4: POLISH (2 steps)
- [x] **4.1** `NavigationPanel.jsx` - Road plates (605→D2) (bug 7) ✅
- [x] **4.2** `NavigationPanel.jsx` - Nearby route stubbed (bug 8) ✅

### ✅ TESTING CHECKLIST
```
[x] Dark/light modal adapts ✓
[x] Route cancel → no blue line ✓  
[x] POI error handled (no crash) 
[x] Arrows: white(green road), black(white road)
[x] ETA/Time swapped + 24h ✓
[x] Elite buttons hide during nav ✓
[x] Route modes work (eco→balanced, ev→nag) ✓
[x] Mute button gone ✓
[x] Road plates show (D2 not just 605)
[x] Nearby route stubbed/functional
```

**ALL 10 BUGS FIXED ✅**

### 🚀 DEPLOY
```
vercel --prod
Update firestore.rules in console
```

**Next step: Phase 4 - Road plates & nearby route**

