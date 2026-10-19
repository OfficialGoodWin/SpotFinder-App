'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { gunzipSync } = require('node:zlib');
const { PoiEditError } = require('./officialPoiService');

let cachedIndex;
function loadIdentityIndex() {
  if (cachedIndex) return cachedIndex;
  try {
    const value = JSON.parse(gunzipSync(readFileSync(join(__dirname, 'officialPoiIdentity', 'index.json.gz'))));
    if (value.metadata?.formatVersion !== 1 || !value.mappings || Object.keys(value.mappings).length !== value.metadata.featureCount)
      throw new Error('Invalid index metadata');
    cachedIndex = value;
    return value;
  } catch {
    throw new PoiEditError('failed-precondition', 'Verified imported POI identity index is unavailable');
  }
}

function resolveLegacyIdentity(legacyId, category, index = loadIdentityIndex()) {
  if (typeof legacyId !== 'string' || !/^[1-9]\d{0,15}$/.test(legacyId) || typeof category !== 'string')
    throw new PoiEditError('invalid-argument', 'Invalid legacy POI lookup');
  const match = index.mappings[legacyId];
  if (!match || match.category !== category || !/^osm:(node|way|relation):[1-9]\d*$/.test(match.canonicalId) ||
      !match.canonicalId.endsWith(`:${legacyId}`))
    throw new PoiEditError('failed-precondition', 'Legacy POI identity is unverified or source category differs');
  return { canonicalId: match.canonicalId, sourceId: match.canonicalId.replace(/^osm:/, '').replace(/:/, '/'),
    provenance: 'verified-original-pbf-index', legacyArchiveSha256: index.metadata.legacyArchiveSha256 };
}

module.exports = { loadIdentityIndex, resolveLegacyIdentity };
