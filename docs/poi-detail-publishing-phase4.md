# Incremental public POI detail publisher (Phase 4)

This publisher extends the deployed `/poi-details/10/{x}/{y}.json` schema. The map still loads one z10 shard for a clicked PMTiles feature and matches its **numeric** `id`. The shard keeps typed `canonical_id`, OSM name tags, reviewed overrides, and provenance. It does not change the PMTiles archive or search index. Files in `public/` are copied into Vite `dist/` and become live only after the normal Vercel deployment.

## Reviewed input

Use `tests/fixtures/poi-publisher-sample.json` as a concrete five-record example. Each record has:

| Field | Purpose |
|---|---|
| `canonicalId` | Typed `osm:node/way/relation` identity in `osm:type:id` form. |
| `lookupId`, `category` | Exact numeric ID and category observed in the current PMTiles archive. |
| `position` | Longitude and latitude of that marker. Determines the z10 shard. |
| `tileFeature` | Reviewed live feature ID, category, position, name, explicit Q-ID (if any), and archive SHA-256. |
| `source` | Original name, optional original description, language-specific OSM text, explicit Q-ID and public contact fields. |
| `review` | Operator's evidence of how the live feature and source snapshot were checked. Kept in the local input only. |
| `verifiedWikidata` | Optional reviewed Q-ID labels and short summaries, with `linkMethod: osm_tag`, `approval: approved`, and `sourceRevision` equal to the SHA-256 of canonical JSON `{labels,summaries}`. |

The publisher validates numeric ID and category against `functions/officialPoiIdentity/index.json.gz`, which was made by comparing the original PBF, old numeric GeoJSON and typed candidate. It checks that the supplied archive checksum matches the index, that coordinates and original name agree with the reviewed feature, and that the feature falls in the calculated z10 shard. A numeric ID alone is never treated as a typed OSM identity. The publisher cannot independently prove a user-typed `tileFeature` came from a current archive: review the live feature and archive checksum before accepting an input file. A changed archive needs a newly verified index and input review. Ambiguous mappings or existing rows with a different canonical ID fail the entire run before any write.

Language keys must be supported SpotFinder languages. Names are resolved by the existing `poiLocalization.js`: approved human override, OSM language tag, explicit-Q-ID Wikidata label, then original name. Descriptions use approved human text, OSM localized description, approved machine text with the current original-description revision, then original description. Wikidata descriptions are short summaries. The publisher never translates branded names or invents text. The original name and description remain in the row. The optional bounded Wikidata cache is **not** automatically published: its entries are unreviewed. Reviewed values may be copied into `verifiedWikidata` with a matching source revision. No Wikidata cache was present in this checkout during the sample run.

## Admin edits

For official admin changes, put exact canonical IDs in a small JSON array and pass it with `--admin-ids=PATH --service-account=PATH`. The CLI uses the Firebase Admin SDK and a service account for project `spotfinderapp-cdc7b` to read **only those IDs** from `official_poi_changes` and their exact current `official_poi_revisions` snapshots. It accepts only imported OSM records with matching identity/base/revision, server-written `workflow: ready`, and `publicationStatus: unpublished`. It never reads all official records. The service-account file stays outside the repo and is never copied into public output. A caller's input file cannot set workflow, approval or publication status.

The public projection keeps approved localized names, approved human descriptions, current-revision approved machine descriptions, short summaries, contact fields, supported attributes and accessibility. The current detail panel renders names, descriptions, summaries, website, phone, opening hours and email. Other attributes and accessibility remain stored in the shard until a public UI supports them; the dry-run marks that distinction. Draft translations, private notes, admin UIDs, audit records and credentials are omitted. The current official service has no photo-rights approval path for `photoRefs`; these remain blocked. `ready` means eligible for review, **not live**. The editor says this explicitly.

If a ready patch also changes position, category, visibility or photo references, the dry-run reports those fields as blocked. A hidden POI is skipped entirely, since the current marker would remain visible. Metadata in an otherwise ready record may enter the shard, but the report never calls the blocked surfaces applied.

## Workflow

Run from the repository root. PowerShell examples:

```powershell
node scripts/enrichment/publish-poi-details.mjs --input=tests/fixtures/poi-publisher-sample.json
node scripts/enrichment/publish-poi-details.mjs --input=tests/fixtures/poi-publisher-sample.json --write
$env:VITE_AMBIENT_TILES_URL='https://reelwwsgqv2qknlw.public.blob.vercel-storage.com/spotfinder/ambient-poi.pmtiles'
npm.cmd run build
node --test tests/poi-publisher.test.js tests/one-poi-preview-browser.test.js tests/poi-publisher-preview-browser.test.js
```

For an authenticated admin revision, add `--admin-ids=private/approved-ids.json --service-account=C:\secure\spotfinder-service-account.json` to both publisher commands. Dry-run is the default and makes no writes. `--write` atomically replaces only changed shards after every affected shard has passed validation. Each run accepts at most 20 records by default; `--max-records=N --batch-limit=N` can set lower or higher limits up to 100. Split larger reviewed sets into small batches. The local `public/poi-details/publisher-manifest.json` records SHA-256, byte count and publication version for changed shards. A rerun with identical input leaves files untouched.

Review the CLI report and diff of every changed shard, then build once. The owner deploys through the existing Vercel workflow after approval. Verify each production JSON URL returns 200 and `application/json`; click actual markers and check names in the live detail sheet. A local generated file is not deployed merely because the CLI succeeded.

The sample adds five real, index-verified OSM station features to the same shard as Hlavní nádraží. The existing Hlavní nádraží row and its Czech, English and German names remain unchanged. The report lists one changed file, five changed records, source and published names, provenance, fields and surfaces. No network calls are made for a source-only dry-run or write. An admin run makes exactly two Firestore document reads per listed ID; it never queries a collection.

## Growth and remaining surfaces

The initial output retains z10 partitioning and a 2 MiB per-shard review threshold. Monitor shard byte size, average entries, and client download time as the catalog approaches 50,000 records. Review finer partitioning before any shard becomes large; the current reader would need a coordinated versioned change. Do not make visitors download all records or one file per language.

This phase publishes detail-panel metadata only. It does not move or suppress the PMTiles marker, change its symbol/category, add a new official marker, update the public search index, or publish photos. Those require the planned public overlay/tombstone/geometry, rights-review/photo delivery, and search integration. Community photo and rating reads remain separate from static translations.
