import { collection, doc, documentId, getDoc, getDocs, limit, query, startAfter, where } from 'firebase/firestore';

export const RELATED_SPOT_BATCH_SIZE = 10;
const RELATION_PAGE_SIZE = 100;
const FALLBACK_CONCURRENCY = 3;

// The caller's maxCount bounds relation documents, as it did before this
// change. Infinity is used only by the explicit "show all on map" action.
export async function loadRelatedSpots(db, collectionName, uid, maxCount, mapSnapshot) {
  if (!uid || maxCount <= 0) return [];
  const relationDocs = [];
  let cursor = null;
  do {
    const pageSize = maxCount === Infinity ? RELATION_PAGE_SIZE
      : Math.min(RELATION_PAGE_SIZE, maxCount - relationDocs.length);
    const page = await getDocs(query(collection(db, collectionName), where('user_id', '==', uid),
      ...(cursor ? [startAfter(cursor)] : []), limit(pageSize)));
    relationDocs.push(...page.docs);
    const next = page.docs.at(-1) || null;
    cursor = relationDocs.length < maxCount && page.docs.length === pageSize
      && next?.id !== cursor?.id ? next : null;
  } while (cursor);

  const relations = relationDocs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() }))
    .sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || ''))
      || a.id.localeCompare(b.id));
  const ids = [...new Set(relations.map(relation => relation.spot_id).filter(Boolean))];
  const spotsById = new Map();
  for (let offset = 0; offset < ids.length; offset += RELATED_SPOT_BATCH_SIZE) {
    const batchIds = ids.slice(offset, offset + RELATED_SPOT_BATCH_SIZE);
    try {
      const batch = await getDocs(query(collection(db, 'spots'),
        where(documentId(), 'in', batchIds), limit(batchIds.length)));
      batch.docs.forEach(snapshot => spotsById.set(snapshot.id, mapSnapshot(snapshot)));
    } catch (error) {
      if (error?.code !== 'permission-denied') throw error;
      // One inaccessible ID can deny the entire list query. Read each ID as
      // a detail request in small waves, retaining readable owner/public spots.
      for (let index = 0; index < batchIds.length; index += FALLBACK_CONCURRENCY) {
        await Promise.all(batchIds.slice(index, index + FALLBACK_CONCURRENCY).map(async id => {
          try {
            const snapshot = await getDoc(doc(db, 'spots', id));
            if (snapshot.exists()) spotsById.set(id, mapSnapshot(snapshot));
          } catch (readError) {
            if (readError?.code !== 'permission-denied') throw readError;
          }
        }));
      }
    }
  }
  const dates = new Map();
  relations.forEach(relation => {
    if (!dates.has(relation.spot_id)) dates.set(relation.spot_id, relation.created_date || null);
  });
  return ids.flatMap(id => {
    const spot = spotsById.get(id);
    return spot ? [{ ...spot, _relation_created_date: dates.get(id) }] : [];
  });
}
