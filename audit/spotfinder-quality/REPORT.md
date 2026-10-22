# SpotFinder product quality audit

**Date:** 22 October 2026. **Production tested:** `https://spot-finder-app.vercel.app/`. **Method:** repository inspection followed by normal-rate, signed-out browsing with the official Microsoft Playwright CLI 0.1.22. Desktop and viewport-emulated mobile screenshots, accessibility snapshots, requests, console, one trace, and bounded HTTP checks support the findings. [Route coverage](ROUTE_COVERAGE.md), [ranked issues](ISSUES.md), [reference comparison](COMPARISON.md), and [roadmap](ROADMAP.md) contain the detail. No application code, production data or deployment was changed.

## Executive summary

SpotFinder already has a coherent map identity. A guest can search for places, move from suggestions to the map, inspect a community spot with a real photo and attribution, open a photo viewer, see rated community data, and inspect an imported POI. The map, green contribution control, and separate serif Journal feel designed for discovering places rather than assembled from a generic SaaS landing-page template. [Desktop map](screenshots/home-intro-desktop.png), [mobile spot](screenshots/spot-mobile.png), [Journal](screenshots/route-news.png).

The most consequential confirmed weakness is accessibility: the Settings dialog clips content at 200% text size on a 320 px viewport. The Journal is designed and crawlable but has no published article yet. Search gives no zero-result message; raw spot URLs have generic metadata; and unknown non-Journal routes return HTTP 200 despite displaying a 404. Public legal pages openly say review is pending. These are specific unfinished parts, not a blanket judgement of the site.

**Overall assessment:** usable and visually distinctive for guest map discovery, but not yet fully mature in accessible edge cases, editorial depth, raw HTML for shared spot links, and public trust documentation. The audit found no basis to claim SpotFinder is “obviously AI-generated.” Visual resemblance is a subjective design assessment, not evidence of authorship.

## Coverage and limits

The [route table](ROUTE_COVERAGE.md) records public routes and click-only screens with each visit and untested interaction. The live site was sampled at **320×568, 375×667, 390×844, 430×932, 768×1024, 1024×768, 1366×768 and 1920×1080**. The guest map had no page-wide horizontal overflow at those sizes. A busy Prague view and a quieter Hrubá Skála view were inspected. Settings, sign-in, guest drafts, add-spot form, search, Nearby filters, layers, community detail, photo viewer, Journal, FAQ, Status, updates and legal routes were opened. No public spot, report, rating, upload, account or payment action was submitted.

Only guest personas were available. Verified, unverified and admin account workflows are **NOT TESTED**. Viewport emulation is not physical iOS Safari; soft keyboard, standalone PWA, touch drag/overscroll and safe-area behavior remain open. The browser's 125%/200% zoom was not simulated as a real browser zoom control; SpotFinder's own 200% text setting was tested and failed at 320 px. Reduced-motion, offline, throttled/failed network, expired session, image failures, long input and refresh during a saved draft remain unverified. These are coverage limits, not inferred defects.

## Visual design and content

The strongest visual work is the map-first composition, the category icon language, the dominant green contribution action, the relatively restrained spot sheet, and the Journal's distinct editorial type and attributed photography. [City map](screenshots/map-city-selected.png), [spot detail](screenshots/featured-spot-detail-desktop.png), [Journal](screenshots/route-news.png). Cards and rounded surfaces are common, but their use here does not by itself make the site generic. The app does not rely on the usual gradient hero plus interchangeable feature-card stack.

Visible rough edges are editorial and contextual: the default Featured panel says there are no community spots in the current view while showing three fallback cards; one is only “Viewpoint” with coordinates. Blejski grad's prominent description has grammar errors. This weakens place trust more than the styling does. [Featured panel](screenshots/featured-desktop.png), [description](screenshots/spot-mobile.png). No sentence was labeled AI-generated. Czech and German are explicitly marked partial; the Czech sampled Settings screen translates most controls, while German leaves several helper sentences in English. [Czech](screenshots/settings-czech.png), [German](screenshots/settings-german.png).

## Functionality and map behavior

Prague Castle search suggestions appeared after waiting and included place names, addresses and provider labels; selecting one moved the map to Prague. Hrubá Skála search moved the map to a quieter rural view, and clicking a visible hotel marker opened a sheet with navigation, sharing, contact and coordinates. The basemap briefly appeared blank during a Turnov jump but filled in on recheck; this was **not** counted as a persistent bug. [Search](screenshots/search-mobile-after-wait.png), [Prague](screenshots/map-city-selected.png), [rural map](screenshots/map-rural-hruba-skala.png), [POI](screenshots/poi-detail-rural.png).

The zero-result query `zzzznotaplace123456` left no explanatory state (SF-05). Creating a spot up to the form was possible as a guest after choosing a map position, with required title/description and an explicit accuracy/photo-rights checkbox; Save was deliberately not pressed. The photo viewer opened as a named dialog. Like/save/rating/report eligibility was visible but final writes were not exercised. [Empty search](screenshots/search-no-results-mobile.png), [create form](screenshots/create-spot-mobile.png), [viewer](screenshots/spot-photo-fullscreen-desktop.png).

