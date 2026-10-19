# Ambient POI identity recovery and candidate build

The published archive may contain only a numeric OSM `@id`. A number does not
identify an OSM node, way, or relation. The official editor leaves those
features read-only. The build now copies osmium's original `@type` and `@id`
into `source_id=node/123`, `canonical_id=osm:node:123`, `osm_type`, and
`osm_id`. It rejects an included feature without both original attributes.
The GeoJSON feature ID from `--add-unique-id=type_id` is never treated as an
original OSM identity.

## Inputs and prerequisites

Use the **same PBF snapshot used for the published PMTiles** if it is
available. That is the safest way to preserve the feature set and existing
legacy photo/rating references. If the original snapshot is unavailable, a
new Czech Republic PBF extract can be used, but review additions, removals,
and changed locations before any switch. Never assign identities to old
numeric features by matching name or coordinates.

Under Linux or WSL2, install `osmium-tool`, Node.js 18+, and Tippecanoe. For
example, on Ubuntu:

```bash
sudo apt update
sudo apt install -y osmium-tool build-essential libsqlite3-dev zlib1g-dev git curl
git clone https://github.com/felt/tippecanoe.git
cd tippecanoe && make -j && sudo make install
```

Clone/copy the repository into the WSL home directory, run `npm ci` at the
repository root, and place the PBF outside tracked files. If the original is
unavailable, obtain a dated Czech extract from
<https://download.geofabrik.de/europe/czech-republic.html> and record its
snapshot date and checksum.

## Build a local, unpublished candidate

From `scripts/ambient-tiles`:

```bash
./build.sh /absolute/path/to/original-czech.osm.pbf
node validate-candidate.mjs --raw=ambient-export.geojson --geojson=ambient-poi.geojson --pmtiles=ambient-poi.candidate.pmtiles
```

Inputs are the PBF and `export-config.json`. Outputs are
`ambient-filtered.osm.pbf`, `ambient-export.geojson`, `ambient-poi.geojson`,
and `ambient-poi.candidate.pmtiles`. Keep these for review. The validator
checks the raw-to-normalized feature count, categories, geometry, unique
typed identities, `ambient_poi` layer and PMTiles header. Its report lists
representative node, way and relation IDs **when those types exist in the
extract**. Review real samples in each type and compare counts and category
distribution with the previous build before approving a switch. Tippecanoe
can drop symbols at low zoom, so also inspect rendered samples across zooms
10–16, categories, styles, and map areas.

Generate corresponding static detail shards in a separate candidate folder:

```bash
cd ../..
POI_MATCH_WIKIDATA=0 POI_GEOJSON=scripts/ambient-tiles/ambient-poi.geojson POI_DETAILS_DIR=tmp/poi-details-candidate/10 npm run enrich:pois
```

This enrichment may contact Wikimedia/Wikidata for directly tagged IDs and
photo metadata. It does **not** use name-and-coordinate Wikidata matching
with `POI_MATCH_WIKIDATA=0`. Verify sampled detail item `id` and
`canonical_id` match the corresponding candidate tile. Do not publish mixed
old numeric detail shards and new typed tiles. Keep previous shards and the
previous PMTiles URL available for rollback.

For a separate streaming audit, export a GeoJSON sequence from the same
filtered PBF with `osmium export --geometry-types=point,polygon
--add-unique-id=type_id --config=export-config.json -f geojsonseq
-o ambient-export.geojsonseq ambient-filtered.osm.pbf`, then run
`node audit-identities.mjs --input=ambient-export.geojsonseq`. Any unresolved
or duplicate identity needs a source-data review, not a guess in the browser.

## Reviewed release only

The build never uploads or replaces the production archive. After review,
run `npm install` in `scripts/ambient-tiles` for the uploader's `@vercel/blob`
dependency, then
`BLOB_READ_WRITE_TOKEN=... node upload.js ambient-poi.candidate.pmtiles`
uploads an immutable candidate URL. Update `VITE_AMBIENT_TILES_URL` in Vercel
and deploy the matching candidate detail shards and frontend **only after
owner approval**. Verify the live map and editor, retaining the prior URL,
detail shards, and deployment for rollback. The official editor's draft
overrides do not publish to public PMTiles. Later publication work must
apply those overrides deliberately.
