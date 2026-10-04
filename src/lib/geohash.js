const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(latitude, longitude, precision = 9) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  let even = true, bits = 0, bitCount = 0, hash = '';
  while (hash.length < precision) {
    const value = even ? longitude : latitude;
    const min = even ? lonMin : latMin;
    const max = even ? lonMax : latMax;
    const mid = (min + max) / 2;
    if (value >= mid) { bits = (bits << 1) | 1; if (even) lonMin = mid; else latMin = mid; }
    else { bits <<= 1; if (even) lonMax = mid; else latMax = mid; }
    even = !even;
    bitCount++;
    if (bitCount === 5) { hash += BASE32[bits]; bits = 0; bitCount = 0; }
  }
  return hash;
}
