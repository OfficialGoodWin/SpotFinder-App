'use strict';

const { parseCanonicalId } = require('./officialPoiFoundation');
const { assertAdmin, PoiEditError, COLLECTIONS } = require('./officialPoiService');
const { resolveLegacyIdentity } = require('./officialPoiIdentity');

function datesForClient(value) {
  if (Array.isArray(value)) return value.map(datesForClient);
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, datesForClient(item)]));
  return value;
}

async function readOfficialPoi({ db, actor, input }) {
  assertAdmin(actor);
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['action', 'id', 'legacyId', 'category'].includes(key)))
    throw new PoiEditError('invalid-argument', 'Invalid official POI read request');
  const { action, id } = input;
  if (!['list', 'get', 'history', 'resolve-legacy'].includes(action) ||
      (action === 'list' ? id != null || input.legacyId != null || input.category != null :
        action === 'resolve-legacy' ? id != null : !parseCanonicalId(id) || input.legacyId != null || input.category != null))
    throw new PoiEditError('invalid-argument', 'Invalid official POI read action or ID');
  if (action === 'resolve-legacy') return { identity: resolveLegacyIdentity(input.legacyId, input.category) };
  if (action === 'list') {
    const snapshot = await db.collection(COLLECTIONS.changes).orderBy('updatedAt', 'desc').limit(50).get();
    return { items: snapshot.docs.map(doc => datesForClient(doc.data())) };
  }
  if (action === 'get') {
    const snapshot = await db.collection(COLLECTIONS.changes).doc(id).get();
    return { item: snapshot.exists ? datesForClient(snapshot.data()) : null };
  }
  const snapshot = await db.collection(COLLECTIONS.revisions).where('id', '==', id).limit(100).get();
  return { items: snapshot.docs.map(doc => datesForClient(doc.data())).sort((a, b) => b.revision - a.revision) };
}

module.exports = { readOfficialPoi };
