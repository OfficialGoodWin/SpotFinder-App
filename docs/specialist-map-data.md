# Specialist map data gap

The current `/new` styles use OpenFreeMap's OpenMapTiles `transportation`, `transportation_name`, `mountain_peak`, `poi`, and landcover layers. The optional SpotFinder PMTiles archive is a point-of-interest source (`ambient-poi-tiles`), not a route source. Neither configured source provides verified piste difficulty, grooming, ski-lift line geometry, Czech hiking route relation geometry and `osmc:symbol`, or numbered bicycle route relation geometry. Ordinary `path` and `cycleway` ways must not be presented as marked routes.

The Winter and Outdoor styles currently show terrain hillshade, peaks and elevation labels from available sources. They do not claim ski or signed-route coverage or current piste status.

## Smallest reproducible route source

1. Obtain a regional OSM extract from a provider that permits this use, initially the Czech Republic. Record the extract date and ODbL attribution. Avoid bulk requests to public tile endpoints and avoid runtime Overpass queries.
2. Extract only `type=route` relations with `route=hiking|foot|bicycle|mtb|piste`, tagged piste ways (`piste:type`, `piste:difficulty`, `piste:grooming`), and `aerialway` ways. Resolve relation members against the extract so every displayed line follows its actual OSM way geometry. Preserve overlapping relation IDs and refs.
3. Emit separate vector layers for hiking routes, cycle routes, pistes, and lifts. Keep original `osmc:symbol`, `colour`, `ref`, `network`, `piste:type`, `piste:difficulty`, `piste:grooming`, `aerialway`, and `name` values. Leave missing difficulty explicitly unknown.
4. Tile a small test region first; inspect decoded tile properties and geometry before adding any MapLibre layers or legend. Publish versioned PMTiles with OSM attribution and a documented update schedule. Then add the source only to Outdoor/Winter and restore it in the existing `style.load` path.

No regional extract, bulk build, new hosting, or paid service was started. Download size, build time, and storage/egress cost depend on the chosen extract, tiling zooms, and host and must be estimated before a full build.
