const URL = 'https://us-central1-spotfinderapp-cdc7b.cloudfunctions.net/publicSpotRevocations';
const ID = /^[A-Za-z0-9_-]{1,150}$/;
const SEGMENT = /^s\d{4}$/;

export function validSignal(row) {
  if (row?.format === 1) return Array.isArray(row.revoked) && row.revoked.length < 500
    && row.revoked.every(id => typeof id === 'string' && ID.test(id))
    && new Set(row.revoked).size === row.revoked.length;
  return row?.format === 2 && Number.isSafeInteger(row.revision) && row.revision >= 1
    && Array.isArray(row.segments) && row.segments.length > 0 && row.segments.length <= 8
    && row.segments.every((id, index) => SEGMENT.test(id) && id === `s${String(index).padStart(4, '0')}`)
    && Array.isArray(row.recent) && row.recent.length < 500
    && row.recent.every(id => typeof id === 'string' && ID.test(id))
    && new Set(row.recent).size === row.recent.length;
}

export async function loadPublicSpotRevocations(signal, { request = fetch, now = Date.now } = {}) {
  if (!validSignal(signal)) throw new Error('Invalid revocation signal');
  const response = await request(URL, { method: 'GET', cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(8000) });
  if (!response.ok || response.status !== 200
      || !response.headers.get('cache-control')?.includes('no-store'))
    throw new Error('Public revocation feed unavailable');
  const body = await response.json();
  const ids = body?.revoked;
  if (body?.format !== 1 || !Array.isArray(ids) || ids.length > 4491
      || ids.some(id => typeof id !== 'string' || !ID.test(id))
      || ids.some((id, index) => index > 0 && ids[index - 1] >= id))
    throw new Error('Invalid public revocation feed');
  const timestamp = Date.parse(body.generatedAt);
  if (!Number.isFinite(timestamp) || timestamp > now() + 5000 || timestamp < now() - 30000)
    throw new Error('Stale public revocation feed');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(ids)));
  const revision = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 20);
  if (body.revision !== revision) throw new Error('Invalid public revocation revision');
  const required = signal.format === 1 ? signal.revoked : signal.recent;
  if (required.some(id => !ids.includes(id))) throw new Error('Public revocation feed missing current IDs');
  return { format: 1, revoked: ids };
}
