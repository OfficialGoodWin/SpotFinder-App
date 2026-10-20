// Public POI text resolution. All inputs must already be in the tile or a
// published static detail shard; this module never fetches translations.
const QID = /^Q[1-9]\d*$/;
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;

export function poiLocaleCandidates(locale) {
  const parts = String(locale || '').replaceAll('_', '-').split('-').filter(Boolean);
  return parts.map((_, index) => parts.slice(0, parts.length - index).join('-'));
}

function localizedValue(values, locale) {
  for (const candidate of poiLocaleCandidates(locale)) {
    const value = text(values?.[candidate]) || text(values?.[candidate.toLowerCase()]);
    if (value) return value;
  }
  return null;
}

function approvedValue(items, locale, sources, revision = null) {
  for (const candidate of poiLocaleCandidates(locale)) {
    for (const source of sources) {
      const item = items?.find(entry => entry.language === candidate && entry.source === source && entry.approval === 'approved'
        && (source !== 'machine' || Boolean(revision && entry.sourceRevision === revision)));
      if (text(item?.text)) return text(item.text);
    }
  }
  return null;
}

export function localizedOsmTags(tags, prefix) {
  const result = {};
  for (const [key, value] of Object.entries(tags || {})) {
    if (key.startsWith(`${prefix}:`) && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(key.slice(prefix.length + 1)) && text(value))
      result[key.slice(prefix.length + 1)] = value;
  }
  return result;
}

export function ambientPoiNameExpression(locale) {
  const names = poiLocaleCandidates(locale).map(candidate => ['get', `name:${candidate}`]);
  return ['step', ['zoom'], '', 14, ['coalesce', ...names, ['get', 'name'], '']];
}

export function resolveVisiblePoiText(poi, locale) {
  const tile = poi?._ambientHit?.properties || {};
  const detail = poi?.enrichment || poi?._ambientHit?.details || {};
  const tags = { ...(detail.tags || {}), ...tile, ...(poi?.tags || {}) };
  const originalName = text(poi?.name) || text(tile.name) || '';
  const originalDescription = text(detail.description) || text(detail.originalDescription) || text(tags.description) || text(tags.note);
  const osmNames = { ...(detail.osmNames || {}), ...localizedOsmTags(detail.tags, 'name'), ...localizedOsmTags(tile, 'name'), ...localizedOsmTags(poi?.tags, 'name') };
  const osmDescriptions = { ...(detail.osmDescriptions || {}), ...localizedOsmTags(detail.tags, 'description'), ...localizedOsmTags(tile, 'description'), ...localizedOsmTags(poi?.tags, 'description') };
  const explicitQid = text(tile.wikidata) || text(poi?.tags?.wikidata);
  const wikidata = detail.wikidata;
  const verified = QID.test(explicitQid || '') && wikidata && typeof wikidata === 'object'
    && wikidata.id === explicitQid && wikidata.linkMethod === 'osm_tag';
  const name = approvedValue(detail.localizedNames, locale, ['human'])
    || localizedValue(osmNames, locale)
    || (verified ? localizedValue(wikidata.labels, locale) : null)
    || originalName;
  const description = approvedValue(detail.localizedDescriptions, locale, ['human'])
    || localizedValue(osmDescriptions, locale)
    || approvedValue(detail.localizedDescriptions, locale, ['machine'], detail.descriptionRevision)
    || originalDescription;
  const shortSummary = approvedValue(detail.shortSummaries, locale, ['human'])
    || (verified ? localizedValue(wikidata.summaries, locale) : null);
  return { name, description, shortSummary, originalName, originalDescription };
}
