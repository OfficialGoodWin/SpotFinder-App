// Minimal geohash encode + bounding-box helper.
// No external dependency — small enough to inline, avoids adding geofire-common.

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(lat, lng, precision = 9) {
  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let hash = '';
  let bit = 0;
  let ch = 0;
  let evenBit = true;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) { ch |= (1 << (4 - bit)); lngRange[0] = mid; } else { lngRange[1] = mid; }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) { ch |= (1 << (4 - bit)); latRange[0] = mid; } else { latRange[1] = mid; }
    }
    evenBit = !evenBit;
    if (bit < 4) { bit++; } else { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

// Returns [south, north, west, east] bounding box in degrees for a radius (m) around a point.
// Used to build a Firestore prefix-range query with a safety margin, then filtered client-side
// with haversineDistance for the exact radius.
export function boundingBox(lat, lng, radiusM) {
  const latDelta = radiusM / 111320; // ~meters per degree latitude
  const lngDelta = radiusM / (111320 * Math.cos((lat * Math.PI) / 180) || 1);
  return {
    south: lat - latDelta,
    north: lat + latDelta,
    west: lng - lngDelta,
    east: lng + lngDelta,
  };
}

// Geohash prefix long enough to reliably cover the given radius (used for the Firestore range query).
export function geohashPrecisionForRadius(radiusM) {
  if (radiusM <= 60) return 7;
  if (radiusM <= 600) return 6;
  if (radiusM <= 2400) return 5;
  return 4;
}

export function haversineDistanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
