import { getFirebaseServices } from '../../../src/api/firebaseClient.js';

export async function GET(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return Response.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    const { db } = await getFirebaseServices();
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return Response.json({ subscription: null });
    }

    const data = userDoc.data();
    return Response.json({ 
      subscription: data.subscription || null,
      isElite: data.subscription?.status === 'active' && data.subscription?.plan === 'elite',
      isUltra: data.subscription?.status === 'active' && data.subscription?.plan === 'ultra'
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    return Response.json({ subscription: null });
  }
}

