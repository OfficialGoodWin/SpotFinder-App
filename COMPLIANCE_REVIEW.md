# SpotFinder — Legal & Compliance Review

Prepared by an automated code review. **Not legal advice** — have a lawyer in your
jurisdiction (Czech Republic / EU, based on your domain and admin email) review the
new legal pages before publishing, especially the parts marked `[PLACEHOLDER]`.

## What was fixed in this pass

**Cookie consent / tracking (GDPR + ePrivacy)**
- Google Analytics and Google AdSense were loading unconditionally on every page
  load, with no consent gate — a real violation for EU/EEA/UK visitors.
- Added `src/lib/consent.js` (Google Consent Mode v2, default "denied") and a
  `CookieConsentBanner` (Accept all / Reject non-essential / Customize), shown on
  first visit and re-openable from Settings.
- GA and AdSense now only load after the relevant consent is granted.

**Legal pages** (new, routed, linked from Settings)
- `/PrivacyPolicy`, `/TermsAndConditions`, `/CookiePolicy`, `/RefundPolicy` — written
  from what the code actually does (Firebase, Stripe, GA, AdSense, geolocation,
  Mapy.cz/OSM/OpenRouteService/Geoapify, Wikimedia Commons, reCAPTCHA).
- Refund Policy covers the **EU 14-day right of withdrawal** for digital
  subscriptions, since that applies to any EU consumer subscribing.

**Consent on forms**
- Registration in `AuthModal` now requires a checkbox agreeing to the Terms &
  Privacy Policy before the account can be created (translated into all 13 app
  languages).
- `AddSpotModal` now shows a notice that submitted content is public and the user
  confirms they have the right to share it.
- `SubscriptionModal`'s button now says "Subscribe & pay $X/period" (not just
  "Get Elite") and discloses auto-renewal + links to Terms/Privacy/Refund policy,
  per the EU "button solution" rule for paid buttons.

**Accessibility**
- Added `aria-label`s to ~18 previously-unlabeled icon-only buttons (close buttons,
  photo-gallery thumbnails, expand/collapse controls) across AuthModal,
  SettingsModal, NavigationPanel, SubscriptionModal, SuperAdminEditor,
  POIDetailPanel, EditSpotModal, POIPanel, SpotDetailModal, NearbySpotsFilterModal,
  AddSpotModal, MySpotsPanel, OfflineMapsMenu.
- Fixed two **keyboard traps**: the photo-upload `<input type="file">` in
  AddSpotModal/EditSpotModal used `className="hidden"` (`display:none`), which
  removes it from the tab order entirely — keyboard users couldn't open the file
  picker at all. Changed to `sr-only` (visually hidden but focusable) with a
  visible focus ring on the surrounding label.
- Made a clickable POI header row (`onClick` on a plain `<div>`) keyboard-operable
  with `role="button"`, `tabIndex`, and Enter/Space handling.
- Added accessible names to the 5 star-rating buttons ("3 stars", etc.) instead of
  a bare "★" glyph.
- **Not done — needs a real tool, not a code read**: a full color-contrast audit.
  Run Lighthouse or axe DevTools against the built site; I noticed light
  `text-gray-300`/`text-gray-400` on white backgrounds in a few places that are
  worth checking first.

**Copyright / third-party content — flagged, not silently changed**
- `src/api/mapy-photos.js` **scrapes** photos from Mapy.cz/Firmy.cz (Seznam) by
  parsing their HTML with a spoofed browser User-Agent, and re-serves those images
  through your app. This is a real copyright and Terms-of-Service risk, and it also
  has a hardcoded API key in the source. I added a prominent warning comment in the
  file but **did not remove the feature** — that's your call. See the comment for
  three options (official API / drop the feature / get permission from Seznam).
- Wikimedia Commons and Google Places photos are shown with no attribution, though
  most Commons licenses and Google's Places API Terms require it. Flagged with a
  comment in `POIDetailPanel.jsx`; not implemented (would need new UI).
- No fake reviews or fabricated testimonials were found anywhere in the codebase —
  ratings/reviews are genuinely user-submitted.
- No unsupported superlative claims ("guaranteed", "#1", "100%") were found. Tightened
  one informal line in the Open Graph description ("try it trust me").

**Analytics / third-party embeds — inventory**
- Analytics: Google Analytics (gtag) — now consent-gated.
- Ads: Google AdSense — now consent-gated.
- Embeds/APIs used at runtime: Firebase (Auth/Firestore/Storage/Functions), Stripe
  Checkout, Google reCAPTCHA v3, Mapy.cz/Seznam APIs, OpenStreetMap tile servers,
  OpenFreeMap/Protomaps, OpenRouteService, OSRM, Geoapify, Wikimedia Commons API,
  optionally Google Places API. All are disclosed in the new Privacy Policy.

## What still needs YOU (can't be done from the codebase alone)

1. **Business identity.** Every legal page has `[YOUR LEGAL ENTITY NAME]`,
   `[REGISTERED ADDRESS]`, and `[CONTACT EMAIL]` placeholders. Operating a site that
   takes payments in the EU/Czech Republic without disclosing who's behind it is
   itself a compliance gap — this needs your real details, not invented ones.
2. **Decide on `mapy-photos.js`** (scraping Seznam's sites) — see the warning
   comment in that file.
3. **App store billing risk**: you have a Capacitor Android build, but subscriptions
   go through Stripe directly. If distributed via Google Play, in-app digital
   subscriptions generally must use Google Play Billing — using an external
   processor can get an app rejected or removed. Worth checking against the current
   Play Console policy (and Apple's equivalent if you ever ship iOS) before launch.
4. **Color contrast** — run an automated tool against the built site.
5. **Have a lawyer sanity-check** the Terms/Privacy/Refund pages for your actual
   jurisdiction, especially the governing-law clause and the 14-day withdrawal
   mechanics.

## Data minimization note
Reviewed the main forms (registration, add-spot, feedback) — none collect more than
they need for the stated purpose. Registration only asks for email/password (name is
optional); Add Spot only asks for what's shown on the map. No hidden/unused fields
were found being submitted to Firestore.
