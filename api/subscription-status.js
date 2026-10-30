import { adminDb, adminApp, adminAppCheck, verifyRequestAuth } from './_firebaseAdmin.js';
import { hasPaidAccess } from './stripeWebhookPolicy.js';
import { requireVercelAppCheck } from './appCheckGuard.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = typeof req.query?.userId === 'string' ? req.query.userId : '';
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  if (!await requireVercelAppCheck(req, res, { adminApp, adminAppCheck,
    enforceEnv: 'VERCEL_APPCHECK_ENFORCE_SUBSCRIPTION_STATUS' })) return;

  const decoded = await verifyRequestAuth({ headers: new Headers({ authorization: req.headers.authorization || '' }) });
  if (!decoded || decoded.uid !== userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const subscription = userDoc.exists ? userDoc.data()?.subscription || null : null;
    const entitled = hasPaidAccess(subscription);
    return res.status(200).json({
      subscription,
      isElite: entitled && subscription.plan === 'elite',
      isUltra: entitled && subscription.plan === 'ultra',
    });
  } catch (error) {
    console.error('Subscription status error', { code: error?.code || 'unknown' });
    return res.status(500).json({ error: 'Unable to load subscription status' });
  }
}
