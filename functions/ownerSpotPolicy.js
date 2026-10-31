const OWNER_SPOT_FIELDS = new Set(['title', 'description', 'tags', 'cost', 'access_difficulty',
  'parking', 'best_time', 'directions']);

function validOwnerSpotPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return false;
  const keys = Object.keys(patch);
  if (!keys.length || keys.some(key => !OWNER_SPOT_FIELDS.has(key))) return false;
  const text = (value, max, required = false) => typeof value === 'string'
    && value.length <= max && (!required || value.length > 0);
  const list = (value, maxItems, maxLength) => Array.isArray(value) && value.length <= maxItems
    && value.every(item => text(item, maxLength));
  return keys.every(key => {
    const value = patch[key];
    if (key === 'title') return text(value, 100, true);
    if (key === 'description') return text(value, 2000);
    if (key === 'tags') return list(value, 10, 40);
    if (key === 'best_time') return list(value, 5, 30);
    if (key === 'directions') return text(value, 1000);
    const options = { cost: ['free', 'paid', 'donation'],
      access_difficulty: ['easy', 'moderate', 'hard'],
      parking: ['yes', 'no', 'street', 'paid'] }[key];
    return value === null || value === '' || options?.includes(value);
  });
}

function ownerCanEditSpot(data, uid, email) {
  return data.created_by_uid === uid || (data.created_by_uid == null
    && typeof email === 'string' && email.length > 0 && data.created_by === email);
}
function ownerCanDeleteSpot(data, uid, email) {
  return data.created_by_uid === uid || (typeof email === 'string'
    && email.length > 0 && data.created_by === email);
}

module.exports = { validOwnerSpotPatch, ownerCanEditSpot, ownerCanDeleteSpot };
