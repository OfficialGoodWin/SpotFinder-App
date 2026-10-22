# SpotFinder quality audit — ranked issue register

Tested 22 October 2026 on the live production site with official Microsoft Playwright CLI 0.1.22. Severity follows the rubric in the audit request. Browser viewport tests are emulation, not physical device tests. Paths below are relative to this audit folder. The original audit did not change application code. Batch 1 local fixes and their evidence are recorded below; production has not been deployed or rechecked.

**Batch 1 status:** SF-01, SF-05 and SF-09 are fixed in the local source and verified with Playwright CLI. SF-09 used controlled local MapLibre markers because live traffic/admin markers were unavailable. All three still require production verification after the owner's deployment.

| Rank | ID | Severity | Category | Finding | Confidence |
|---|---|---|---|---|---|
| 1 | SF-01 | P1 | Accessibility / mobile | Settings content extends beyond a 320 px screen at 200% text size | High: reproduced twice, measured DOM bounds |
| 2 | SF-02 | P1 | Content / Journal | Public Journal has no published article; its main editorial promise has no destination | High: live `/news`, sitemap and generated data |
| 3 | SF-03 | P2 | SEO / sharing | Direct spot URLs serve generic home metadata in raw HTML | High: production HTTP response and rendered page |
| 4 | SF-04 | P2 | HTTP / SEO | Unknown non-Journal path returns HTTP 200 with a visual 404 | High: production HTTP and browser response |
| 5 | SF-05 | P2 | Search / error feedback | Zero-result search gives no explicit empty message | High: live mobile interaction |
| 6 | SF-06 | P2 | Trust / legal review | Public Terms, Privacy and Refund copy states review is pending | High: live page and source; legal adequacy unassessed |
| 7 | SF-07 | P2 | Accessibility | Initial viewport metadata disables user scaling | High for markup; platform impact requires physical testing |
| 8 | SF-08 | P2 | Content quality | Prominent spot description has errors; one featured card is generic | High: visible live text and card |
| 9 | SF-09 | P2 | Security hardening | Map popups insert provider/admin strings into `setHTML` without visible escaping | High for code pattern; exploitability unverified |
| 10 | SF-10 | P3 | Localization | German settings visibly mixes translated and English helper copy | High; language is clearly labeled partial |

## SF-01 — Enlarged Settings content clips on narrow screens

- **Route/screen/device:** `/`, Settings, 320 × 568 browser viewport, built-in text size 200%.
- **Reproduce:** Open Settings from More map options; focus “Text size percentage”; set to 200% (End, ten ArrowLeft presses). Scroll Settings.
- **Expected:** All labels and controls reflow inside the dialog and remain readable/operable.
- **Actual:** Sections and controls are 325 px wide starting at x=50, reaching x=375 outside a 320 px viewport. “Map discovery card” and other content visibly clip. The page itself reports `scrollWidth=320`, so page-level overflow checks miss it.
- **Evidence:** [screenshot](screenshots/settings-200pct-320.png), [Playwright action trace](traces/settings-200pct.trace), `scripts/text-scale-bounds.js` output (e.g. Language combobox x=50..375). Session-specific network payloads were omitted from the shared trace artifact.
- **User impact:** People who need larger text cannot read or reach some Settings content on a narrow phone.
- **Confidence:** High; reproduced in two browser sessions. This is browser emulation, not iOS Safari hardware.
- **Suggested fix:** Remove fixed/minimum widths inside Settings at narrow widths; let child controls shrink with `min-width:0`, wrap text, and retest 200% and 250%.
- **Effort/risk:** S–M / low to medium, because shared dialog styles may change.
- **Batch 1 local verification:** Settings had zero measured descendants outside the viewport at 100%, 150%, 200% and 250% for 320×568, 375×667, 390×844, 430×932 and 1366×768. The scroll body reached its bottom in all 20 cases. Czech and German at 320×568/200% also had zero overflow. The language dropdown and dark-mode switch were operated at 320 px/200%; the mobile More control was made reachable after reopening at enlarged text. [Final 320 px screenshot](batch1/settings-320-200-final.png), [test scripts](batch1/settings-matrix.js).

## SF-02 — Journal has no published article

- **Route/screen/device:** `/news`, desktop and raw HTTP; mobile article layout untestable without a real article.
- **Reproduce:** Open `/news`, inspect the archive and click destinations; request `/sitemap.xml`; request a draft slug such as `/news/five-places-near-prague`.
- **Expected:** Once the Journal is presented as a source of real stories, visitors have at least one verified article to read, and published article URLs appear in the sitemap.
- **Actual:** The landing says “First stories land in November”; there are no article links. The sitemap has nine non-article URLs. The draft slug returns HTTP 404, correctly keeping drafts private. Local `src/news/published.generated.json` is empty and five `content/news/*.json` entries are drafts.
- **Evidence:** [Journal screenshot](screenshots/route-news.png), `scripts/seo-http.js`, `src/news/published.generated.json`, `content/news/`.
- **User impact:** The product's editorial discovery path currently ends at a launch placeholder; search engines have no actual story to index.
- **Confidence:** High for the audited deployment. Absence is a readiness gap, not a broken publish mechanism. Do not publish fabricated material to satisfy this issue.
- **Suggested fix:** Owner writes and fact-checks a real article with licensed photo, then uses the existing draft-to-published workflow. Confirm its raw HTML, direct URL and sitemap after Vercel deployment.
- **Effort/risk:** M / medium editorial risk; small technical effort.

