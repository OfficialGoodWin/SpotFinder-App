const MAPY_API_KEY = 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';

/**
 * Find a Mapy.cz place ID by searching near known coordinates.
 * Returns the best match or null.
 */
export async function findMapyPlace(name, lat, lon) {
  try {
    const near = `&preferNear=${lon},${lat}&preferNearPrecision=500`;
    const url = `https://api.mapy.com/v1/suggest?apikey=${MAPY_API_KEY}&query=${encodeURIComponent(name)}&lang=en&limit=5${near}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const items = data.items || [];
    if (!items.length) return null;

    // Pick the closest result to our known coordinates
    let best = null;
    let bestDist = Infinity;
    for (const item of items) {
      const pos = item.position;
      if (!pos) continue;
      const dist = Math.hypot(pos.lat - lat, pos.lon - lon);
      if (dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    }
    // Only accept if within ~300m (0.003 degrees ≈ 300m)
    return bestDist < 0.003 ? best : null;
  } catch {
    return null;
  }
}

/**
 * Fetch full place details from Mapy.cz using source:id from suggest.
 * Returns { photos, openingHours, contact, rating, description } or null.
 */
export async function getMapyPlaceDetail(source, id) {
  try {
    const placeId = `${source}:${id}`;
    const url = `https://api.mapy.com/v1/place/${encodeURIComponent(placeId)}?apikey=${MAPY_API_KEY}&lang=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * One-shot: find + fetch full details for a POI by name + coords.
 * Returns merged detail object or null.
 */
export async function fetchPOIDetails(name, lat, lon) {
  const item = await findMapyPlace(name, lat, lon);
  if (!item) return null;
  const detail = await getMapyPlaceDetail(item.source, item.id);
  return detail ? { ...item, ...detail } : item;
}
