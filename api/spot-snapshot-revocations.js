// Bounded public overlay. No client write path exists.

export function snapshotRevocationTargetEnabled(env = process.env) {
  if (env.VERCEL_ENV === 'preview')
    return Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_PROJECT_ID === env.VITE_FIREBASE_STAGING_PROJECT_ID);
  return env.VERCEL_ENV === 'production' && env.FIREBASE_PROJECT_ID === 'spotfinderapp-cdc7b'
    && env.SPOTFINDER_SNAPSHOT_PRODUCTION_APPROVED === 'true'
    && env.VITE_SNAPSHOT_PRODUCTION_RELEASE === 'true'
    && env.VITE_PUBLIC_SPOT_SNAPSHOTS === 'true';
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (request.method !== 'GET') return response.status(405).end();
  if (!snapshotRevocationTargetEnabled())
    return response.status(404).end();
  try {
    const { adminDb } = await import('./_firebaseAdmin.js');
    const row = await adminDb.collection('spot_snapshot_revocation_feed').doc('current').get();
    const ids = row.exists ? row.data()?.revoked : null;
    if (!Array.isArray(ids) || ids.length >= 500
      || ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(id)))
      return response.status(503).json({ error: 'revocation-capacity' });
    return response.status(200).json({ format: 1, revoked: ids });
  } catch {
    console.error('Snapshot revocation feed unavailable');
    return response.status(503).json({ error: 'revocation-unavailable' });
  }
}
