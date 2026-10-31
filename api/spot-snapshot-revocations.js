// Preview-only, bounded public overlay. No client write path exists.
import { adminDb } from './_firebaseAdmin.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (request.method !== 'GET') return response.status(405).end();
  if (process.env.VERCEL_ENV !== 'preview' || process.env.FIREBASE_PROJECT_ID !== process.env.VITE_FIREBASE_STAGING_PROJECT_ID)
    return response.status(404).end();
  try {
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