## SF-03 — Raw spot pages have generic metadata

- **Route/screen/device:** `/spot/AIyFTk1eTE7gD5INyomX`, desktop/mobile; HTTP without JavaScript.
- **Reproduce:** Request the direct URL and inspect its original HTML response, then open it in a browser.
- **Expected:** The HTML for a public spot should have a spot-specific title, description, canonical URL and useful social preview for link unfurlers/crawlers.
- **Actual:** Initial HTTP 200 HTML has `<title>SpotFinder</title>`, generic map description and canonical `https://www.spotfinder.live/`. JavaScript later renders “Blejski grad” and changes the browser title to “SpotFinder | Community place”; the raw response has no spot-specific structured data.
- **Evidence:** `scripts/seo-http.js`, [live spot screenshot](screenshots/featured-spot-detail-desktop.png), [mobile detail](screenshots/spot-mobile.png), `index.html:50-57`.
- **User impact:** Shared spot links can preview as the generic homepage and provide weak crawlable detail.
- **Confidence:** High for this spot and current deployment. Do not infer Google indexing outcomes.
- **Suggested fix:** Add a bounded server/prerender response for public spot URLs using existing published spot data, or explicitly make these URLs noindex until metadata can be generated. Avoid extra Firebase reads for ordinary article views.
- **Effort/risk:** M–L / medium, depending on deployment routing and spot data access.

## SF-04 — Unknown SPA route returns HTTP 200

- **Route/screen/device:** `/definitely-not-a-route`, desktop, direct HTTP and browser.
- **Reproduce:** Request the URL directly; compare status to the rendered page.
- **Expected:** A genuinely nonexistent route responds with HTTP 404.
- **Actual:** HTTP 200 serves the generic home HTML. React then shows “Error 404 / This spot doesn’t exist” and adds a `noindex` meta tag after JavaScript. Vercel's broad extensionless rewrite in `vercel.json` explains this behavior. A missing `/news/...` slug correctly returns 404.
- **Evidence:** [browser screenshot](screenshots/route-definitely-not-a-route.png), `scripts/seo-http.js`, `vercel.json:51-68`.
- **User impact:** Crawlers and link checkers receive a false success; the original response is indexable until JavaScript runs.
- **Confidence:** High for this tested unknown path; other unknown patterns were not sampled.
- **Suggested fix:** Narrow rewrites to known client routes or route unknown paths through a 404 response while preserving valid deep links.
- **Effort/risk:** M / medium because route precedence matters.

## SF-05 — Search gives no zero-result feedback

- **Route/screen/device:** `/`, search, 390 × 844 browser viewport.
- **Reproduce:** Type `Prague Castle`; wait for suggestions; replace with `zzzznotaplace123456`; wait four seconds.
- **Expected:** A clear “No places found” state with an action to retry, clear or broaden the query.
- **Actual:** Valid query shows suggestions; impossible query removes them and shows only the entered text. The featured panel remains behind the search field and provides no explanation.
- **Evidence:** [results](screenshots/search-mobile-after-wait.png), [empty query result](screenshots/search-no-results-mobile.png), `scripts/search-recheck.js`.
- **User impact:** Visitors cannot tell whether the search completed, failed or found nothing.
- **Confidence:** High for this single safe query. API failure handling was not separately mocked.
- **Suggested fix:** Distinguish loading, zero results and provider failure in the suggestion panel.
- **Effort/risk:** S / low.
- **Batch 1 local verification:** Mocked provider responses showed results, a persistent zero-result message with Clear search, a separate provider-error message with a working Retry, and no stale result after a slower earlier query. A partial provider outage with no matches showed an error, while a result from the working provider remained usable. Czech and German zero-result copy appeared in the browser. [Results](batch1/search-results.png), [empty](batch1/search-empty.png), [failure](batch1/search-failure.png), [test script](batch1/search-check.js).

## SF-06 — Legal pages publicly state review is pending

- **Route/screen/device:** `/TermsAndConditions`, `/PrivacyPolicy`, `/RefundPolicy`, desktop.
- **Reproduce:** Open each public page. The Terms banner and body name unresolved operator identity, governing law, subscriptions and consumer-rights review.
- **Expected:** Customer-facing legal text should have verified operator details and completed professional review before representing the launched service.
- **Actual:** The pages explicitly mark themselves pending review. The Terms also say operator registration/address/tax disclosures are unconfirmed. The language is candid, so this is a trust/completion issue rather than hidden deception.
- **Evidence:** [Terms screenshot](screenshots/route-TermsAndConditions.png), `src/pages/TermsAndConditions.jsx`, `src/pages/PrivacyPolicy.jsx`, `src/pages/RefundPolicy.jsx`.
- **User impact:** A visitor deciding whether to create an account or contribute content sees unfinished governance information.
- **Confidence:** High for text shown; no legal compliance opinion.
- **Suggested fix:** Have the owner verify operator facts and obtain qualified legal review, then update the exact affected pages.
- **Effort/risk:** M / legal-review dependent.

