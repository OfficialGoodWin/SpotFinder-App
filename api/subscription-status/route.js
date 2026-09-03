import { adminDb, verifyRequestAuth } from '../_firebaseAdmin.js';

export async function GET(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return Response.json({ error: 'Missing userId' }, { status: 400 });
  }

  // Require the caller to prove they ARE this user — previously this
  // endpoint let anyone pass any userId and read that person's
  // subscription plan/status with no auth check at all (IDOR).
  const decoded = await verifyRequestAuth(request);
  if (!decoded || decoded.uid !== userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return Response.json({ subscription: null });
    }

    const data = userDoc.data();
    return Response.json({
      subscription: data.subscription || null,
      isElite: data.subscription?.status === 'active' && data.subscription?.plan === 'elite',
      isUltra: data.subscription?.status === 'active' && data.subscription?.plan === 'ultra',
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    return Response.json({ subscription: null });
  }
}
