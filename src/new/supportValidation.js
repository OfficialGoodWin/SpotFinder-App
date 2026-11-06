export function canSubmitSupport({ page, category, area, message, email, status }) {
  if (status === 'sending' || !message.trim()) return false;
  if (page === 'feedback') return Boolean(category);
  if (page === 'report') return Boolean(category && area.trim());
  if (page === 'contact') return Boolean(email.trim());
  return false;
}
