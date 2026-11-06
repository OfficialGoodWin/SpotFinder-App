export const REPORT_REASONS = {
  spot: ['wrong_info', 'wrong_location', 'closed_or_missing', 'duplicate', 'inappropriate', 'spam_scam', 'other_safety'],
  poi: ['wrong_info', 'wrong_location', 'closed_or_missing', 'duplicate', 'inappropriate', 'spam_scam', 'other_safety'],
  poi_photo: ['wrong_place', 'inappropriate', 'copyright', 'private_info', 'misleading', 'spam', 'other'],
  social_post: ['unrelated', 'inappropriate', 'spam', 'misleading', 'privacy', 'unavailable', 'other'],
};

export function canSubmitReport({ verified, reason, busy, challengeRequired, challengeToken }) {
  return verified && Boolean(reason) && !busy && (!challengeRequired || Boolean(challengeToken));
}
