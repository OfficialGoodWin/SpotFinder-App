// Osmium's @type and @id are original OSM object attributes. The GeoJSON
// feature.id from --add-unique-id=type_id is a geometry ID and is never used.
export function identityFromOsmiumAttributes(tags) {
  const type = tags?.['@type'];
  const rawId = tags?.['@id'];
  if (!['node', 'way', 'relation'].includes(type)) return null;
  if (typeof rawId === 'number' && !Number.isSafeInteger(rawId)) return null;
  const id = String(rawId ?? '');
  if (!/^[1-9]\d*$/.test(id)) return null;
  return { canonicalId: `osm:${type}:${id}`, sourceId: `${type}/${id}`, type, id };
}
