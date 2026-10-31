# Public spot snapshots: staged static publishing pipeline

Phase 3 local work and current blockers are recorded in [the Phase 3 staging handoff](cdn-public-spot-phase3.md).
Phase 4's realtime revocation listener and recovery work are recorded in [the Phase 4 handoff](cdn-public-spot-phase4.md).

**Status, 2026-10-31: working local and emulator pipeline; staging and production are not deployed. Production is NO-GO.** Firestore remains authoritative. Firebase Auth, Storage, App Check, Rules, protected writes, Nearby and Discover are unchanged. This phase extends [the consumption audit](firebase-consumption-audit.md) and [the optimization baseline](firebase-consumption-optimization.md).

## Visibility and privacy contract

The current Firestore Rules and public map queries allow `is_public == true` with status `published` **or** `pending_trust` ([Rules](../firestore.rules), [browser API](../src/api/firebaseClient.js)). `submitSpot` creates `pending_trust` unless the account is verified and has three published spots. Admin status changes, owner edits/deletes, flag reconciliation and several Functions can update a spot. Rules do not hide a published spot merely because `needs_review` is true or an open report exists. This snapshot pipeline intentionally publishes a **narrower approved subset**:

- `is_public === true`, `status === 'published'`, `needs_review !== true`, `flag_count` absent or exactly zero, `discovery_state !== 'hidden'`, `sensitive_location !== true`, valid coordinates and public spot ID.
- A full staging reconciliation also excludes any spot referenced by an open `flags` record or open `reports` record with `target_type === 'spot'`.
- The exporter creates fields from an explicit allowlist in [publicSpotSnapshotFormat.js](../src/new/publicSpotSnapshotFormat.js). It derives display title/category only from already public title/category fields; it never serializes Firestore documents, owner UID/email, draft text, notes, moderation metadata or arbitrary photo URLs. Only an already approved same-origin `/public-thumbnails/...` path can appear. Malformed records are skipped and counted; duplicate visible IDs abort.

**Staging coverage may be lower than the existing map** because `pending_trust` and reviewed/reported spots are omitted. Compare product behavior before any production approval. The current full-detail `getPublicSpotById` still accepts `pending_trust`; snapshot marker clicks re-read live Firestore and refuse deleted/hidden details.

## Implemented artifact and publishing flow

`scripts/public-spots/publish.mjs` uses the installed Firebase Admin SDK with application default credentials for **explicitly approved staging** or the Firestore emulator for `demo-spotfinder-snapshots`. It rejects the production project ID, remote emulator hosts, missing staging approval and missing output path. It performs a bounded, paginated reconciliation of `flags`, `reports` and `spots`, with a default 50,000-document aggregate read ceiling. It does not read production in this phase and does not write Firebase. It logs only counts and the resulting revision. A full reconciliation is deliberately expensive, so it is a manually started, batched repair tool rather than a per-like/per-rating trigger.

`scripts/public-spots/export.mjs` groups accepted spots into 2-degree cells, rounds public coordinates to six decimals, and builds schema **2** files at `spot-snapshots/v2/rY-X-<SHA-256-prefix>.json`. The small `spot-snapshots/manifest.json` includes `format`, `regionDegrees`, `revision`, `version`, `publishedAt` and region-to-file references. The revision hashes the ordered reference map; the client verifies both the manifest hash and each region's content hash. Output is deterministic for the same visible records, apart from the publication timestamp. An unchanged revision retains its timestamp.

The writer obtains an atomic local lock, builds a candidate in a sibling temporary directory, copies only unchanged **currently referenced** region files, reads back and validates every referenced file, then switches the local output. Previous output remains in a backup directory. A failed candidate is not exposed and is retained for inspection. This local two-rename switch is **not** a live Vercel publish. A Vercel deployment provides the actual static asset switch; writing from a running Function does not update deployed assets. The candidate's old immutable files are not copied into the current deployment, but old deployment URLs and already cached browser copies can remain accessible.

The [manual GitHub Actions workflow](../.github/workflows/staging-public-spot-snapshot.yml) uses a protected staging environment and Google Workload Identity Federation to create a reviewed artifact. It has no Vercel deployment step. It requires environment variables `SNAPSHOT_STAGING_WIF_PROVIDER`, `SNAPSHOT_STAGING_READER_SERVICE_ACCOUNT`, and `SNAPSHOT_STAGING_FIREBASE_PROJECT_ID`, an OIDC trust policy limited to this repository/environment, and a staging-only Firestore read role. No permanent service-account key is needed. Its concurrency group serializes candidate jobs. These external resources have **not** been configured or tested here.

