// Read-only view of the currently rendered ambient tile and its optional z10
// detail shard. A typed osmium @id is the only safe imported identity here.
const TYPED_OSM = /^(node|way|relation)\/([1-9]\d*)$/;

export function readImportedPoi(hit) {
  const properties = hit?.properties || {};
  const details = hit?.details || null;
  const sourceId = String(properties.id ?? '');
  const match = TYPED_OSM.exec(sourceId);
  const canonicalId = match ? `osm:${match[1]}:${match[2]}` : null;
  const detailTags = details?.tags && typeof details.tags === 'object' && !Array.isArray(details.tags) ? details.tags : {};
  const tags = { ...detailTags, ...properties };
  const localizedNames = Object.fromEntries(Object.entries(tags).filter(([key, value]) => /^name:[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(key) && typeof value === 'string').map(([key, value]) => [key.slice(5), value]));
  const localizedDescriptions = Object.fromEntries(Object.entries(tags).filter(([key, value]) => /^description:[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(key) && typeof value === 'string').map(([key, value]) => [key.slice(12), value]));
  return {
    canonicalId, sourceId, sourceLayer: hit?.sourceLayer || 'ambient_poi',
    position: hit?.position, name: String(tags.name || ''), category: String(tags.cat || ''),
    description: String(tags.description || ''), website: String(tags.website || ''),
    phone: String(tags.phone || ''), openingHours: String(tags.opening_hours || ''),
    wikidata: /^Q[1-9]\d*$/.test(tags.wikidata || '') ? tags.wikidata : null,
    localizedNames, localizedDescriptions,
    raw: { tile: { ...properties }, detail: details ? { ...details } : null },
  };
}

export function validEditorPosition(lat, lon) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) && String(lat).trim() !== '' && String(lon).trim() !== ''
    && Number(lat) >= -90 && Number(lat) <= 90 && Number(lon) >= -180 && Number(lon) <= 180;
}
