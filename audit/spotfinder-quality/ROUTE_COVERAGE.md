# Route and state coverage

Inventory from `src/App.jsx:45-83`, `src/pages.config.js:46-79`, `src/pages/Home.jsx:521-962`, `src/components/spots/*`, `src/news/Journal.jsx`, and live navigation. “Visited” means this audit actually opened the route or state in the official Playwright CLI; a source-defined route alone is marked untested. Screenshots are in `screenshots/`. All production interaction was at normal browsing rates and no public content was submitted.

| Route / screen | Entry point | Guest / auth | Mobile | Visited? / evidence | Interactions tested | Important unverified interaction or problem |
|---|---|---|---|---|---|---|
| `/` map + introduction | Direct URL | Guest | Yes, 8 widths | Yes: [desktop](screenshots/home-intro-desktop.png), [320](screenshots/map-320x568.png), [390](screenshots/map-390x844.png) | Dismiss intro, zoom controls visible, search, map region | Touch drag/FPS on physical phone not measured |
| Featured community places | Intro button / contextual map card | Guest | Yes | Yes: [desktop](screenshots/featured-desktop.png) | Open Blejski grad, close/continue | Fallback cards appear when current view has no community spots; SF-08 |
| Search / results | Map textbox | Guest | Yes | Yes: [mobile results](screenshots/search-mobile-after-wait.png) | Type Prague Castle, select first result; Turnov and Hrubá Skála location jumps | Voice search and provider outage untested; zero-result feedback SF-05 |
| Busy city / rural map | Search result | Guest | Desktop sample | Yes: [Prague](screenshots/map-city-selected.png), [Hrubá Skála](screenshots/map-rural-hruba-skala.png) | Search selection, map moved, visible marker clicked in rural view | Category-by-category marker precision and FPS not measured |
| Imported POI compact / expanded detail | Visible hotel marker near Hrubá Skála | Guest | Desktop sample | Yes: [compact](screenshots/poi-detail-rural.png) | Click marker, expand details | One optional detail JSON returned 404; no claim of general POI failure. Ratings/report final actions not submitted |
| `/spot/AIyFTk1eTE7gD5INyomX` | Featured Blejski grad | Guest | Yes | Yes: [desktop](screenshots/featured-spot-detail-desktop.png), [mobile](screenshots/spot-mobile.png) | Open, refresh via direct URL, photo full screen, see Like/Save/Share/Rate/Report/Navigate | Final save, rating, report, external navigation not triggered; raw HTML SF-03 |
| Photo gallery | Spot detail photo | Guest | Desktop | Yes: [viewer](screenshots/spot-photo-fullscreen-desktop.png) | Open viewer; close control observed | Multi-photo swipe and failed decode not tested |
| Nearby filter | Map filter button | Guest | Yes | Yes: [desktop](screenshots/nearby-desktop.png), [mobile](screenshots/nearby-mobile.png) | Open, inspect range/source/rating and cancel controls | Did not request GPS or execute filtered search against live data |
| Map layer selector | Map layers button | Guest | Desktop | Yes: [layers](screenshots/layers-desktop.png) | Open list of Basic, Outdoor, Satellite, Winter, Traffic | Individual layer switching and 3D style interaction untested |
| Settings | Map footer / mobile More | Guest | Yes | Yes: [desktop](screenshots/settings-desktop.png), [200% at 320](screenshots/settings-200pct-320.png) | Theme switch, text-size change/reset, language picker | Persistence across fresh browser install not tested; SF-01 |
| Czech / German localization | Settings picker | Guest | Desktop sample | Yes: [Czech](screenshots/settings-czech.png), [German](screenshots/settings-german.png) | Select each, inspect settings and map labels, restore English | Both labeled partial; full route translation not tested; SF-10 |
| Create spot form | Add a spot → map tap | Guest | Yes | Yes: [form](screenshots/create-spot-mobile.png) | Select location, inspect required fields/consent/optional section | Save, image upload, draft refresh, validation errors not submitted; no public spot created |
| Guest drafts | Drafts button | Guest | Desktop | Yes: [empty state](screenshots/drafts-desktop.png) | Open and inspect device/session-only explanation | Creating or restoring a real draft not tested |
| Sign in / Sign up | Sign in button | Guest | Desktop | Yes: [modal](screenshots/sign-in-desktop.png) | Open and inspect Google/email options | No credentials provided; sign-in, reset, unverified state not tested |
| Saved / Liked / Created spots | Profile/My Spots panel in source | Signed-in | Source only | No | None | Requires authorized account; do not call broken |
| Edit spot / rating / report / social posts | Spot/POI detail controls | Signed-in for state changes | Source only | No final action | Eligibility labels observed | No writes or moderation actions authorized |
| `/news` Journal | Direct URL / nav | Guest | Desktop | Yes: [Journal](screenshots/route-news.png) | Open direct URL, inspect raw HTML and links | No published article exists; SF-02 |
| `/news/<slug>` article | Journal link or direct URL | Guest when published | No real article | Draft slug returned 404 | Tested HTTP status for one draft slug | Article HTML, metadata, image and sharing of a *real published* article remain unverified |
| `/FAQ` | Help nav / direct URL | Guest | Desktop | Yes: [FAQ](screenshots/route-FAQ.png) | Open direct URL | FAQ expansion not individually exercised |
| `/Status` | Direct URL | Guest | Desktop | Yes: [Status](screenshots/route-Status.png) | Open direct URL | Status updates/backend validity not verified |
| `/updates` | Settings → What's new / direct | Guest | Desktop | Yes: [updates](screenshots/route-updates.png) | Open direct URL | Historical release claims not independently checked |
| `/PrivacyPolicy` | Settings/legal / direct | Guest | Desktop | Yes (HTTP + browser) | Open direct URL | Legal review outstanding per page |
| `/TermsAndConditions` | Settings/legal / direct | Guest | Desktop | Yes: [Terms](screenshots/route-TermsAndConditions.png) | Open direct URL | SF-06; no legal certification |
| `/CookiePolicy` | Consent/legal / direct | Guest | Desktop | Yes (HTTP + browser) | Open direct URL | Preference state persistence not exhaustively tested |
| `/RefundPolicy` | Settings/legal / direct | Guest | Desktop | Yes (HTTP + browser) | Open direct URL | Legal review outstanding per page |
| `/Admin` | Direct URL / authorized profile | Admin claim required | Not tested | Guest route visited, access message | Observed guest gate and `noindex` after JS | Admin screens and Map Editor not tested; no approved admin session |
| `/StatusAdmin` | Direct URL | Admin claim required | Not tested | Guest route visited | Observed guest-access route response | Editor not tested; no approved admin session |
| Unknown route | Direct URL | Guest | Desktop | Yes: [visual error](screenshots/route-definitely-not-a-route.png) | Direct HTTP + rendered 404 | HTTP 200 defect SF-04 |
| `robots.txt`, `sitemap.xml` | Direct HTTP | Public | N/A | Yes via `scripts/seo-http.js` | Status, content type, canonical host, article count | Search Console indexing state unavailable |
| Contact/support | Journal footer link / email client | Guest | Source link observed | No submission | Link observed | External email client and support delivery untested |
| Account management / deletion / subscription | Settings/account source | Signed-in | Source only | No | None | Requires authorized test account and safe environment |

