# Batch 1 local verification — 22 October 2026

The original production audit remains a historical snapshot. These checks used the official Microsoft Playwright CLI against a local Vite preview and, after a small follow-up CSS/entry-control change, the local Vite development server. Nothing was deployed. Browser viewports are emulation, not physical iOS devices.

| Issue | Local result | Evidence |
|---|---|---|
| SF-01 | 20 English Settings combinations (five viewports × 100/150/200/250%) had zero descendants outside the viewport; the scroll area reached its bottom. Czech and German at 320×568/200% had zero overflow. The language picker and theme switch worked at 320×568/200%. | [320×568/200%](settings-320-200-final.png), [390×844/100%](settings-390-100-final.png), `settings-matrix.js`, `settings-locales.js` |
| SF-05 | Controlled valid, empty, total failure, partial failure, retry and delayed response cases passed. Czech and German empty-state messages appeared in the UI. Selecting the Vienna result changed the search field and map zoom; the later [Basic map screenshot](map-after-basic.png) shows Vienna labels. | [Results](search-results.png), [empty](search-empty.png), [failure](search-failure.png), `search-check.js`, `search-partial-failure.js`, `search-locales.js` |
| SF-09 | Controlled traffic and admin POI data containing `<example> & "quoted text"` remained literal text, produced no `example` element, and an invalid color fell back to a safe value. Both affected call sites now pass DOM nodes to `setDOMContent`. Local MapLibre fixture markers opened and closed both popup types. | [Traffic popup](traffic-popup-open.png), [admin popup](admin-popup-open.png), `popup-map-check.js` |

Focused Node tests: 4 passed. Targeted ESLint: passed. `npm run build` passed on the final source. An earlier build also passed before the browser revealed a narrow release-notes row and an obscured mobile More button; the final build was repeated to include those fixes and the partial-provider search adjustment.

Regression checks: zoom indicator changed 15→16; drag gesture was sent to the map; Nearby filter sheet opened; language dropdown changed German→Czech; search result selection kept its map action. Switching to Outdoor produced a MapLibre style validation error about nonascending `interpolate` stops in `layers[11]` and `layers[12]`. This path was not changed in Batch 1 and the map rendered again after selecting Basic. Imported POI and community marker selection, live traffic/admin marker data, and physical iOS Safari were not verified in this bounded local session.

## Owner deployment steps

1. Review the changed source files and this evidence. The final source passed `npm run build` locally; Vercel will run the same command again during deployment.
2. Commit the reviewed changes and push to the Git branch configured as the Vercel production branch. The repository's `vercel.json` uses `npm run build` and publishes `dist`; no separate deploy command is needed when its Git integration is enabled.
3. Wait for Vercel to report a successful production deployment. On the production host, recheck Settings at 320 px/200%, a valid and impossible search, Retry if a provider outage can be safely simulated, and ordinary traffic/admin popups when suitable markers exist.
4. Keep SF-01, SF-05 and SF-09 labeled “local fix, production pending” until those production checks are complete.
