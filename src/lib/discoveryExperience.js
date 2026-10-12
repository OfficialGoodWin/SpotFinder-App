export function shouldShowWelcome({ dismissed, consentDecided }) {
  return !dismissed && Boolean(consentDecided);
}

export function visibleExploreSpots(spots = [], limit = 3) {
  return spots
    .filter(spot => spot?.id && Number.isFinite(Number(spot.lat)) && Number.isFinite(Number(spot.lng ?? spot.lon)))
    .slice(0, limit);
}
