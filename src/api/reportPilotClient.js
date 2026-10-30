import { getFirebaseServices, getVercelAppCheckToken } from './firebaseClient';

export async function submitReportPilot(payload, idempotencyKey, turnstileToken = '') {
  const user = getFirebaseServices().auth.currentUser;
  if (!user || user.isAnonymous || !user.emailVerified) throw Object.assign(new Error('Verified account required'), { code: 'VERIFIED_AUTH_REQUIRED' });
  const token = await user.getIdToken();
  const appCheckToken = await getVercelAppCheckToken();
  const response = await fetch('/api/submit-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'X-Firebase-AppCheck': appCheckToken },
    body: JSON.stringify({ ...payload, idempotencyKey, ...(turnstileToken ? { turnstileToken } : {}) }),
  });
  const result = await response.json().catch(() => ({ code: 'REPORT_SERVICE_UNAVAILABLE' }));
  if (!response.ok) throw Object.assign(new Error(result.code || 'REPORT_SERVICE_UNAVAILABLE'), {
    code: result.code, retryAfter: Number(response.headers.get('Retry-After') || 0),
  });
  return result;
}
