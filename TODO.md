# Task Progress

## Bug: "No turns found" on first navigation attempt

### Issue Description
When clicking a spot and pressing "Navigate Here", it shows "No turns found" initially, but clicking "Try again" makes navigation work correctly. Also hitting "429 too many requests" error.

### Root Cause
1. The original code had automatic retry logic that was making MANY API calls
2. This caused rate limiting (429 error) from the ORS API
3. The debounce was either too short or missing, causing rapid-fire requests

### Fixes Applied
- **File**: `src/components/navigation/NavigationPanel.jsx`
  - Added 500ms debounce to prevent rapid API calls
  - Removed automatic retry logic - now only tries ONCE
  - Improved default navigation turns when API returns no steps
  - Simplified error handling

### Status: ✅ COMPLETED - Should no longer hit rate limits

## Improvements applied after March 2026 feedback

* **Off‑road destinations:** if ORS can't drive all the way, the panel now adds a walking step instead of spinning forever or retrying repeatedly.  A driving failure also falls back to a foot route automatically.
* **Turn instructions cleaned up:** tiny straight segments before a turn are merged and numeric "sharp" types remapped to normal left/right, which avoids the "go straight then sharp right" instructions on intersections with dedicated turn lanes.
* **Dark mode enhancements:** global utility overrides were added so that every `bg-white`, `bg-gray-*`, `text-gray-*` etc use the dark‑themed CSS variable equivalents, making dark mode look correct on all existing components without needing to edit every file individually.