For a later approved preview, [vite.config.js](../vite.config.js) can embed a previously reviewed candidate into a `snapshot-staging` build when `SPOTFINDER_SNAPSHOT_CANDIDATE_DIRECTORY` points to its extracted `spot-snapshots` directory. It validates region references before reading them and emits only current manifest references. Normal production builds never include a candidate. The staging build also requires the repository's existing isolated Firebase staging variables and project identity checks. The existing [Vercel headers](../vercel.json) require manifest revalidation and serve hashed v2 region paths as immutable.

## Map reader, freshness and failure behavior

Only `/new` uses the reader under `VITE_PUBLIC_SPOT_SNAPSHOTS=true` **and** either emulator development or explicit `snapshot-staging` mode with a staging Firebase target. The original map remains unchanged. The reader fetches a manifest at most once per five seconds per page, fetches only visible region files, verifies hashes and allowlisted fields, deduplicates simultaneous requests, retains at most 128 region promises with an approximately 20-million-character JSON cache budget and a 5-million-character per-region bound, caps the viewport at 16 cells and ignores stale React viewport results through the existing request sequence guard. Every active visible `/new` map refreshes at most every 30 seconds and on foreground return. A valid new manifest removes markers absent from the same viewport; an open selection removed from that viewport is closed. A failed manifest/region fetch retries once after 150 ms, then clears stale markers and shows the existing retryable map-data error. **No Firestore viewport fallback occurs.** Full details are still live Firestore point reads on demand.

After a **successful deployment** of a new manifest, an active visible tab should recheck within approximately 35 seconds (30-second poll plus five-second manifest memory TTL), excluding network delay; background tabs check when foregrounded. This is a design bound after deployment, **not a moderation-to-removal SLA**. A static deployment cannot guarantee when an admin hide reaches the CDN. Old immutable browser bytes cannot be erased remotely. A current alias stops serving prior region files when the new deployment omits them, but old deployment URLs can remain reachable. A true urgent takedown requires a separately approved lightweight revocation service or an operator deployment/purge process with a measured SLA. Production is blocked until that mechanism is chosen and tested. Do not roll back to an older data manifest without rechecking current Firestore visibility; it can resurrect removed spots. The safe rollback today is turning the feature off in a reviewed deployment and using the existing Firestore map.

The publisher has **no automatic Firestore change trigger**. The safe manual full reconciliation repairs missed events, but a spot that changes during a paginated scan can be missed until the next run. There is no guaranteed maximum moderation propagation delay yet. A production change journal or serialized trusted publisher, with revision persistence and reconciliation, is required before any automated freshness claim. The pure local revision model rejects duplicate/out-of-order changes, but is not a durable deployed journal. Likes/saves/ratings are deliberately not publication triggers.

## Exact safe commands

Local emulator integration (Java 21 is required by the installed Firebase CLI on this machine):

```powershell
$env:JAVA_HOME='C:\Users\Admin\.jdks\jbr-21.0.11'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
firebase.cmd emulators:exec --only firestore --project demo-spotfinder-snapshots "node scripts/public-spots/emulator-validation.mjs"
firebase.cmd emulators:exec --only firestore --project demo-spotfinder-snapshots "node scripts/public-spots/browser-staging.mjs"
node --test tests/public-spot-snapshots.test.js
node --max-old-space-size=4096 scripts/public-spots/benchmark.mjs
```

Local-only synthetic export: `node scripts/public-spots/export.mjs synthetic-spots.json <disposable-output-directory>`. Never pass a customer export to this convenience CLI. The trusted staging command, **not run**, is:

```powershell
node scripts/public-spots/publish.mjs --mode staging --project spotfinder-2-staging --out <candidate-output-directory> --read-approved
```

It requires separately approved staging ADC/WIF read credentials and a disposable staging dataset. For an approved preview deployment, download the reviewed candidate, set `SPOTFINDER_SNAPSHOT_CANDIDATE_DIRECTORY` to its extracted `spot-snapshots` directory for that one build, set all existing `VITE_FIREBASE_STAGING_*` and App Check staging values, `VITE_SPOTFINDER_STAGE=staging`, `VITE_PUBLIC_SPOT_SNAPSHOTS=true`, `FIREBASE_PROJECT_ID=spotfinder-2-staging`, and run `vite build --mode snapshot-staging` with a Preview target. Review the emitted `dist/spot-snapshots` files before any explicit Vercel Preview deployment. No preview deployment command is executed by this repository workflow. A standard production build must not use this mode or candidate directory.

## Measurements and cost boundaries

The benchmark uses equal synthetic viewport journeys: cold load, warm repeat, pan, zoom and return; three distinct full-document Firestore viewport queries are **modeled** from the same fixture, while snapshot HTTP calls are in-memory mocks. The model does not execute browser Firestore, Security Rules, indexes or real CDN requests. JSON byte counts are not Firestore wire egress or billed reads. Local parser time excludes real network, rendering and CDN latency. The 250,000-spot case loads multiple regions in Node, **not one browser viewport**.

