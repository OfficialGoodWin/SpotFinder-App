'use strict';

const { randomUUID, createHash } = require('node:crypto');

const CATEGORIES = new Set(['train', 'fuel', 'charging', 'hotel', 'museum', 'heritage', 'hospital', 'restaurant', 'cafe', 'bar', 'pharmacy', 'bank', 'supermarket', 'atm', 'bakery', 'parking', 'viewpoint', 'camp_site', 'caravan_site', 'toilets', 'drinking_water', 'picnic_site']);
const PATCH_FIELDS = new Set(['position', 'category', 'nameOverrides', 'descriptions', 'shortSummaries', 'attributes', 'website', 'phone', 'openingHours', 'accessibility', 'photoRefs', 'visibility']);
const ATTRIBUTE_FIELDS = new Set(['address', 'email', 'wheelchair', 'internet_access', 'toilets:wheelchair', 'operator', 'brand', 'access']);
const PROVENANCE = new Set(['original_osm', 'osm_language_tag', 'wikidata', 'human', 'machine']);
const LANGUAGE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const QID = /^Q[1-9]\d*$/;
const assert = (condition, message) => { if (!condition) throw new TypeError(message); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const keysOnly = (value, allowed, label) => { assert(plain(value), `${label} must be an object`); for (const key of Object.keys(value)) assert(allowed.has(key), `${label}.${key} is not allowed`); };
const string = (value, max, label, allowEmpty = false) => { assert(typeof value === 'string' && value.length <= max && (allowEmpty || value.trim()), `${label} must be text of at most ${max} characters`); return value.trim(); };
const sourceRevision = value => value ? `sha256:${createHash('sha256').update(value).digest('hex')}` : null;

function parseCanonicalId(value) {
  if (typeof value !== 'string') return null;
  const osm = /^osm:(node|way|relation):([1-9]\d*)$/.exec(value);
  if (osm) return { id: value, sourceKind: 'osm', osm: { type: osm[1], id: osm[2] } };
  if (/^sf:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) return { id: value, sourceKind: 'spotfinder' };
  return null;
}

function canonicalOsmId(type, id) {
  assert(['node', 'way', 'relation'].includes(type), 'OSM type is required');
  const number = String(id);
  assert(/^[1-9]\d*$/.test(number), 'OSM ID must be a positive decimal integer');
  return `osm:${type}:${number}`;
}

// The current osmium export writes @id like "node/123". A bare number or
// tippecanoe feature ID is deliberately rejected: neither proves OSM type.
function canonicalFromOsmium(value) {
  if (typeof value !== 'string') return null;
  const match = /^(node|way|relation)\/([1-9]\d*)$/.exec(value);
  return match ? canonicalOsmId(match[1], match[2]) : null;
}

function newSpotFinderId() { return `sf:${randomUUID()}`; }
function validPosition(value) {
  keysOnly(value, new Set(['lat', 'lon']), 'position');
  assert(Number.isFinite(value.lat) && value.lat >= -90 && value.lat <= 90, 'Invalid latitude');
  assert(Number.isFinite(value.lon) && value.lon >= -180 && value.lon <= 180, 'Invalid longitude');
  return { lat: value.lat, lon: value.lon };
}
function validCategory(value) { assert(CATEGORIES.has(value), 'Unsupported POI category'); return value; }
function validWikidata(value) {
  if (value == null) return null;
  keysOnly(value, new Set(['id', 'linkMethod', 'labels', 'summaries']), 'wikidata');
  assert(QID.test(value.id) && value.linkMethod === 'osm_tag', 'Only an explicit OSM Wikidata link is accepted');
  const localized = (entries, max, label) => {
    keysOnly(entries || {}, new Set(Object.keys(entries || {}).filter(key => LANGUAGE.test(key))), label);
    return Object.fromEntries(Object.entries(entries || {}).map(([key, item]) => [key, string(item, max, `${label}.${key}`)]));
  };
  return { id: value.id, linkMethod: value.linkMethod,
    labels: localized(value.labels, 250, 'wikidata.labels'), summaries: localized(value.summaries, 500, 'wikidata.summaries') };
}
function validLocalized(value, kind) {
  assert(Array.isArray(value) && value.length <= 100, `${kind} must be an array`);
  const seen = new Set();
  return value.map((entry, index) => {
    keysOnly(entry, new Set(['language', 'text', 'source', 'approval', 'sourceRevision']), `${kind}[${index}]`);
    assert(LANGUAGE.test(entry.language), 'Invalid language tag');
    string(entry.text, kind === 'descriptions' ? 4000 : 250, `${kind} text`);
    assert(PROVENANCE.has(entry.source), 'Invalid provenance');
    assert(['draft', 'approved'].includes(entry.approval), 'Invalid approval state');
    if (kind === 'nameOverrides') assert(entry.source === 'human', 'Proper-name overrides require human approval');
    else assert(['human', 'machine'].includes(entry.source), 'Source data and Wikidata must come from verified import records');
    if (entry.source === 'machine') assert(/^sha256:[a-f0-9]{64}$/.test(entry.sourceRevision), 'Machine translation requires a source-content SHA-256');
    const unique = `${entry.language}:${entry.source}`;
    assert(!seen.has(unique), 'Duplicate language/provenance entry'); seen.add(unique);
    return { language: entry.language, text: entry.text.trim(), source: entry.source, approval: entry.approval,
      ...(entry.sourceRevision ? { sourceRevision: entry.sourceRevision } : {}) };
  });
}
function validPhotoRefs(value) {
  assert(Array.isArray(value) && value.length <= 20, 'photoRefs must be an array');
  return value.map((photo, index) => {
    keysOnly(photo, new Set(['storagePath', 'license', 'credit', 'creator', 'rightsReference', 'sourceUrl', 'approval']), `photoRefs[${index}]`);
    const storagePath = string(photo.storagePath, 500, 'storagePath');
    assert(/^official-poi-photos\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/.test(storagePath), 'Invalid official photo path');
    assert(photo.approval === 'draft' || photo.approval === 'approved', 'Invalid photo approval');
    assert(photo.approval === 'draft', 'Photo approval requires the secure rights review service');
    return { storagePath, license: string(photo.license, 120, 'license'), credit: string(photo.credit, 250, 'credit'),
      creator: photo.creator == null ? null : string(photo.creator, 250, 'creator'),
      rightsReference: photo.rightsReference == null ? null : string(photo.rightsReference, 500, 'rightsReference'),
      sourceUrl: photo.sourceUrl == null ? null : validWebsite(photo.sourceUrl), approval: photo.approval };
  });
}
function validWebsite(value) {
  if (value === null) return null;
  const url = new URL(string(value, 1000, 'URL'));
  assert(['https:', 'http:'].includes(url.protocol) && url.hostname.includes('.') && !url.username && !url.password, 'Invalid public URL');
  return url.href;
}
function validatePatch(patch) {
  keysOnly(patch, PATCH_FIELDS, 'patch');
  assert(Buffer.byteLength(JSON.stringify(patch), 'utf8') <= 64 * 1024, 'Patch exceeds 64 KiB');
  assert(Object.keys(patch).length > 0, 'Patch is empty');
  const result = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'position') result.position = validPosition(value);
    else if (key === 'category') result.category = validCategory(value);
    else if (['nameOverrides', 'descriptions', 'shortSummaries'].includes(key)) result[key] = validLocalized(value, key);
    else if (key === 'attributes' || key === 'accessibility') {
      keysOnly(value, key === 'attributes' ? ATTRIBUTE_FIELDS : new Set(['wheelchair', 'stepFree', 'accessibleToilet']), key);
      result[key] = Object.fromEntries(Object.entries(value).map(([name, text]) => [name, string(text, 300, name)]));
    } else if (key === 'website') result.website = validWebsite(value);
    else if (key === 'phone') result.phone = value === null ? null : string(value, 80, 'phone');
    else if (key === 'openingHours') result.openingHours = value === null ? null : string(value, 500, 'openingHours');
    else if (key === 'photoRefs') result.photoRefs = validPhotoRefs(value);
    else if (key === 'visibility') { assert(['visible', 'hidden'].includes(value), 'Invalid visibility'); result.visibility = value; }
  }
  return result;
}
function validateCustomBase(base) {
  keysOnly(base, new Set(['position', 'category', 'originalName', 'originalDescription', 'region', 'wikidata']), 'base');
  assert(base.wikidata == null, 'Custom POIs need separate manual Wikidata verification');
  const originalDescription = base.originalDescription == null ? null : string(base.originalDescription, 4000, 'originalDescription');
  return { position: validPosition(base.position), category: validCategory(base.category),
    originalName: string(base.originalName, 250, 'originalName'),
    originalDescription, descriptionRevision: sourceRevision(originalDescription),
    region: validRegion(base.region), wikidata: null };
}
function validRegion(value) {
  assert(typeof value === 'string' && /^[A-Z]{2}(?:-[A-Z0-9]{1,8})?$/.test(value), 'Invalid region');
  return value;
}
function validSourceFields(value) {
  assert(Buffer.byteLength(JSON.stringify(value), 'utf8') <= 32 * 1024, 'Imported source snapshot exceeds 32 KiB');
  const copy = (part, depth) => {
    assert(depth <= 5, 'Imported source snapshot is too deep');
    if (part === null || typeof part === 'boolean') return part;
    if (typeof part === 'number') { assert(Number.isFinite(part), 'Invalid source number'); return part; }
    if (typeof part === 'string') return string(part, 4000, 'source value', true);
    if (Array.isArray(part)) { assert(part.length <= 100, 'Too many source items'); return part.map(item => copy(item, depth + 1)); }
    assert(plain(part), 'Invalid source object');
    assert(Object.keys(part).length <= 200, 'Too many source fields');
    const result = {};
    for (const [key, item] of Object.entries(part)) {
      assert(/^[A-Za-z0-9_:@.\/-]{1,80}$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key), 'Invalid source field name');
      result[key] = copy(item, depth + 1);
    }
    return result;
  };
  return copy(value, 0);
}
function validateImportedBase(base) {
  keysOnly(base, new Set(['id', 'position', 'category', 'originalName', 'originalDescription', 'osmNames', 'osmDescriptions', 'wikidata', 'region', 'website', 'phone', 'openingHours', 'attributes', 'accessibility', 'sourceFields']), 'base');
  const identity = parseCanonicalId(base.id);
  assert(identity?.sourceKind === 'osm', 'Imported POI needs a typed OSM identity');
  const localized = (value, label) => {
    keysOnly(value || {}, new Set(Object.keys(value || {}).filter(key => LANGUAGE.test(key))), label);
    return Object.fromEntries(Object.entries(value || {}).map(([key, entry]) => [key, string(entry, 4000, `${label}.${key}`)]));
  };
  const originalDescription = base.originalDescription == null ? null : string(base.originalDescription, 4000, 'originalDescription');
  return { id: identity.id, sourceKind: 'osm', osm: identity.osm, position: validPosition(base.position),
    category: validCategory(base.category), originalName: string(base.originalName, 250, 'originalName', true),
    originalDescription, descriptionRevision: sourceRevision(originalDescription),
    osmNames: localized(base.osmNames, 'osmNames'), osmDescriptions: localized(base.osmDescriptions, 'osmDescriptions'),
    wikidata: validWikidata(base.wikidata), region: validRegion(base.region),
    website: base.website == null ? null : validWebsite(base.website), phone: base.phone == null ? null : string(base.phone, 80, 'phone'),
    openingHours: base.openingHours == null ? null : string(base.openingHours, 500, 'openingHours'),
    sourceFields: base.sourceFields == null ? null : validSourceFields(base.sourceFields),
    attributes: base.attributes == null ? {} : validatePatch({ attributes: base.attributes }).attributes,
    accessibility: base.accessibility == null ? {} : validatePatch({ accessibility: base.accessibility }).accessibility };
}
function localeCandidates(language) { return [...new Set([language, String(language || '').split('-')[0]].filter(Boolean))]; }
function approved(items, language, sources) {
  for (const lang of localeCandidates(language)) for (const source of sources) {
    const hit = items?.find(item => item.language === lang && item.source === source && item.approval === 'approved');
    if (hit?.text) return hit.text;
  }
  return null;
}
function resolvePoiName(base, patch, language) {
  return approved(patch?.nameOverrides, language, ['human'])
    || localeCandidates(language).map(lang => base?.osmNames?.[lang]).find(Boolean)
    || (base?.wikidata?.linkMethod === 'osm_tag' ? localeCandidates(language).map(lang => base.wikidata.labels?.[lang]).find(Boolean) : null)
    || base?.originalName || null;
}
function resolvePoiDescription(base, patch, language) {
  const eligible = patch?.descriptions?.filter(item => item.source !== 'machine' || (base?.descriptionRevision && item.sourceRevision === base.descriptionRevision));
  return approved(eligible, language, ['human', 'machine'])
    || localeCandidates(language).map(lang => base?.osmDescriptions?.[lang]).find(Boolean)
    || base?.originalDescription || null;
}
function toPublicPoiRecord(base, change) {
  const patch = change?.patch || {};
  const overridden = (key, original) => Object.prototype.hasOwnProperty.call(patch, key) ? patch[key] : original;
  return { id: base.id, sourceKind: base.sourceKind, osm: base.osm || null, region: base.region,
    position: patch.position || base.position, category: patch.category || base.category,
    originalName: base.originalName, originalDescription: base.originalDescription || null,
    descriptionRevision: base.descriptionRevision || sourceRevision(base.originalDescription),
    osmNames: base.osmNames || {}, osmDescriptions: base.osmDescriptions || {},
    wikidata: base.wikidata || null, website: overridden('website', base.website ?? null),
    phone: overridden('phone', base.phone ?? null), openingHours: overridden('openingHours', base.openingHours ?? null),
    attributes: patch.attributes || base.attributes || {}, accessibility: patch.accessibility || base.accessibility || {},
    localizedNames: (patch.nameOverrides || []).filter(item => item.approval === 'approved'),
    localizedDescriptions: (patch.descriptions || []).filter(item => item.approval === 'approved'),
    shortSummaries: (patch.shortSummaries || []).filter(item => item.approval === 'approved'),
    photoRefs: (patch.photoRefs || []).filter(item => item.approval === 'approved'),
    visibility: patch.visibility || 'visible', revision: change?.revision || 0 };
}
function validatePublicationManifest(manifest) {
  keysOnly(manifest, new Set(['schemaVersion', 'version', 'createdAt', 'regions', 'assets', 'previousVersion']), 'manifest');
  assert(manifest.schemaVersion === 1 && /^[a-z0-9][a-z0-9-]{5,80}$/.test(manifest.version), 'Invalid publication version');
  assert(Array.isArray(manifest.regions) && manifest.regions.length > 0, 'Missing regions');
  assert(Array.isArray(manifest.assets) && manifest.assets.length > 0, 'Missing assets');
  for (const asset of manifest.assets) {
    keysOnly(asset, new Set(['path', 'sha256', 'bytes', 'kind', 'region', 'language']), 'asset');
    assert(typeof asset.path === 'string' && asset.path.startsWith(`poi-publications/${manifest.version}/`) && !asset.path.includes('..'), 'Asset must be versioned');
    assert(/^[a-f0-9]{64}$/.test(asset.sha256) && Number.isSafeInteger(asset.bytes) && asset.bytes >= 0, 'Invalid asset checksum or size');
    assert(['pmtiles', 'delta', 'localized-content'].includes(asset.kind), 'Invalid asset kind');
  }
  return manifest;
}

module.exports = { CATEGORIES, PATCH_FIELDS, parseCanonicalId, canonicalOsmId, canonicalFromOsmium, newSpotFinderId,
  validPosition, validCategory, validWikidata, validatePatch, validateCustomBase, validateImportedBase, sourceRevision,
  resolvePoiName, resolvePoiDescription, toPublicPoiRecord, validatePublicationManifest };
