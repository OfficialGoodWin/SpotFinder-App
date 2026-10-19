# Official POI multilingual enrichment — Phase 3

This phase adds an admin-side cache and review path. It does not publish or deploy POIs.

## Source data and precedence

`functions/officialPoiFoundation.js` resolves names in this order: approved human override for the requested BCP 47 tag (then its parent tags), OSM `name:<tag>`, a label attached to the POI's explicit Q-ID, original local name. Descriptions use approved human text, localized OSM description, approved cached machine text for the current original-description SHA-256, then original description. Wikidata descriptions are short summaries only. Rejected suggestions are ignored while their text hash matches; a changed source value can be reviewed again. No missing text is fabricated.

Only languages in `src/locales/translations.js` are accepted by the batch. Region variants include their base language in the lookup, such as `en-GB` and `en`. Business names are never machine translated.

## Verified batch input

Use a **small reviewed JSON array** of official POI source records. Each item needs a canonical `id`, `wikidata: { "id": "Q42", "linkMethod": "osm_tag" }`, and `tags.wikidata: "Q42"` (or the equivalent `base.sourceFields.tile.wikidata` / `base.sourceFields.detail.tags.wikidata`). The script skips absent, invalid, mismatched, name-matched, and untyped links. It does not search Wikidata for entities. Example:

```json
[{"id":"osm:node:1","tags":{"wikidata":"Q42"},"wikidata":{"id":"Q42","linkMethod":"osm_tag"}}]
```

Run with an explicit budget and persistent files:

```powershell
npm.cmd run enrich:official-wikidata -- --input=fixtures/verified-links.json --cache=.cache/official-wikidata.json --checkpoint=.cache/official-wikidata-checkpoint.json --languages=cs,en,de --budget=10 --batch=20 --dry-run
```

Remove `--dry-run` only for a reviewed bounded batch, and provide `--user-agent=SpotFinder/1.0_(contact@example.org)` with a real operator contact. Dry run makes zero requests and writes nothing. The cache stores one compact Q-ID record with language-keyed labels and summaries, unreviewed source status, Wikidata revision, retrieval time, and explicit `null` for absent values. That record's Q-ID, source status, revision, and time apply to each language value, avoiding repeated entity metadata. Cache hits, including absent values, skip refetching. Files are written atomically after each batch; an interrupted run resumes from the cache. The checkpoint records completed Q-IDs for diagnostics. Set a new cache path or remove selected entries to intentionally refresh stale source data. There is no automatic bulk refresh or per-view API call.

The request is a GET to the [Wikibase `wbgetentities` Action API](https://www.mediawiki.org/wiki/Wikibase/API) with `ids`, `props=labels|descriptions`, selected languages, `languagefallback=0`, `maxlag=5`, and JSON output. The service batches at most 50 Q-IDs, uses a ten-second timeout, retries transient failures with exponential backoff, honors `Retry-After`, and counts retries against the request budget. A nonzero budget never implies a request when all values are cached. See the [Wikimedia User-Agent policy](https://foundation.wikimedia.org/wiki/Policy%3AWikimedia_Foundation_User-Agent_Policy).

## Admin review

The existing official editor's Languages section shows OSM source text and can load the bounded local cache file. It looks up cache values only by the POI's explicit Q-ID. A loaded file remains local to the admin browser until the admin chooses a value. Approve/prefer copies one value into an admin override, with language, source reference, source text hash, retrieval time, and approved status. Reject records a reviewed source hash. Restore original writes an explicit human override with the original local value for that language; Clear summary removes an optional short summary. These actions call the existing `adminSaveOfficialPoi` service and create unpublished draft revisions. Manual corrections use the Basic fields. Original imported fields remain read only. A POI must first be saved in the official editor to have a server record before review buttons are available.

The server validates that a reviewed Wikidata Q-ID matches the stored explicit OSM link. The initial imported base must contain that Q-ID in its source snapshot. Admin-authored records cannot attach a Wikidata item in this phase. The editor's local cache file is review input, so operators must obtain it from a trusted batch run; it is not a public data source.

## Phase 6 static contract

The later publisher can join verified POI Q-IDs with the entity cache, apply approved patch overrides and current source revisions, and emit language-specific immutable content shards, for example `poi-publications/<version>/localized/cs/<z>/<x>/<y>.json`. A public row should contain only canonical POI ID, chosen label, optional full description, optional short Wikidata summary, and compact source and revision references needed for attribution. The manifest already supports `localized-content` assets with language, hash and byte count. Exclude private notes, actor IDs, rejected text, draft values, and account records. The public client should fetch only the requested locale shard and fall back to original names locally. This phase does not implement that publisher or change PMTiles.

OSM attribution and ODbL review remain required for derived source data. Wikidata structured descriptions are separate from Wikipedia prose and Wikimedia Commons photographs. This workflow imports no article text or images and grants no image rights.

## Limits

### Public UI integration

The map detail panel now resolves already available language values from the clicked ambient tile and its optional static detail shard. The ambient POI symbol layers choose `name:<language>` with parent-locale and original-name fallback and update their text expression when LanguageContext changes. OpenFreeMap basemap labels are separate. The resolver makes no Wikidata or translation request from a visitor session. It accepts approved localized values and verified Q-ID labels only when those values are already present in public static data.

The current checkout has no Wikidata batch cache or generated detail shards, and the existing deployed PMTiles may lack `name:*` and `description:*`. Thus this wiring alone does not make untranslated production POIs multilingual. Approved official editor changes remain unpublished drafts. Phase 6 must join reviewed source data and cache values into public, versioned localized assets, then the public reader must load those assets by locale and canonical POI ID. Private notes, reviews, and account data must stay out of them.

The current tile and detail exports do not generally include `name:*` and `description:*`. This phase displays tags when present, but a later reviewed OSM source export is needed for broad multilingual coverage. The local cache upload is limited to 5 MB. It is an admin review aid, not a shared server cache or an automatic cache distribution mechanism. The historical `enrich-pois.js` is a separate legacy detail/photo pipeline; do not use its name-matching output as verified official POI evidence.

The ordinary POI detail sheet no longer calls Wikidata or Wikipedia APIs for photos or performs name-based entity searches. Its explicitly OSM-tagged Commons file path still checks Commons license metadata before display. Existing static detail shard photos are outside this enrichment batch and require separate rights review before official publication.
