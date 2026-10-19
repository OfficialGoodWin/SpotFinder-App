# Official POI foundation — Phase 1

This contract is separate from the current map. It does not publish data,
alter `ambient-poi.pmtiles`, or migrate community spots.

## Existing architecture and identity

- MapLibre reads source `ambient-poi-tiles`, layer `ambient_poi`, from the
  Czech `ambient-poi.pmtiles`, plus static `/poi-details/10` JSON tiles.
  `scripts/ambient-tiles/build.sh` exports osmium `@id`; `build.js` copies it
  into the `id` property. The renderer falls back to coordinates when absent.
  Neither tile feature IDs nor coordinate fallbacks are canonical identities.
- `poi_photos`, `poi_ratings`, reports and social references currently use
  coordinate/name derived `makePOIId`. Moving or renaming a POI changes that
  value. Preserve existing records and links. Before switching readers and
  writers, build a reviewed legacy-ID-to-canonical-ID alias index. Ambiguous
  matches require manual review; never attach a user's content by guesswork.
- `admin_pois` and `admin_closures` form a small direct-Firestore map editor;
  `getAdminPOIs` limits results to 500. The new official authoring collections
  do not replace its rendering in Phase 1. Community `/spots` are separate.
- The existing enrichment script and POI photo panel have name-based Wikidata
  paths. These cannot establish official identity and are not connected to
  the new records.
- The current POI detail panel also reads community photos/ratings from
  Firestore and may fetch a Wikidata image. Phase 1 preserves that behavior;
  the later static delivery migration must remove per-view external lookups
  from the official POI path without losing community data.

Canonical IDs are `osm:node:<decimal>`, `osm:way:<decimal>`,
`osm:relation:<decimal>`, or server-generated `sf:<UUIDv4>`. Region is a
separate field, so a border move cannot change identity. Bare numbers,
coordinates, titles, tile IDs and inferred OSM types are rejected. The
optional `audit-identities.mjs` reads a GeoJSON sequence from the original
OSM export and reports missing or duplicate typed IDs. It never rewrites
production tiles. If existing output lacks typed IDs, retain current behavior
until the original PBF/export is reprocessed and aliases are reviewed.
The current export configuration keeps `name` but not general `name:*` or
`description:*` tags. Later multilingual builds must capture those tags from
the original OSM dataset and keep provenance rather than inventing values.

## Authoring schema and security

`official_poi_changes/{canonicalId}` stores only a sparse `patch` for OSM
POIs, or a minimal `base` plus patch for a SpotFinder POI. It includes region,
revision, workflow (`draft`/`ready`), publication status, private note and
server timestamps. `visibility: hidden` is a reversible tombstone, not a
deletion. An edit defaults to draft and unpublished.

`official_poi_revisions/{canonicalId}__{revision}` stores immutable patch
snapshots for rollback. `official_poi_audit` stores actor UID, action, field
names and revision without private content. `official_poi_publications` is
reserved for staged and active version metadata. Rules allow claimed admins
to read these collections and no client writes.

`adminSaveOfficialPoi` independently checks the signed Firebase `admin`
claim, rejects caller-supplied identity and authorization fields, validates
the patch, compares `expectedRevision` in a Firestore transaction and writes
the current record, revision and audit atomically. Timestamps are generated
server-side. Rollback creates a new revision. No edit publishes data. No
visitor reads these collections. The legacy editor remains for compatibility.

Supported category IDs match the current ambient tile categories. Photos are
metadata references to Storage objects under `official-poi-photos/`; binaries
never enter Firestore. A later photo approval service must check MIME type,
size, ownership, rights and attribution. The public projection includes only
approved locale values and photo references; it excludes private notes,
actor UIDs and drafts. It is a publisher input, not a live Firestore response.

## Localization and Wikidata

Name precedence: approved human override for the language, OSM
`name:<language>`, verified directly linked Wikidata label, original/local
name. Description precedence: approved human translation, approved cached
machine translation of the current source revision, OSM language-specific
description, original description. Region tags also check their base language.
Missing text stays missing. Wikidata descriptions belong in short summaries,
not full descriptions. Business and landmark names are never machine
translated automatically.

Imported records accept a Wikidata Q-ID only from explicit OSM `wikidata`.
Name similarity is insufficient. Future manual links for custom POIs need
recorded evidence and review. Future Wikidata jobs should batch verified
Q-IDs, identify SpotFinder in headers, cache results, honor `Retry-After`,
checkpoint and resume, and consider dumps at scale. No visitor should call
Wikidata per POI view in the target system.

Translation generation can reuse the opt-in Azure developer tooling. Future
batches must select approved public source descriptions only, skip suitable
existing translations, hash source content, enforce character/cost budgets,
preserve variants and stage suggestions for review. There are no translation
API requests in Phase 1 or visitor views. Names, private drafts, personal
data and legal text are excluded.

## Static publication contract for later phases

The active manifest names immutable assets under
`poi-publications/<version>/`: updated regional PMTiles, bounded geographic
deltas and requested-language static content shards. Assets include checksum
and byte count. A future publisher will snapshot ready revisions, validate
schemas/identity/rights, build and upload versioned assets, verify staged
checksums and samples, atomically switch the small active manifest, and retain
the previous version for rollback. The manifest must never point to missing
files. Never overwrite the active PMTiles in place.

A move must suppress old geometry and add new geometry. A tombstone must
suppress the same canonical ID in rendering, click selection, search, Nearby
and deep links. An extra overlay leaves the old base symbol visible. A
bounded recent delta can provide prompt online changes, but changes must be
folded into rebuilt regional tiles and indexes at scale. Deltas need indexes
at both old and new positions. Visitors fetch viewport regions and the
requested language only. Asset URLs are versioned and cacheable; the active
manifest revalidates. PWA and long-lived tabs must switch versions atomically.
Offline or stale clients cannot be guaranteed immediate deletions, which
needs an explicit product and operational policy.

There is no publisher, asset upload, CDN invalidation or active manifest
switch in Phase 1. The manifest validator defines a contract only.

## Migration, costs and licensing gates

Before adopting the new renderer: audit typed `@id` coverage in existing
tiles; recover missing identities from the original OSM PBF when possible;
review legacy aliases; migrate approved `admin_pois` without deleting it; and
test hidden/moved POIs across map, search, Nearby, detail and deep links.
Keep source PBF/version and OSM attribution with each output. No production
user record or tile changes in this phase.

The authoring database scales with changed POIs rather than all 262,850
imported records. Edits/history cost admin-only Firestore operations. Visitors
consume static assets instead of 50,000 live overrides. Deltas must remain
bounded and be compacted. External enrichment jobs need explicit budgets.

OSM-derived output needs attribution and an ODbL/derivative database review
before publication. Wikidata structured data, Wikipedia prose and Wikimedia
Commons photographs have different reuse considerations. Check each photo's
license, credit, source and permission. Do not import proprietary POI data
from commercial map services. This document is not approved legal advice.

## Phase 2 entry points

Build an admin UI for the callable and revision conflicts; add a verified
import-base reader; review legacy aliases; build photo and language review
interfaces; test representative OSM node, way, relation and custom edits.
Public rendering and publishing remain later phases.
