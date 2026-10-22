# Prioritized implementation roadmap

This is an audit recommendation, not an implementation record. The application was not changed or deployed. Issue IDs link to reproduction and evidence in [ISSUES.md](ISSUES.md).

| Order | Change | Owner / effort | Acceptance check | Regression risk |
|---|---|---|---|---|
| 1 | Make Settings reflow at 320 px with 200% text (SF-01) | Frontend / S–M | All labels and controls fit or scroll without clipping at 320×568; keyboard can reach them | Low–medium, shared dialog styling |
| 2 | Publish one factual, attributed Journal article via existing draft workflow (SF-02) | Owner/editor / M | Real article loads directly, has unique raw HTML title/description/canonical, OG/Twitter, BlogPosting, date, image alt/credit, internal link, sitemap URL, 404 for draft | Medium editorial; low technical if workflow works |
| 3 | Serve spot-specific metadata for public spot deep links (SF-03) | Frontend/deployment / M–L | Raw HTTP source and share preview name the actual spot and canonical URL | Medium, data/deployment coupling |
| 4 | Return 404 from server for unknown SPA paths (SF-04) | Deployment/frontend / M | Unknown extensionless path is HTTP 404; `/`, known SPA pages and valid `/spot/:id` still load directly | Medium, routing precedence |
| 5 | Add distinct zero-result and provider-error search states (SF-05) | Frontend / S | Impossible query reports no results; safe mocked outage reports retry; valid suggestions still work | Low |
| 6 | Complete public legal/operator review (SF-06) | Owner and qualified counsel / M | Operator details and affected policy copy verified; pending-review text resolved | Legal review dependent |
| 7 | Restore browser zoom in viewport configuration (SF-07) | Frontend / S | Pinch zoom works on real iOS/Android while map gestures and dialogs remain usable | Medium, gesture behavior |
| 8 | Fact-check and edit visible spot copy/fallback card (SF-08) | Editor/contributor / S | Blejski grad prose is accurate/readable; “Viewpoint” names a real place if verified | Low, factual accuracy |
| 9 | Render popup dynamic strings as text (SF-09) | Map engineer / S–M | Harmless special characters render literally in traffic and admin POI popup; no HTML interpretation | Low–medium |
| 10 | Finish tested German helper strings and sample Czech/German core flows (SF-10) | Localization / S | Settings instructions and release-note subtitle use selected language; partial label remains until coverage is real | Low |

## Quick wins

SF-05, SF-08 and SF-10 are small scoped edits. SF-07 is small in code but needs physical mobile regression checks. SF-09 is a small construction change if the popup data boundary is understood. Do not change map tiles or imported POI data to address these.

## Larger work

SF-03 and SF-04 involve raw HTTP behavior, so a React-only meta update is insufficient. SF-02 is primarily real content creation and verification, using the current `content/news/` generation and Vercel workflow; it does not call for a new CMS. Legal review (SF-06) depends on verified business facts and qualified review, not UI styling.

## Distinctive product direction

Keep the map-first interface, category marks, community context and Journal typography. Improve specificity: authentic place names, sourced details, contributor credit, photo provenance, and a clear relationship between a selected map point and its information sheet. Use real stories tied to real SpotFinder spots when available. Avoid cloning Linear's SaaS chrome or adding competitor-scale route features without a user need.

## Verification sequence

After changes, run focused tests for the affected component and one production-equivalent build; then inspect the deployed routes with official Playwright CLI at 320/390/1366 px. Check raw HTTP statuses and metadata before JavaScript, and use Google Search Console URL Inspection for the first published story. Do not claim indexing solely because a URL appears in a sitemap.
