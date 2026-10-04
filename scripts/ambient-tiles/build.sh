#!/usr/bin/env bash
# Build Czech ambient POI PMTiles locally from a Geofabrik PBF.
#
# Usage:
#   ./build.sh [path/to/czech-republic-latest.osm.pbf]
#
# Requires: osmium, node 18+, tippecanoe.
# The Czech PBF is ~900 MB, but osmium export can use substantial RAM for
# geometry assembly. Use WSL2/Linux and keep the repo under the Linux home
# directory for better I/O than /mnt/c.
set -euo pipefail

PBF="${1:-czech-republic-latest.osm.pbf}"
FILTERED="ambient-filtered.osm.pbf"
GEOJSON_RAW="ambient-export.geojson"
GEOJSON="ambient-poi.geojson"
OUT="ambient-poi.pmtiles"

command -v osmium >/dev/null || { echo "osmium not found" >&2; exit 1; }
command -v tippecanoe >/dev/null || { echo "tippecanoe not found" >&2; exit 1; }
command -v node >/dev/null || { echo "node not found" >&2; exit 1; }
[ -f "$PBF" ] || { echo "PBF not found: $PBF" >&2; exit 1; }

cat > .ambient-filter.txt <<'EOF'
nwr/railway=station
nwr/amenity=fuel,charging_station,hospital,restaurant,cafe,bar,pharmacy,bank,atm,parking,toilets,drinking_water
nwr/tourism=hotel,museum,viewpoint,camp_site,caravan_site,picnic_site
nwr/shop=supermarket,bakery
nwr/historic
EOF

echo "[1/4] Filtering OSM objects..."
osmium tags-filter --expressions=.ambient-filter.txt --overwrite -o "$FILTERED" "$PBF"

echo "[2/4] Exporting POI geometries (points + polygons)..."
osmium export --geometry-types=point,polygon --add-unique-id=type_id --overwrite \
  --config=export-config.json -o "$GEOJSON_RAW" "$FILTERED"

echo "[3/4] Normalizing category properties..."
node build.js --in="$GEOJSON_RAW" --out="$GEOJSON"

echo "[4/4] Building PMTiles..."
tippecanoe \
  -o "$OUT" \
  -l ambient_poi \
  -n "SpotFinder ambient POIs" \
  -A "© OpenStreetMap contributors" \
  -Z10 -z16 \
  --convert-polygons-to-label-points \
  --drop-densest-as-needed \
  --force \
  "$GEOJSON"

echo "Built $OUT."

if [ -n "${BLOB_READ_WRITE_TOKEN:-}" ]; then
  node upload.js "$OUT"
else
  echo "BLOB_READ_WRITE_TOKEN not set — PMTiles upload skipped."
  echo "Set it from your Vercel Blob store, then run: node upload.js $OUT"
fi

if [ "${KEEP_BUILD_FILES:-0}" != "1" ]; then
  rm -f "$FILTERED" "$GEOJSON_RAW" .ambient-filter.txt
fi
