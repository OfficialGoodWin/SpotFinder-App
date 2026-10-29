// The query is newest-first. Keep one visible vote per known author while
// preserving older arbitrary-ID review documents in Firestore for migration.
export function visiblePoiRatings(rows) {
  const seen = new Set();
  return rows.filter(row => {
    if (!row || row.hidden === true || row.duplicate_superseded === true
        || !Number.isInteger(row.rating) || row.rating < 1 || row.rating > 5) return false;
    const uid = typeof row.created_by_uid === 'string' && row.created_by_uid ? row.created_by_uid : null;
    if (uid && seen.has(uid)) return false;
    if (uid) seen.add(uid);
    return true;
  }).map(row => ({ ...row, comment: typeof row.review === 'string' ? row.review : (row.comment || '') }));
}
