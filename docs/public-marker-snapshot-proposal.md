# Proposal: compact public markers or CDN snapshots

**Design only.** This does not implement or deploy a marker collection, export job, CDN bucket, or fallback route. It preserves Firebase Auth, Firestore, Storage, App Check and the existing UI.

## Option A: compact public marker documents

Maintain a separate server-written `public_spot_markers/{spotId}` collection containing only `id`, coarse/approved public coordinates, category, title, thumbnail URL, publication timestamp and a schema version. No owner email/UID, report counts, moderation notes, draft content, private photo URLs, or arbitrary spot fields. A trusted publisher creates/updates a marker only after checking the current spot is public and in a visible status. On edit it replaces the marker atomically or with a recoverable retry. On hide/delete/moderation it removes the marker; a reconciliation job compares markers to source spots and repairs missed events. The UI would query bounded marker documents for the map and fetch the full spot on detail open, rechecking publication. This changes Firestore bytes but can still bill document reads at a similar count. Rules must enforce public-only read and server-only write; do not weaken existing `spots` rules. The marker publisher must be idempotent and use trusted server identity.

## Option B: versioned public snapshots on a CDN

An approved trusted export reads only visible public spots, applies an explicit field allowlist, validates coordinates/URLs, partitions into small geographic regions, writes immutable versioned files, then atomically updates a manifest. New and edited spots appear after a successful export/manifest switch; hidden or deleted spots disappear after a new version is published. Keep the old manifest until the new version is complete, use a bounded refresh interval, and define a maximum publication/removal delay. For urgent moderation, a short-lived denylist/tombstone path and cache purge or a detail recheck prevents stale cached listings from opening hidden content. Avoid exposing raw Firestore JSON or Admin SDK responses through the CDN.

Use a **bounded failure policy**: if a manifest or region is missing, show a recoverable map error or use a small, rate-limited, geographically bounded Firestore fallback with a hard per-session/request budget. Never silently fall back to a 500-document full query on every failed snapshot request. Keep the detail read's live publication check. Cache `404`/failure briefly with backoff to avoid repeated fallback storms. Instrument snapshot hit/miss, region bytes, fallback count and reason, Firestore reads, moderation removal lag, and map time-to-first-marker. Compare against an equal-traffic baseline over a full representative cycle, including old clients and cold caches.

## Approval gates

Choose one architecture after measuring actual production spot-size percentiles and map query telemetry. Prove field allowlist, draft/private exclusion, image URL safety, revision ordering, deletion/takedown latency, dateline behavior, and rollback in a demo/staging project. Review deployment/billing requirements separately. Do not activate CDN billing or change production rules during design.
