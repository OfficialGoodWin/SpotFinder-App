'use strict';

const {
  parseCanonicalId, newSpotFinderId, validatePatch, validateCustomBase, validateImportedBase, sourceRevision, PATCH_FIELDS,
} = require('./officialPoiFoundation');

const COLLECTIONS = Object.freeze({
  changes: 'official_poi_changes',
  revisions: 'official_poi_revisions',
  audit: 'official_poi_audit',
  publications: 'official_poi_publications',
});

class PoiEditError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function assertAdmin(actor) {
  if (!actor?.uid || actor.admin !== true) throw new PoiEditError('permission-denied', 'Admin claim required');
}

// The function accepts only an authenticated actor supplied by the callable
// context. Never copy caller-supplied UID, claim, timestamps, or approval data.
async function saveOfficialPoi({ db, serverTimestamp, actor, input, createId = newSpotFinderId }) {
  assertAdmin(actor);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PoiEditError('invalid-argument', 'Missing edit input');
  const allowed = new Set(['id', 'base', 'importedBase', 'patch', 'expectedRevision', 'workflow', 'privateNote', 'rollbackRevision', 'resetToBase', 'removeFields', 'region']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new PoiEditError('invalid-argument', `Unsupported edit field: ${key}`);
  const creating = input.id == null;
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) throw new PoiEditError('invalid-argument', 'expectedRevision is required');
  if (creating && input.expectedRevision !== 0) throw new PoiEditError('invalid-argument', 'New POI must start at revision zero');
  const id = creating ? createId() : input.id;
  const identity = parseCanonicalId(id);
  if (!identity || (creating && identity.sourceKind !== 'spotfinder')) throw new PoiEditError('invalid-argument', 'Invalid canonical POI ID');
  if (creating !== Boolean(input.base)) throw new PoiEditError('invalid-argument', 'Base is required only for a new SpotFinder POI');
  const base = creating ? validateCustomBase(input.base) : null;
  const importedBase = input.importedBase == null ? null : validateImportedBase(input.importedBase);
  if (importedBase && importedBase.id !== id) throw new PoiEditError('invalid-argument', 'Imported identity mismatch');
  const legacyTileId = importedBase?.sourceFields?.tile?.id;
  if (legacyTileId != null && /^[1-9]\d*$/.test(String(legacyTileId))) {
    // A bare tile ID can enter the authoring system only through the
    // independently verified original-PBF index bundled with this function.
    const { resolveLegacyIdentity } = require('./officialPoiIdentity');
    const resolved = resolveLegacyIdentity(String(legacyTileId), importedBase.category);
    if (resolved.canonicalId !== id) throw new PoiEditError('invalid-argument', 'Legacy tile identity does not match the original PBF');
  }
  const patch = input.patch == null ? null : validatePatch(input.patch);
  if ([Boolean(patch), input.rollbackRevision != null, input.resetToBase === true, input.removeFields != null].filter(Boolean).length !== 1)
    throw new PoiEditError('invalid-argument', 'Choose exactly one patch, rollback, reset or field removal');
  if (input.resetToBase != null && input.resetToBase !== true) throw new PoiEditError('invalid-argument', 'Invalid resetToBase');
  if (input.removeFields != null && (!Array.isArray(input.removeFields) || input.removeFields.length < 1 || input.removeFields.length > PATCH_FIELDS.size || new Set(input.removeFields).size !== input.removeFields.length || input.removeFields.some(field => !PATCH_FIELDS.has(field))))
    throw new PoiEditError('invalid-argument', 'Invalid fields to remove');
  if (creating && (input.resetToBase === true || input.rollbackRevision != null || input.removeFields != null)) throw new PoiEditError('invalid-argument', 'New POI requires a patch');
  if (input.workflow != null && !['draft', 'ready'].includes(input.workflow)) throw new PoiEditError('invalid-argument', 'Invalid workflow');
  if (input.privateNote != null && (typeof input.privateNote !== 'string' || input.privateNote.length > 2000)) throw new PoiEditError('invalid-argument', 'Invalid private note');
  if (input.region != null && (typeof input.region !== 'string' || !/^[A-Z]{2}(?:-[A-Z0-9]{1,8})?$/.test(input.region))) throw new PoiEditError('invalid-argument', 'Invalid region');
  if (input.rollbackRevision != null && (!Number.isSafeInteger(input.rollbackRevision) || input.rollbackRevision < 1)) throw new PoiEditError('invalid-argument', 'Invalid rollback revision');

  const ref = db.collection(COLLECTIONS.changes).doc(id);
  return db.runTransaction(async tx => {
    const current = await tx.get(ref);
    const previous = current.exists ? current.data() : null;
    if (creating && previous) throw new PoiEditError('already-exists', 'POI ID collision');
    if (!creating && !previous && identity.sourceKind === 'spotfinder') throw new PoiEditError('not-found', 'Custom POI does not exist');
    if (!creating && !previous && identity.sourceKind === 'osm' && !importedBase) throw new PoiEditError('invalid-argument', 'Verified imported base snapshot is required');
    if (previous && importedBase) throw new PoiEditError('invalid-argument', 'Imported base is immutable');
    const linkedBase = previous?.base || importedBase || base;
    for (const entry of [...(patch?.nameOverrides || []), ...(patch?.descriptions || []), ...(patch?.shortSummaries || []), ...(patch?.enrichmentReviews || [])]) {
      const reference = entry.sourceReference;
      if (!reference) continue;
      if (reference.startsWith('wikidata:') && (linkedBase?.wikidata?.id !== reference.slice(9) || linkedBase.wikidata.linkMethod !== 'osm_tag'))
        throw new PoiEditError('invalid-argument', 'Enrichment Q-ID must match the explicit OSM link');
      if (reference.startsWith('osm:') && identity.sourceKind !== 'osm')
        throw new PoiEditError('invalid-argument', 'OSM source is required for this review');
      if (reference.startsWith('osm:')) {
        const [, kind, language] = /^osm:(name|description):(.+)$/.exec(reference) || [];
        const sourceText = kind === 'name' ? linkedBase?.osmNames?.[language] : linkedBase?.osmDescriptions?.[language];
        if (!sourceText || entry.sourceRevision !== sourceRevision(sourceText) || (entry.text && entry.text !== sourceText))
          throw new PoiEditError('invalid-argument', 'OSM suggestion must match the stored source revision');
      }
    }
    const revision = previous?.revision || 0;
    if (revision !== input.expectedRevision) throw new PoiEditError('aborted', 'POI changed since it was opened; reload before editing');
    let nextPatch = { ...(previous?.patch || {}) };
    if (input.removeFields) { for (const field of input.removeFields) delete nextPatch[field]; }
    else if (input.resetToBase === true) nextPatch = identity.sourceKind === 'spotfinder' ? { visibility: 'visible' } : {};
    else if (input.rollbackRevision != null) {
      const oldRef = db.collection(COLLECTIONS.revisions).doc(`${id}__${input.rollbackRevision}`);
      const old = await tx.get(oldRef);
      if (!old.exists || old.data().id !== id) throw new PoiEditError('not-found', 'Revision not found');
      nextPatch = old.data().patch;
    } else nextPatch = { ...nextPatch, ...patch };
    if (creating && !('visibility' in nextPatch)) nextPatch.visibility = 'visible';
    const changedFields = input.rollbackRevision != null || input.resetToBase === true || input.removeFields != null
      ? [...new Set([...Object.keys(previous?.patch || {}), ...Object.keys(nextPatch)])].filter(key => JSON.stringify(previous?.patch?.[key]) !== JSON.stringify(nextPatch[key]))
      : Object.keys(patch);
    const previousValues = Object.fromEntries(changedFields.map(key => [key, previous?.patch?.[key] ?? null]));
    const newValues = Object.fromEntries(changedFields.map(key => [key, nextPatch[key] ?? null]));
    const nextRevision = revision + 1;
    if (input.workflow === 'ready' && nextPatch.photoRefs?.some(photo => photo.approval !== 'approved'))
      throw new PoiEditError('failed-precondition', 'Unverified photo rights prevent ready status');
    const now = serverTimestamp();
    const next = {
      id, sourceKind: identity.sourceKind,
      ...(identity.osm ? { osm: identity.osm } : {}),
      ...(base || importedBase ? { base: base || importedBase } : previous?.base ? { base: previous.base } : {}),
      baseCapturedAt: previous?.baseCapturedAt || (base || importedBase ? now : null),
      region: input.region || base?.region || previous?.region || null,
      patch: nextPatch, revision: nextRevision,
      workflow: input.workflow || 'draft',
      publicationStatus: 'unpublished',
      ...(input.privateNote != null ? { privateNote: input.privateNote } : previous?.privateNote ? { privateNote: previous.privateNote } : {}),
      createdAt: previous?.createdAt || now, updatedAt: now, updatedByUid: actor.uid,
    };
    const revisionRef = db.collection(COLLECTIONS.revisions).doc(`${id}__${nextRevision}`);
    const auditRef = db.collection(COLLECTIONS.audit).doc();
    tx.set(ref, next);
    tx.create(revisionRef, { id, revision: nextRevision, patch: nextPatch, workflow: next.workflow,
      previousRevision: revision, createdAt: now, actorUid: actor.uid,
      changedFields, previousValues, newValues, publicationStatus: 'unpublished',
      action: input.removeFields ? 'remove-fields' : input.resetToBase === true ? 'reset' : input.rollbackRevision != null ? 'rollback' : creating ? 'create' : 'edit' });
    tx.create(auditRef, { id, revision: nextRevision, previousRevision: revision, actorUid: actor.uid,
      action: input.removeFields ? 'remove-fields' : input.resetToBase === true ? 'reset' : input.rollbackRevision != null ? 'rollback' : creating ? 'create' : 'edit',
      changedFields, createdAt: now });
    return { id, revision: nextRevision, workflow: next.workflow, visibility: nextPatch.visibility || 'visible' };
  });
}

module.exports = { COLLECTIONS, PoiEditError, assertAdmin, saveOfficialPoi };