## Personas and devices

| Persona | Coverage |
|---|---|
| New visitor | Tested initial cookie/privacy banner and introduction in a fresh CLI session. |
| Returning visitor | Tested persisted theme/language/text preference within one browser session; fresh-install persistence and long-term return not tested. |
| Signed-out guest | Main route and interaction coverage above. |
| Signed-in verified user | NOT TESTED: no authorized credentials supplied. |
| Unverified user | NOT TESTED: no safe account supplied. |
| Administrator | NOT TESTED beyond guest-access route: no approved admin session supplied. |

Map was viewed at **320×568, 375×667, 390×844, 430×932, 768×1024, 1024×768, 1366×768 and 1920×1080**. The eight page-level overflow checks all returned false; SF-01 is internal dialog clipping missed by that check. Portrait and landscape viewport dimensions were covered, but touch hardware, soft keyboard, standalone PWA, iOS safe areas, 125%/200% *browser zoom*, and physical iOS Safari remain unverified. The built-in text-size control was tested at 200% on 320 px. Light and dark theme settings and Czech/German partial language states were viewed. Reduced-motion behavior was not exercised.

## Safe edge cases

Tested: nonexistent route, draft article URL, zero-result search, guest-only drafts empty state, new guest create form up to Save, temporary blank basemap during a location jump followed by successful rendering, and a single missing optional POI detail JSON response. Not tested: offline, slow network throttling, mocked unavailable API, malformed uploads, oversize images, expired session, canceled popup, rapid repeated state changes, or refresh during an actual draft. These require controlled mocks or a safe authenticated environment before conclusions.
