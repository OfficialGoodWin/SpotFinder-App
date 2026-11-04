const { publishable } = require('./publicSpotPublication');

function publicationBlockers(spot, revoked = false) {
  const blockers = [];
  if (!spot || spot.status === 'published') blockers.push('Spot is already published or missing');
  if (spot?.is_public !== true) blockers.push('Spot is private');
  if (spot?.discovery_state === 'hidden') blockers.push('Spot is hidden');
  if (spot?.sensitive_location === true) blockers.push('Spot has a sensitive location');
  if (spot?.flag_count != null && spot.flag_count !== 0) blockers.push('Spot has unresolved flags');
  if (!publishable({ ...spot, status: 'published', needs_review: false })) blockers.push('Spot is missing valid public map data');
  if (revoked) blockers.push('Spot has a permanent snapshot revocation');
  return [...new Set(blockers)];
}

module.exports = { publicationBlockers };
