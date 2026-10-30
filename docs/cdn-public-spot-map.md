# CDN-first public spot map: local prototype and release gate

**Status (2026-10-30): local prototype only. Production flag is off. No publisher, Firebase infrastructure, billing, Security Rules, App Check, or deployment was changed.** This builds on [the consumption audit](firebase-consumption-audit.md), [the cache baseline](firebase-consumption-optimization.md), and [the marker proposal](public-marker-snapshot-proposal.md).

## Architecture decision and cost

Use **build-generated static files on the existing Vercel deployment** for the local prototype. A trusted future server-side exporter would read Firestore as authority, select only approved public spots, write 2-degree region files with content-hash filenames, then publish a small manifest last. The `/new` MapLibre path can read only regions intersecting the viewport. A region edit creates one new region file; unchanged region URLs are reused. A CDN hit executes no Firestore query. Opening a full detail still reads the live Firestore spot and rechecks visibility. Likes, saves, ratings, drafts, publishing, moderation, authentication, Nearby's radius search, and Discover's global ordered pages retain their existing Firebase paths.

| Option | Update and removal behavior | Hobby exposure and complexity | Decision |
| --- | --- | --- | --- |
| Static build files | Atomic manifest change on a new deployment; each content change needs a deployment. Emergency removal requires new deployment and cache purge; old browser copies cannot be erased. | No new storage service. Existing CDN transfer/requests count against Hobby usage; deployment/build limits make high-frequency updates impractical. | **Chosen for local prototype only.** |
| Vercel Blob | Region object uploads and manifest pointer can update without deploying the app; needs trusted writer, ordering, cleanup and takedown process. | Hobby includes 1 GB-month, 10 GB Blob transfer, 10,000 simple operations and 2,000 advanced operations, shared with existing usage. At the Hobby limit Blob becomes unavailable rather than automatically charging. New service and write privileges need approval. | Candidate for frequent production updates, **not created**. |
| CDN-cached Vercel Function | Can query Firestore on cache miss and serve hits without a query; invalidation, cold spikes and cache key design are harder. | Function CPU/memory/invocations plus CDN usage. Hobby includes 1 million invocations and 4 active CPU hours; misses can still create Firestore cost. | Rejected for this first phase. |