## Mobile and accessibility

The ordinary 390 px community spot sheet is readable and keeps Navigate Here visible. The create form's fields and actions fit a 390 px viewport. [Spot](screenshots/spot-mobile.png), [form](screenshots/create-spot-mobile.png). At 320 px and 200% text size, Settings breaks: internal elements reach x=375 while the viewport ends at x=320; labels and sections clip even though the page's own overflow metric is false. This is SF-01 and the clearest mobile/accessibility failure. [Screenshot](screenshots/settings-200pct-320.png), [action trace](traces/settings-200pct.trace). Session-specific network payloads were omitted from the trace artifact. [WCAG 2.2's resize-text explanation](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) expects 200% text without loss of content or function; this audit does not certify full WCAG conformance.

The initial HTML also contains `maximum-scale=1.0, user-scalable=no` (SF-07). Browser-specific pinch behavior needs physical testing, but the markup is an avoidable barrier. Many map controls have accessible labels and most observed hit targets were 40–44 px or larger; the voice-search icon measured 36×36 px in the viewport scan. No full contrast, screen reader, focus-trap, or keyboard-only audit was completed, so no broad accessibility pass is claimed.

## Trust, legal and security

Terms, Privacy and Refund pages are publicly reachable. Terms prominently says legal review and operator disclosures are pending; this is honest but unfinished and requires owner/legal action (SF-06). The cookie banner accurately says analytics and ads are disabled; network inspection showed normal Firebase auth/listener traffic and PMTiles range requests, not an ad flow. The Journal's current photograph credits Tegan Conway/Unsplash. [Terms](screenshots/route-TermsAndConditions.png), [Journal](screenshots/route-news.png).

Source review found no grounds to say hidden admin buttons are the security boundary: `firestore.rules` contains role-based restrictions and guest visits to `/Admin` and `/StatusAdmin` showed access gates. Actual server-side authorization was not penetration-tested. MapLibre popup code uses `setHTML` with dynamic traffic and admin-POI strings without visible escaping (SF-09). This is a code-level hardening finding; no exploitability claim or payload test was made. Review against [OWASP ASVS](https://owasp.org/projects/asvs) should validate data provenance and escaping before assigning a stronger security conclusion.

## Journal and technical SEO

Production `/news` returns meaningful HTML with a unique “Journal | SpotFinder” title, description and canonical; it has no published article. The local generated published list is empty; drafts stay out of the sitemap, and a sampled draft URL returns a real HTTP 404. The nine-entry sitemap and `robots.txt` both resolve with HTTP 200. The sitemap's URLs and robots Sitemap line use `https://www.spotfinder.live`. That domain itself serves the same app and the bare domain redirects to `www`, so this appears to be an intentional live canonical replacement for the Vercel hostname. Deployment ownership/settings were not available to confirm its verification state. `spot-finder-app.vercel.app` remains the tested deployment address.

There is **no real published article page to validate** for unique title, meta description, canonical, OG/Twitter preview, BlogPosting schema, alt text, publication date, spot links, direct refresh or sitemap update. Do not treat the Journal landing page's JSON-LD as an article test. These checks belong in the first real article release. General public spot URLs currently serve generic initial HTML metadata (SF-03), and unknown SPA routes serve HTTP 200 with a JS-rendered 404 (SF-04). [Journal](screenshots/route-news.png), [visual 404](screenshots/route-definitely-not-a-route.png), `scripts/seo-http.js`.

Google indexing was not checked in Search Console; no indexing guarantee is possible. The owner should use URL Inspection for the first published story and compare the indexed canonical to `www.spotfinder.live` after deployment.

## Performance evidence

Two equivalent warm-browser navigations, measured with `PerformanceObserver` in the official Playwright session, produced these **synthetic-only** results:

| Sample | DOMContentLoaded | LCP | CLS | Long tasks | Resource entries | PMTiles range entries | Firestore request entries |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 242 ms | 5,656 ms | 0.027 | 2 | 32 | 11 | 7 |
| 2 | 119 ms | 772 ms | 0.003 | 0 | 34 | 11 | 8 |

The spread is too large and sample too small to infer a stable real-user LCP. The browser session was warm, devices were not throttled, and INP, FPS, memory, first usable map time and listener duplication were not measured. [Google's Web Vitals guidance](https://web.dev/articles/vitals) gives good field thresholds of LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1 at the 75th percentile. Obtain field data before a performance priority is assigned. The captured request log showed successful OpenFreeMap tiles and Vercel Blob PMTiles `206` range responses; one sampled optional POI detail JSON returned 404 without preventing its detail sheet.

## Scores (0–10, bounded to tested guest evidence)

| Dimension | Score | Reason |
|---|---:|---|
| Visual identity | 8 | Map and contribution flow feel place-specific; editorial Journal has its own voice. |
| Visual consistency | 7 | Main map and sheets cohere; fallback Featured context and partial locale content roughen it. |
| Typography | 7 | Spot and Journal reading hierarchy is clear; enlarged Settings clips at 320 px. |
| Mobile usability | 6 | Core detail and create form fit 390 px; 200% text in Settings fails at 320 px. |
| First-time user experience | 7 | Intro, consent and search offer entry; Featured says no local spots while showing distant fallbacks. |
| Map usability | 7 | Busy and quiet views, search jumps and POI selection worked; broader marker accuracy remains open. |
| Interaction quality | 7 | Tested guest controls responded; empty search lacks feedback. |
| Error handling | 5 | Unknown URL has wrong HTTP status and empty search is silent; network failures untested. |
| Accessibility | 5 | Labeled controls and usable base layouts, but verified 200% clipping and restrictive viewport markup. |
| Performance | 6 provisional | Two synthetic LCP samples diverged; field and device data unavailable. |
| Content quality | 5 | Specific spot mistakes and no published Journal article; credited imagery is a positive. |
| Trust and credibility | 5 | Clear moderation/consent wording, but legal pages still pending review. |
| SEO readiness | 5 | Journal infrastructure, robots and 404 draft handling work; no real article and spot raw metadata weak. |

**AI-template resemblance:** Low to moderate. Rounded cards and standard iconography are familiar, but the map density, location-first workflows, green contribution action and editorial layout prevent an “obviously generated template” judgement. Content placeholders and unfinished empty/error states, rather than generic visual effects, create most of the unfinished impression. Appearance cannot establish who authored the site.

## Prioritized action plan

The top ten actions, in order, are: **1** fix Settings at 200%/320 px (SF-01); **2** publish one verified, real Journal article using the current workflow and validate its raw HTML/sitemap (SF-02); **3** provide spot-specific raw metadata for direct URLs (SF-03); **4** return real HTTP 404 for unknown SPA paths (SF-04); **5** add a search zero-result/error state (SF-05); **6** complete operator facts and qualified legal review (SF-06); **7** remove restrictive viewport scaling after map regression checks (SF-07); **8** fact-check and edit the two visible place-content examples (SF-08); **9** replace dynamic popup HTML interpolation with text-safe rendering (SF-09); **10** translate the sampled German helper strings and recheck core flows (SF-10). [Implementation roadmap](ROADMAP.md) separates quick edits from routing/data work and lists verification for each.

Do not redesign the map, replace MapLibre/PMTiles, add a CMS, activate ads/analytics, or invent editorial content to make the Journal appear populated. SpotFinder becomes more distinctive through accurate local place names, authentic attributed photos, clear provenance and richer real spot context, not borrowed competitor chrome.

## Direct answers

- **Obviously AI-template-generated?** No. The tested guest map and Journal have a location-specific identity. Appearance cannot prove authorship.
- **What creates an unfinished impression?** Empty Journal, generic “Viewpoint” fallback, incorrect spot prose, silent zero-result search, legal review banners and clipped enlarged Settings.
- **What is genuinely strong?** The dense interactive map, location search, community detail sheet, credited photography and editorial Journal layout.
- **Five most embarrassing verified defects/gaps:** SF-01, SF-02, SF-03, SF-04 and SF-05. SF-02 is a content launch gap, not a broken publishing pipeline.
- **Which journeys are unfinished?** Reading a real Journal article is unavailable; account, edit, rating/report, upload, subscription and admin journeys were blocked from safe verification by lack of authorized sessions.
- **Most serious mobile weakness?** SF-01, the 200% Settings clipping at 320 px.
- **Visual inconsistency?** The fallback Featured card implies local community discovery while showing distant fallbacks; some spot prose lacks the care shown in the Journal layout. No systemic CSS chaos was established.
- **Where are references better?** Linear's written update discovery, Komoot's map/list selected-result context, and Mapy.com's place-detail hierarchy in the tested pages. AllTrails and Atlas Obscura were access-blocked; see [comparison](COMPARISON.md).
- **What makes a mature 2026 product here?** Reliable accessible scaling, explicit failure states, real verified place/editorial content, correct direct-link HTML/status, and completed public trust documentation.
- **Which five first?** SF-01, SF-02, SF-03, SF-04, SF-05 in that order, alongside owner-led legal review.

## Remaining unknowns

Physical iOS Safari and Android hardware; real on-screen keyboard/safe areas; browser zoom and reduced motion; signed-in/verified/unverified/admin states; actual create/edit/save/rate/report/upload outcomes; server-side authorization under safe test accounts; geolocation denial; voice fallback; offline/slow-network recovery; photo failure states; full keyboard/focus/contrast audit; field Core Web Vitals; actual Google Search Console indexing; first real published article metadata/JSON-LD/hreflang/spot links; ownership/configuration of `www.spotfinder.live`; AllTrails/Atlas Obscura reference workflows blocked by their sites.
