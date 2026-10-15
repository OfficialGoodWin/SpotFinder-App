export function createNearbyRequestGate() {
  let generation = 0;
  return {
    next: () => ++generation,
    isCurrent: requestId => requestId === generation,
    cancel: () => { generation += 1; },
  };
}

export function nearbyPage(spots, visibleCount = 20) {
  const rows = spots || [];
  const displayed = rows.slice(0, Math.max(0, visibleCount));
  return { displayed, remaining: rows.length - displayed.length };
}

export function nearbyEmptyTitle(maxDistance, complete = true) {
  if (!complete) return 'No matching spots in the loaded area';
  return Number.isFinite(maxDistance)
    ? `No spots found within ${maxDistance} km`
    : 'No spots found in the searched area';
}
