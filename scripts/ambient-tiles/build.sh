#!/usr/bin/env bash
# Full ambient-POI tile pipeline: Overpass -> GeoJSON -> PMTiles.
#
# Usage:
#   cd scripts/ambient-tiles
#   npm install
#   ./build.sh "48.5,12.0,51.1,18.9"     # south,west,north,east
#
# Requires: node 18+, tippecanoe (https://github.com/felt/tippecanoe).
#   macOS:  brew install tippecanoe
#   Ubuntu: apt-get install -y build-essential libsqlite3-dev zlib1g-dev
#           git clone https://github.com/felt/tippecanoe && cd tippecanoe && make -j && sudo make install
set -euo pipefail

BBOX="${1:?Usage: ./build.sh south,west,north,east}"
GEOJSON="ambient-poi.geojson"
OUT="ambient-poi.pmtiles"

if ! command -v tippecanoe >/dev/null; then
  echo "tippecanoe not found on PATH — see the header of this script for install instructions." >&2
  exit 1
fi

node build.js --bbox="$BBOX" --out="$GEOJSON"

# -l ambient_poi   must match AMBIENT_SOURCE_LAYER in MapLibreMap.jsx
# -Z10 -z16        matches the zoom range the ambient layer is actually shown at
# --drop-densest-as-needed  keeps dense city centers from producing oversized tiles
tippecanoe \
  -o "$OUT" \
  -l ambient_poi \
  -Z10 -z16 \
  --drop-densest-as-needed \
  --force \
  "$GEOJSON"

echo "Built $OUT — upload this file to your chosen host and point VITE_AMBIENT_TILES_URL at its public URL."
