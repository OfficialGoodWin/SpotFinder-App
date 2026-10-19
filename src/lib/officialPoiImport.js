// Read-only view of the currently rendered ambient tile and its optional z10
// detail shard. A typed osmium @id is the only safe imported identity here.
const TYPED_OSM = /^(node|way|relation)\/([1-9]\d*)$/;
const CANONICAL_OSM = /^osm:(node|way|relation):([1-9]\d*)$/;

export function readImportedPoi(hit) {
  const properties = hit?.properties || {};
  const details = hit?.details || null;
  const sourceId = String(properties.source_id ?? properties.id ?? '');
  const match = TYPED_OSM.exec(sourceId);
  const fromSource = match ? `osm:${match[1]}:${match[2]}` : null;
  const declared = typeof properties.canonical_id === 'string' && CANONICAL_OSM.test(properties.canonical_id) ? properties.canonical_id : null;
  const fromAttributes = ['node', 'way', 'relation'].includes(properties.osm_type) && /^[1-9]\d*$/.test(String(properties.osm_id ?? '')) ? `osm:${properties.osm_type}:${properties.osm_id}` : null;
  const canonicalId = (declared && fromSource && declared !== fromSource) || (declared && fromAttributes && declared !== fromAttributes) || (fromSource && fromAttributes && fromSource !== fromAttributes)
    ? null : declared || fromSource || fromAttributes;
  const detailTags = details?.tags && typeof details.tags === 'object' && !Array.isArray(details.tags) ? details.tags : {};
  const tags = { ...detailTags, ...properties };
  const localizedNames = Object.fromEntries(Object.entries(tags).filter(([key, value]) => /^name:[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(key) && typeof value === 'string').map(([key, value]) => [key.slice(5), value]));
  const localizedDescriptions = Object.fromEntries(Object.entries(tags).filter(([key, value]) => /^description:[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(key) && typeof value === 'string').map(([key, value]) => [key.slice(12), value]));
  return {
    canonicalId, sourceId, identityProvenance: canonicalId ? 'typed-source-attributes' : null, sourceLayer: hit?.sourceLayer || 'ambient_poi',
    position: hit?.position, name: String(tags.name || ''), category: String(tags.cat || ''),
    description: String(tags.description || details?.description || ''), website: String(tags.website || ''),
    phone: String(tags.phone || ''), openingHours: String(tags.opening_hours || ''),
    wikidata: /^Q[1-9]\d*$/.test(tags.wikidata || '') ? tags.wikidata : null,
    localizedNames, localizedDescriptions,
    raw: { tile: { ...properties }, detail: details ? { ...details } : null },
  };
}

export async function readImportedDetailShard(imported) {
  const { lat, lon } = imported?.position || {};
  if (!validEditorPosition(lat, lon) || !imported?.sourceId) return null;
  const n = 2 ** 10;
  const x = Math.floor((Number(lon) + 180) / 360 * n);
  const radians = Math.max(-85.05112878, Math.min(85.05112878, Number(lat))) * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * n);
  const root = import.meta.env?.VITE_POI_DETAILS_BASE_URL || '/poi-details/10';
  try {
    const response = await fetch(`${String(root).replace(/\/$/, '')}/${x}/${y}.json`, { signal: AbortSignal.timeout?.(5000) });
    if (!response.ok) return null;
    const body = await response.json();
    return (body.items || []).find(item => String(item.id) === imported.sourceId && (!item.canonical_id || item.canonical_id === imported.canonicalId)) || null;
  } catch { return null; }
}

export function validEditorPosition(lat, lon) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) && String(lat).trim() !== '' && String(lon).trim() !== ''
    && Number(lat) >= -90 && Number(lat) <= 90 && Number(lon) >= -180 && Number(lon) <= 180;
}
