# Public community spot snapshots: local proof of concept

## Scope and state

This prototype is **development-only**, opt-in with `VITE_PUBLIC_SPOT_SNAPSHOTS=true` during local Vite development. The default and every production build continue to query Firestore. No production Firebase data, CDN, or credentials were used. The exporter accepts only a complete local JSON array; it does not access Firebase.

The `/new` map reads a manifest and small regional JSON files. If files are missing, invalid, or a viewport spans more than 16 regions, it uses the existing Firestore viewport query. Search, Nearby, Discover, legacy map, collections, and direct deep links retain their Firestore paths. Opening a snapshot marker's full detail calls `getPublicSpotById`, which checks current public visibility; a removed spot cannot open from a stale marker. The existing four-entry, two-minute viewport cache remains intact.

## Format and local use

`scripts/public-spots/export.mjs` groups approved public spots into 2° latitude × 2° longitude cells. Each spot belongs to exactly one cell. The manifest lists content-addressed region files under `v1/<version>/`; the region contents and version are deterministic for the same input. An empty region needs no file. The reader clips results to the viewport and caps returned markers at 300.

The exported allowlist is: ID, coordinates, title, resolved title/category, primary category, locality, tags, spot type, rating/count, access difficulty, social indicator, creation date, public status, and an optional same-origin `/public-thumbnails/<opaque-id>.jpg|webp` path. The exporter excludes unpublished, review-needed, hidden, and sensitive-location spots; it rejects email addresses in exported text. It never copies descriptions, accounts, UIDs, moderation fields, original image URLs, or private drafts. The thumbnail path is emitted only when a trusted exporter input already has that dedicated public path. This repository does not yet generate such thumbnails, so real images are absent from the prototype snapshot path; category/icon markers and cards still render. A production publisher must verify thumbnail approval and public object access before setting this field.

For a local trial, create a **dummy** complete array of spot records, then run `node scripts/public-spots/export.mjs <dummy-input.json> public/spot-snapshots` and start Vite with `VITE_PUBLIC_SPOT_SNAPSHOTS=true`. Do not publish that generated directory as production data. The opt-in guard ignores the flag in production builds.

Vercel headers make `manifest.json` revalidate and content-addressed region files immutable. Static files in a Vercel deployment cannot be updated without a new deployment. This is a local prototype, not a compliant per-change production publisher.

The repository already uses PMTiles as a separately reviewed, content-addressed candidate artifact and has a Vercel Blob upload helper for those large, relatively static files. Community spots change more often, so the PMTiles build/publish cycle is not reused for them. Vercel Blob could be evaluated as a separately publishable host, but the prototype does not invoke its upload helper or use its credentials.

## Publication and moderation design required before rollout

Firebase remains authoritative. A future trusted publisher must read a **complete** authorized change stream or Admin SDK export, evaluate public status for every record, and atomically publish changed region files **before** switching the manifest. It must rebuild both old and new regions on moves, remove records on deletion/visibility changes, and never infer approval from client-supplied fields. A periodic reconciliation can check missed events, but must be bounded and infrequent; no public request may query Firestore as its CDN origin. Rating updates should be coalesced; likes need no snapshot rebuild. A region update writes one small immutable file and one manifest, rather than redeploying the app.

For urgent moderation, invalidate the current manifest at the CDN and all affected client viewport caches. Even then, already downloaded markers can remain for up to two minutes; full-detail clicks recheck Firestore. If immediate marker removal is mandatory, keep the Firestore map path or add a separately verified revocation channel before enabling CDN mode. The prototype intentionally cannot guarantee immediate removal and is therefore disabled in production.

## Illustrative monthly comparison, not observed billing

Assume 1,000 existing public spots; two distinct map views per session with 20 returned spots each; one full-detail click; four CDN requests and 30 KB of snapshot/manifest transfer per session; 95% CDN cache hit rate; daily full reconciliation (1,000 reads/day); and 100 changed spots/day handled incrementally (one Firestore read and one Function invocation per change). Thus export overhead is about 33,000 Firestore reads and 3,000 Function invocations per 30-day month, plus roughly 6,000 region/manifest writes if every change requires both objects. There are no extra Firestore writes in this design. These are design assumptions; none of this publisher is implemented.

| Sessions/month | Direct map reads | CDN map reads | Net reads avoided after one detail fetch/session | CDN requests | CDN transfer |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 40,000 | 0 | 39,000 | 4,000 | 0.03 GB |
| 10,000 | 400,000 | 0 | 390,000 | 40,000 | 0.30 GB |
| 100,000 | 4,000,000 | 0 | 3,900,000 | 400,000 | 3.00 GB |

The separate detail read occurs on the snapshot path; the direct map path already has the full document. At the listed **us-central1 Standard-edition** marginal read rate of $0.03/100,000, the avoided reads correspond to about $0.012, $0.117, and $1.17 respectively. The fixed 33,000 export reads are roughly $0.010 beyond free quota, regardless of session count. Firestore index-entry reads, egress, security-rule reads, and region-specific prices are excluded. The database edition has not been verified because production access is prohibited.

| Host | Illustrative marginal delivery cost at 1k / 10k / 100k sessions | Limitation |
| --- | --- | --- |
| Vercel deployed static files | ~$0.013 / $0.125 / $1.25 at $0.15/GB and $2/million requests, **if plan allowances are exhausted** | Updating static files needs deployment; unsuitable for per-spot freshness. Rates can vary by region and plan. |
| Cloudflare R2 Standard behind cached custom domain | ~$0.00007 / $0.00072 / $0.0072 in origin Class B requests at 5% misses, **if free allowance is exhausted**; egress free | Requires approved bucket/domain/publisher setup; Class A, storage, and optional cache services add costs. |
| Direct Firestore map | ~$0.012 / $0.12 / $1.20 for document reads at the stated rate, **if free quota is exhausted** | Egress and index-entry reads can add cost; no snapshot freshness risk. |

These are marginal components, not total bills. Vercel lists included transfer and request allocations; R2 lists 10 GB-month, one million Class A, and ten million Class B monthly free allowances. A 20-spot-per-view session is near the Vercel marginal break-even point; CDN delivery is not automatically cheaper. More returned spots or repeated views improve the snapshot case. Sources: [Firebase billing](https://firebase.google.com/docs/firestore/pricing), [Firestore prices](https://cloud.google.com/firestore/pricing), [Firebase prices](https://firebase.google.com/pricing), [Vercel regional prices](https://vercel.com/docs/pricing/regional-pricing), [R2 prices](https://developers.cloudflare.com/r2/pricing/).

## Production gate

Before rollout: approve a mutable object store or independently publishable CDN path; build an authenticated Admin SDK publisher with bounded reconciliation and atomic manifest switch; provision and validate public opaque thumbnails; test moderation purges, regional moves, direct-link visibility, missing files, and cache propagation; confirm database edition, real spot-size distribution, traffic mix, CDN quota, and App Check behavior. Then enable a production flag only after a shadow trial and retain the Firestore fallback and rollback switch. No such infrastructure is changed by this prototype.
