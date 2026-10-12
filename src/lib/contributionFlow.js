export const VOICE_ERROR_MESSAGES = {
  unsupported: 'Voice search is not supported in this browser. Type your search instead.',
  noDevice: 'No microphone found. Connect one or type your search instead.',
  permission: 'Microphone access was denied. Allow it in browser settings or type instead.',
  network: 'Voice recognition could not reach the network. Check your connection or type instead.',
  failed: 'Voice recognition did not work. Please try again or type instead.',
};

export function voiceErrorMessage(error) {
  const code = typeof error === 'string' ? error : error?.error || error?.name || '';
  if (['NotFoundError', 'DevicesNotFoundError', 'audio-capture', 'no-device'].includes(code)) return VOICE_ERROR_MESSAGES.noDevice;
  if (['NotAllowedError', 'SecurityError', 'not-allowed', 'service-not-allowed', 'permission-denied'].includes(code)) return VOICE_ERROR_MESSAGES.permission;
  if (['network', 'NetworkError'].includes(code)) return VOICE_ERROR_MESSAGES.network;
  if (code === 'unsupported') return VOICE_ERROR_MESSAGES.unsupported;
  return VOICE_ERROR_MESSAGES.failed;
}

export function searchFailureMessage(error) {
  if (error?.name === 'AbortError') return '';
  if (['NetworkError', 'TypeError'].includes(error?.name) || /network|fetch|offline/i.test(String(error?.message || ''))) {
    return 'Search could not reach the network. Check your connection and try again.';
  }
  return 'Search is temporarily unavailable. Try again in a moment.';
}

export function createAddSpotDraft(values = {}) {
  return {
    title: values.title || '',
    description: values.description || '',
    tags: Array.isArray(values.tags) ? values.tags : [],
    cost: values.cost || '',
    accessDifficulty: values.accessDifficulty || '',
    parking: values.parking || '',
    bestTime: Array.isArray(values.bestTime) ? values.bestTime : [],
    directions: values.directions || '',
    socialUrl: values.socialUrl || '',
    overallRating: Number(values.overallRating) || 0,
    accessRating: Number(values.accessRating) || 0,
    conditionRating: Number(values.conditionRating) || 0,
    safetyRating: Number(values.safetyRating) || 0,
    crowdednessRating: Number(values.crowdednessRating) || 0,
  };
}

export function hasMeaningfulAddSpotDraft(values = {}) {
  const draft = createAddSpotDraft(values);
  return Boolean(
    draft.title.trim() || draft.description.trim() || draft.tags.length || draft.cost ||
    draft.accessDifficulty || draft.parking || draft.bestTime.length || draft.directions.trim() || draft.socialUrl.trim() ||
    draft.overallRating || draft.accessRating || draft.conditionRating || draft.safetyRating || draft.crowdednessRating
  );
}

export function validateRequiredSpotFields({ title = '', description = '', attested = false } = {}) {
  const errors = {};
  if (!title.trim() || title.trim().toLocaleLowerCase() === 'spot') errors.title = 'Give this place a specific, recognizable name.';
  if (!description.trim()) errors.description = 'Describe what visitors will find at this place.';
  if (!attested) errors.attested = 'Confirm that the information and any photos are yours to share.';
  return errors;
}