Current official references: [Vercel CDN usage](https://vercel.com/docs/manage-cdn-usage), [static caching](https://vercel.com/docs/caching/cdn-cache), [Hobby deployment and file limits](https://vercel.com/docs/limits), [Blob pricing and limits](https://vercel.com/docs/vercel-blob/usage-and-pricing), [Function pricing](https://vercel.com/docs/functions/usage-and-pricing). Vercel lists Hobby CDN allowances of 100 GB Fast Data Transfer and 1 million Edge Requests; static traffic is still metered. These figures are plan documentation, not a forecast for SpotFinder. Validate current account usage and terms before selecting a production publisher.

## Local implementation

- `scripts/public-spots/export.mjs` accepts a **complete local input file** and has no Firebase credentials or network client. It is not a production publisher. It filters to `is_public === true`, `status === published`, no review/hidden/sensitive flags, validates coordinates, and emits an explicit marker-field allowlist. The only photo field is a same-origin, approved `/public-thumbnails/...` path. No arbitrary Storage URL, owner identifier, email, draft, report, or moderation field is copied. The exporter refuses duplicate visible IDs. Future publisher must read records using a trusted server identity; never accept browser JSON as the source.
- Region files are named `v1/rY-X-<content hash>.json`; the manifest contains the region map and its own content-derived version. Existing region files are not rewritten. The manifest file is written after region files using a local rename. **A Vercel deployment, not a filesystem rename, would be the atomic production switch.** No synthetic file was placed in `public/` or `dist/` by this work.
- `src/new/publicSpotSnapshotClient.js` reads a fresh manifest, deduplicates and retains up to 128 immutable region requests, clips to viewport, validates the public allowlist and same-origin thumbnail path, and retries a failed fetch once after 150 ms. It never falls back to Firestore on snapshot failure. A missing/invalid region or a view wider than 16 cells is a map-data error; the `/new` UI shows its existing retry state and clears stale markers.
- `/new` uses this path only when `VITE_PUBLIC_SPOT_SNAPSHOTS=true` in Vite dev or an explicit `snapshot-staging` build mode. Normal production builds always use the existing Firestore path, even if the flag is set. The original map is unchanged. The search panel uses the current snapshot rows instead of secretly re-querying the viewport. Nearby and Discover still use Firestore as noted above.

The prototype deliberately does **not** provide a production change feed, publisher credentials, generation schedule, live rollback flag, or CDN purge automation. If production is approved, keep a separately controlled emergency switch to the existing Firestore map; switching it requires an operator-approved deployment. A public cache must never contain private user-specific responses.

## Publication, ordering and takedown design

1. A future trusted publisher must re-read the **current** Firestore document for every change event and apply the same allowlist and visibility checks. It must persist a monotonic source revision per spot and a tombstone for deletions/hides. The pure local state model in `publicationState.mjs` rejects duplicate and older revisions, including attempts to resurrect a tombstoned spot. It is not a deployed event handler.
2. Coalesce changes per region. Write only changed region files, verify their availability, then commit a manifest pointer. Serialize manifest commits or use compare-and-swap so an older job cannot overwrite a newer manifest. Periodic reconciliation against Firestore is needed to repair missed events; do not regenerate every global region after each edit.
3. Define a maximum publication and takedown delay before release. On an urgent hide: block full-detail access immediately through current Firestore visibility, publish a tombstone/new manifest, remove old region objects from the active deployment or Blob store as applicable, and purge CDN caches. Disable the snapshot flag with an approved rollback deployment if the publisher cannot complete. Already delivered immutable browser copies cannot be remotely erased; do not put sensitive data into them.
4. Validate new, edited, deleted and moderated spots through the same process. The current local tests cover manifest invalidation and revision ordering, but **no hosted event, CDN propagation or emergency takedown test has happened**.

## Synthetic measurements

`node scripts/public-spots/benchmark.mjs` uses in-memory synthetic records and mock fetches. Its modeled Firestore comparison uses the *same* records for three distinct 300-document viewport queries and one warm same-view cache hit; it does not run the SDK. The earlier [Firestore emulator baseline](firebase-consumption-optimization.md) measured the current broader journey at 100/1,000/10,000 spots: 6 query invocations, 136/616/616 returned documents and 274,109/1,241,180/1,241,601 serialized bytes. Those figures include Nearby, Discover, detail and profile and are **not directly comparable** with the map-only figures below.

| Synthetic spots | Map-only Firestore model: queries / docs / JSON bytes | Snapshot model: map Firestore reads | Manifest / region mock fetches across cold, warm, pan, zoom, edit | Region JSON bytes across fetched files | Cold / warm local parse ms |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 3 / 30 / 58,629 | 0 | 5 / 2 | 7,152 | 0.97 / 0.14 |
| 1,000 | 3 / 300 / 586,902 | 0 | 5 / 2 | 71,334 | 1.04 / 0.09 |
| 10,000 | 3 / 900 / 1,762,066 | 0 | 5 / 4 | 758,810 | 9.87 / 0.49 |

The cold/warm timings are local in-memory parser times, **not time to visible MapLibre markers**, network latency, CDN telemetry, or billed Firestore egress. The benchmark's edit caused one changed-region fetch at every size. Opening five synthetic details corresponds to five live point reads in the intended design; the local fixture serialized to 9,771/9,777/9,786 bytes. A warm map still checks the manifest on a subsequent read; immutable region requests are reused. Real browser cache and CDN hit rates are unmeasured. The 10,000-spot fixture has a dense viewport capped at 300 markers, matching the current `/new` cap; a production design must evaluate completeness and dense-region file sizes.

| Journey action | Current behavior | Snapshot prototype behavior / evidence |
| --- | --- | --- |
| Cold map, warm map, pan, zoom, remount | Bounded Firestore viewport reads, with shared cache and in-flight deduplication | Manifest and only intersecting region files; repeat region URLs reuse pending/completed requests. Synthetic benchmark above, no browser remount timing. |
| Nearby, Discover | Radius and ordered Firestore queries | Unchanged; previous emulator journey includes their reads. They are not counted as a snapshot saving. |
| Open five spots | Live full spot reads as needed | Five modeled live detail reads. Snapshot marker is never treated as a full authorized detail. |
| Publish, edit, delete, moderation hide | Authoritative Firestore writes and protected Functions | Local exporter changes manifest; hide/delete removes marker. No live publisher or propagation latency measurement. |
| Snapshot cache miss, outage, malformed response | No snapshot path in current app | One retry then visible map-data error, zero automatic Firestore fallback. Focused tests. |
| Slow or out-of-order change event | No production publisher | Local revision model rejects older and duplicate changes; end-to-end slow event delivery is untested. |

## Tests, staging instructions and rollback

Focused Node tests cover public-field exclusion, publication/edit/hide/delete manifest changes, antimeridian and clipping, detail-on-click, bounded outage retry with zero Firestore fallback, changed/removed-region invalidation, malicious extra fields, transient cache miss, and duplicate/out-of-order tombstones. No browser automation or production requests were run. The standard Vite production build was run with the repository's required process-scoped `VERCEL_ENV=production` marker.

For **local staging only**: (1) use a demo Firebase project and the Firestore Emulator Suite, never the production project; (2) create a synthetic JSON array and run `node scripts/public-spots/export.mjs <synthetic-input.json> public/spot-snapshots` in a disposable checkout; (3) set `VITE_PUBLIC_SPOT_SNAPSHOTS=true` for that process and run `npm run dev`; (4) inspect `/new` map cold/warm pan and zoom, forced manifest/region 404, malformed region, five details, Nearby/Discover and the browser network panel; (5) confirm no viewport Firestore request in snapshot mode, no private data in files, and explicit errors on outage. A future hosted preview would require a separate demo Firebase configuration and a `snapshot-staging` Vite build; **do not point an enabled snapshot preview at production Firebase or deploy it from this phase.** Remove the disposable `public/spot-snapshots` output afterward.

Rollback for this prototype: unset the local flag or use a normal Vite production build. The production app still uses Firestore and needs no rollback today. A future live rollout needs an approved operator switch, a prior known-good manifest, explicit cache purge procedure and a measured return-to-Firestore budget.

## GO / NO-GO

**GO for local demo/emulator validation. NO-GO for production.** Required gates: approve hosting method and billing exposure; implement and security-review the trusted server publisher; prove revision persistence and reconciliation; set a takedown SLA; test real CDN cache/old-version removal and browser behavior; measure actual visible-marker latency, bytes, cache hit rate and Firestore reads in a safe hosted preview; ensure dense and wide viewports remain usable. No production publisher or paid service was created.
