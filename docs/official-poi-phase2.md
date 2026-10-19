# Official POI editor: Phase 2 operator notes

The integrated home-map admin panel now has an **Official POIs** tab. It writes
only `official_poi_changes`, `official_poi_revisions`, and `official_poi_audit`
through `adminSaveOfficialPoi`. Draft and ready records remain unpublished.
The original PMTiles, static detail shards, public indexes, community spots,
and legacy `admin_pois` are unchanged.

## Identity review

The editor accepts imported `node/<id>`, `way/<id>`, and `relation/<id>` values
from `ambient_poi`. A bare number, vector-tile feature ID, name, or coordinate
cannot establish identity. Such markers show their raw tile/detail attributes
but saving is disabled. Run `node scripts/ambient-tiles/audit-identities.mjs --input=original-osm.geojsonseq`
against the original osmium GeoJSON sequence to list missing and duplicate
typed IDs. Review the original PBF/export for each unresolved record before
building a typed-ID tile update in a later phase. Never assign a type based
on the current tile ID or proximity alone.

The first edit captures an immutable, bounded copy of available source fields
with provenance in `base.sourceFields`. Subsequent edits patch only supported
fields. The source copy is an admin-submitted snapshot of the rendered tile
and optional detail shard, not an independently authenticated PBF extract.
Phase 3 should verify it against an indexed source export before publication.

## Legacy mapping

The legacy editor remains accessible in the admin panel. A nearby legacy POI
warning is only a distance-based review cue; it is not an identity alias.
No alias index or migration has been created. Review candidate matches
against typed OSM source IDs and create an explicit audited alias map in a
later phase. Keep `admin_pois` rendering until that review is complete.

## Media boundary

The Media section can stage ordered photo metadata, including Storage path,
creator, credit, source URL, license, and permission reference. The first
item is the proposed cover. Metadata is always draft. There is no official
photo upload, read/preview, or rights approval service yet; Storage rules do
not grant client access to `official-poi-photos/`. A record with draft media
cannot be marked ready. Do not add an image to a publication before the
secure upload and rights review service is implemented.

## Manual verification

1. Use an account with a signed Firebase `admin` custom claim; open the map's
   admin editor and choose **Official POIs**.
2. Select a typed OSM marker. Inspect source ID and raw fields; rename,
   recategorize, move, save as draft, refresh, and inspect revision history.
3. Select an untyped marker and verify saving is disabled.
4. Add a custom POI, pick a map position, save, and verify an `sf:<UUIDv4>` ID.
5. Open two admin sessions on the same record. Save from the first, then try
   the second; review the conflict and load the latest revision.
6. Hide, restore, and roll back. Confirm each action creates a new revision.
7. Try invalid coordinates and a draft photo; verify invalid coordinates are
   rejected and the photo prevents ready status.
8. Sign in without the admin claim and verify the editor is absent and the
   callable and Firestore writes are denied.
9. Verify the public map and PMTiles are unchanged after all saves. Inspect
   desktop and iPhone safe-area/keyboard behavior in a real browser.

The Firebase rules emulator requires Java 21 or newer with the installed
Firebase Tools version. The current workstation has Java 8, so emulator
security tests could not be executed here. The callable and rule files have
not been deployed.