| Synthetic public spots | Modeled Firestore queries / returned docs / JSON bytes | Mock snapshot HTTP requests / JSON bytes / gzip bytes | Total region artifact JSON / gzip bytes | Local cold / warm parse ms | Process RSS MiB |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 3 / 4 / 3,496 | 2 / 4,736 / 1,771 | 39,019 / 20,452 | 5.26 / 0.04 | 43.3 |
| 1,000 | 3 / 38 / 33,402 | 5 / 27,344 / 7,897 | 376,629 / 109,948 | 3.76 / 0.03 | 68.7 |
| 10,000 | 3 / 380 / 334,752 | 5 / 122,263 / 11,461 | 3,662,012 / 277,067 | 6.37 / 0.07 | 124.7 |
| 250,000 | 3 / 604 / 532,592 | 5 / 2,698,712 / 94,998 | 92,428,367 / 4,194,949 | 101.69 / 1.64 | 683.8 |

Each synthetic map journey made zero modeled Firestore viewport queries once snapshots were enabled. The exporter would read **at least** the number of spot documents shown, plus report/flag documents, on every full reconciliation; the emulator fixture actually used three queries and returned four documents before filtering. Five live detail reads remain for a five-spot opening journey (only two spots were visible in the 100-spot fixture). The 250,000-spot artifact is about 92 MB uncompressed and approaches [Vercel Hobby static upload limits](https://vercel.com/docs/limits) once the app bundle is included; it is not release-ready at that scale. The mock CDN journey can transfer *more* raw JSON than the modeled Firestore journey in sparse or dense cases; gzip/Brotli can materially reduce static bytes but actual Vercel compression and transfer must be measured. Six-decimal coordinates saved about 716 / 6,748 / 67,503 / 1,685,885 JSON bytes for the four sizes while retaining approximately sub-meter precision.

Local in-memory exporter build time was 17 / 22 / 183 / 4,301 ms at 100 / 1,000 / 10,000 / 250,000 spots. One synthetic edit changed one region file at each size. Local pan and zoom parsing at 250,000 spots took 2.19 and 0.35 ms, respectively; these timings exclude network delivery and MapLibre rendering. The 250,000-spot process reached about 684 MiB RSS. Dense regions need a separate hosted size and memory gate.

Illustrative **uncompressed** per-visitor journeys: for 10,000 spots, 100 / 1,000 / 10,000 visitors correspond to about 33.5 MB / 334.8 MB / 3.35 GB of modeled Firestore JSON versus 12.2 MB / 122.3 MB / 1.22 GB of snapshot JSON. These are simple multiplications, not production traffic, billed egress or a price prediction. CDN transfers and requests remain metered; see [Vercel CDN usage](https://vercel.com/docs/manage-cdn-usage). A browser load against local Vite and a demo Firestore emulator showed an initial marker after **6,001 ms** and a warm reload after **1,346 ms**, including app startup with external HTTPS tiles blocked. An active-tab hide removed the marker after **29,450 ms** in one local run. These are single local samples, not latency distributions or hosted results.

## Verification, limits and decision

- 14/14 focused Node tests passed; they cover allowlist/privacy, region boundaries and dateline, deterministic revision, content hash corruption, manifest changes, stale revision rejection, reader outage, duplicate/out-of-order tombstones, target guards, flag isolation, concurrency, incomplete file recovery, staging-only Vite artifact emission and no Firestore fallback. The standard Vite production build also passed.
- Firestore emulator integration passed for synthetic visible, reported and pending spots; an edit and deletion changed the published artifact as expected. Browser automation with installed `playwright-core` and Chrome passed initial load, pan, zoom, mobile resize, reload, edit, active-tab hide, corrupt manifest, missing-region error and offline scenarios. It observed zero production Firebase requests. No real CDN or hosted Firebase staging session was used.
- Not verified in a real browser: long-running memory growth, offline/reconnect recovery, rapid cross-region movement under network throttling, open detail closure after a remote hide, old Vercel deployment URL reachability, true CDN cache hit rate, the WIF workflow, and a staged Vercel deployment. The static publisher cannot deliver an enforceable urgent-takedown SLA or guarantee no concurrent Firestore change is missed during a scan. At scale it also needs smaller dense-region shards or more efficient artifacts and a reviewed reconciliation budget.

**GO for local/demo validation only. NO-GO for production.** Next: configure least-privilege staging WIF, approve a Preview-only deployment path, validate the emitted candidate and hosted cache behavior, implement a durable change journal or another trusted batching mechanism, and choose/test a minimal urgent revocation path. Then the original map can import the shared reader behind its own reviewed flag; it is intentionally unchanged now.
