# Ještěd specialist route sample

This is separate from SpotFinder ambient POI tiles. `fixture.json` is synthetic and validates the extractor only; it is not evidence of actual Ještěd routes.

OpenStreetMap data is ODbL 1.0. A one-off bounded Overpass export can inspect south 50.70, west 14.95, north 50.77, east 15.04. Select `type=route` relations tagged `route=hiking|foot|bicycle|mtb|piste`, their way members in the box, and ways tagged `piste:type` or `aerialway`. Request JSON `out geom` for relations and ways. Save the response as `sample.json`. Do not query Overpass during map movement. A later regional build can use a dated Geofabrik Czech PBF after approval and resource planning. BBBike offers custom extracts, but its public terms direct commercial use to a professional plan.

```overpass
[out:json][timeout:25];
relation["type"="route"]["route"~"^(hiking|foot|bicycle|mtb|piste)$"](50.70,14.95,50.77,15.04)->.routes;
way(r.routes)(50.70,14.95,50.77,15.04)->.routeWays;
(.routes;.routeWays;way["piste:type"](50.70,14.95,50.77,15.04);way["aerialway"](50.70,14.95,50.77,15.04););
out geom(50.70,14.95,50.77,15.04);
```

Run `node scripts/specialist-routes/extract-sample.mjs sample.json output-dir`. The extractor emits four GeoJSON collections: `hiking`, `cycling`, `pistes`, and `lifts`. It emits one feature per relation and way membership, retaining overlapping routes, member roles, IDs, actual way geometry, selected map tags, original relation and way tags as JSON strings, and attribution. Missing geometry is reported. Missing piste difficulty remains unknown. Test-box clipping may omit segments; production extraction needs complete way members from a buffered PBF.

Once real sample GeoJSON exists, the existing Tippecanoe tool can build a separate PMTiles candidate using four `-L name:file` inputs, `-Z10 -z15`, OSM attribution, `--no-feature-limit`, and `--no-tile-size-limit`. Decode a tile and compare geometry, IDs, overlap count, `osmc:symbol`, `ref`, `network`, `piste:type`, `piste:difficulty`, `piste:grooming`, and `aerialway` against the GeoJSON. Confirm colon-containing keys and nulls survive encoding; otherwise map to tile-safe names and retain original tags in an ODbL sidecar. Do not connect MapLibre until this gate passes.

```sh
tippecanoe -o routes.candidate.pmtiles -Z10 -z15 --no-feature-limit --no-tile-size-limit -A '© OpenStreetMap contributors' -L hiking:output-dir/hiking.geojson -L cycling:output-dir/cycling.geojson -L pistes:output-dir/pistes.geojson -L lifts:output-dir/lifts.geojson
```

The synthetic fixture is kilobytes and runs quickly. A real local archive may be low megabytes, but that is unverified because the bounded Overpass request timed out here. A full Czech PBF is roughly 900 MB and geometry assembly can require several GB of scratch space and substantial RAM. PMTiles hosting requires HTTP range requests, versioned caching, OSM attribution and measurement of storage and egress cost.

**Status:** no real Ještěd data, PMTiles archive, upload, or MapLibre route layer was produced.
