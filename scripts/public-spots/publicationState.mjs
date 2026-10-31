// Pure local model. A future publisher must read the current Firestore document
// with Admin privileges and persist revisions before using this transition.
export function applyTrustedSnapshotChange(state, { id, revision, spot }) {
  if (!(state instanceof Map) || typeof id !== 'string' || !id
    || !Number.isSafeInteger(revision) || revision < 0) throw new TypeError('Invalid trusted change');
  const previous = state.get(id);
  if (previous && revision <= previous.revision) return false;
  state.set(id, { revision, spot: spot || null });
  return true;
}

export function currentSnapshotRecords(state) {
  return [...state.values()].filter(entry => entry.spot).map(entry => entry.spot);
}