## SF-07 — Initial viewport markup disables scaling

- **Route/screen/device:** App shell, mobile browsers.
- **Reproduce:** Inspect the initial HTML viewport tag.
- **Expected:** Browser zoom should remain available to people who need it.
- **Actual:** `index.html:48` includes `maximum-scale=1.0, user-scalable=no`. The app's own scale control does not make this safe, as SF-01 demonstrates.
- **Evidence:** `index.html:48`; [SF-01 screenshot](screenshots/settings-200pct-320.png).
- **User impact:** May prevent pinch zoom in browsers that honor these values. Physical iOS Safari behavior was not tested.
- **Confidence:** High for source; platform-specific impact unverified.
- **Suggested fix:** Remove the scale restriction and retest map gestures, dialogs and text at 200% browser zoom.
- **Effort/risk:** S / medium on map gesture behavior.

## SF-08 — Prominent place copy needs editing

- **Route/screen/device:** Featured cards and Blejski grad spot detail, desktop/mobile.
- **Reproduce:** Open Featured places, then Blejski grad.
- **Expected:** Featured places should have specific titles and readable, accurate descriptions.
- **Actual:** A featured card is titled only “Viewpoint” with coordinates `47.40, 9.38`; Blejski grad includes “A Castle above a lake either a beautiful view...” and “when youre outside ... a opening”.
- **Evidence:** [featured cards](screenshots/featured-desktop.png), [spot detail](screenshots/spot-mobile.png).
- **User impact:** Small visible editorial mistakes weaken trust in location information. These words cannot establish AI authorship.
- **Confidence:** High for text; factual accuracy of the place has not been independently checked.
- **Suggested fix:** Edit the specific record after verifying facts with its contributor or a reliable source; give the generic card a real place name if known.
- **Effort/risk:** S / low, with content verification required.

## SF-09 — HTML interpolation in map popups needs a trust-boundary review

- **Route/screen/device:** Traffic popup and admin POI popup, source review only.
- **Reproduce:** Inspect `src/components/map/MapLibreMap.jsx:1318-1321` and `:1375-1431`. Strings from traffic properties and POI fields are inserted into HTML templates passed to MapLibre `setHTML`.
- **Expected:** Dynamic text is added as text nodes or escaped before HTML parsing.
- **Actual:** The cited construction does not visibly escape `roadNumbers`, `from`, `to`, POI name or address fields. We did not inject a payload, inspect server validation, or establish exploitability in production.
- **Evidence:** Source locations above. No security exploit screenshot exists.
- **User impact:** Potential browser injection if untrusted values can reach these popups. The risk and severity need validation at the provider/admin data boundary.
- **Confidence:** High for unsafe construction; medium for exposure; low for exploitability.
- **Suggested fix:** Construct popup DOM with `textContent` or apply a well-reviewed escaping layer; test with harmless reserved characters.
- **Effort/risk:** S–M / low to medium.
- **Batch 1 local verification:** Both affected MapLibre construction paths now use `setDOMContent` and text nodes for dynamic values. The browser rendered `<example> & "quoted text"` literally in traffic and admin popup content, created no `example` element, and rejected an invalid admin color. Controlled local MapLibre traffic/admin markers both opened and closed their popups on click. [Traffic popup](batch1/traffic-popup-open.png), [admin popup](batch1/admin-popup-open.png), [test script](batch1/popup-map-check.js). Suitable live traffic/admin markers were not available in the bounded session.

## SF-10 — German translation remains visibly mixed

- **Route/screen/device:** Settings, desktop, German selected.
- **Reproduce:** Settings → Select Language → Deutsch. Read Map display and App information helper copy.
- **Expected:** The partial-language notice should be accurate and the most important helper text should follow the selected language where translations exist.
- **Actual:** Settings is mostly German, but “Show contextual spots and exploration guidance on the map”, “Applies throughout SpotFinder”, and “Release notes and verified changes” remain English. The picker and status explicitly say the translation is incomplete.
- **Evidence:** [German Settings](screenshots/settings-german.png), browser snapshot from the audit session.
- **User impact:** Lower comprehension for non-English speakers; transparency reduces surprise.
- **Confidence:** High for this screen; full locale coverage was not audited.
- **Suggested fix:** Translate these specific strings and check core tasks before promoting German beyond “partial”.
- **Effort/risk:** S / low.

## Observations deliberately not escalated

- A Turnov basemap briefly appeared blank after jumping there, then loaded normally on recheck. [After-wait screenshot](screenshots/map-town-after-wait.png). It is not established as a persistent defect.
- One rural imported POI requested `/poi-details/10/555/344.json` and got 404; its sheet still opened with title, contact link and coordinates. This may be an optional detail shard, so the audit does not claim a broken POI journey. [POI screenshot](screenshots/poi-detail-rural.png).
- Search took longer than 1.7 seconds in an initial capture but completed by six seconds; it is not recorded as a search failure.
