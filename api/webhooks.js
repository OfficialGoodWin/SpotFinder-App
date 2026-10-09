import Stripe from 'stripe';
import { adminDb } from './_firebaseAdmin.js';

export const config = { api: { bodyParser: false } };

const MAX_WEBHOOK_BYTES = 1024 * 1024;

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_WEBHOOK_BYTES) throw Object.assign(new Error('Webhook payload too large'), { statusCode: 413 });
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

async function processEvent(stripe, event) {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan;
    if (!userId || !['elite', 'ultra'].includes(plan) || session.payment_status !== 'paid') return;

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
    let currentPeriodEnd = null;
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      currentPeriodEnd = subscription.current_period_end;
    }

    await adminDb.collection('users').doc(userId).set({
      subscription: {
        plan,
        status: 'active',
        stripeCustomer: session.customer || null,
        stripeSubscriptionId: subscriptionId || null,
        currentPeriodEnd,
      },
    }, { merge: true });
    return;
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    const usersSnap = await adminDb.collection('users')
      .where('subscription.stripeSubscriptionId', '==', subscription.id)
      .limit(1)
      .get();
    if (!usersSnap.empty) {
      await usersSnap.docs[0].ref.set({
        subscription: {
          status: ['active', 'trialing'].includes(subscription.status) ? 'active' : 'inactive',
          currentPeriodEnd: subscription.current_period_end,
        },
      }, { merge: true });
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe webhook secrets are not configured');
    return res.status(503).send('Webhook unavailable');
  }

  const declaredLength = Number(req.headers['content-length'] || 0);
  if (declaredLength > MAX_WEBHOOK_BYTES) return res.status(413).send('Payload too large');

  const signature = Array.isArray(req.headers['stripe-signature'])
    ? req.headers['stripe-signature'][0]
    : req.headers['stripe-signature'];
  if (!signature) return res.status(400).send('Missing Stripe signature');

  try {
    const rawBody = await readRawBody(req);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
    const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    const eventRef = adminDb.collection('stripe_webhook_events').doc(event.id);
    if ((await eventRef.get()).exists) return res.status(200).send('Already processed');

    await processEvent(stripe, event);
    try {
      await eventRef.create({ type: event.type, processedAt: new Date().toISOString() });
    } catch (error) {
      // A concurrent delivery may have completed first; event handlers above
      // only perform idempotent document updates.
      if (error?.code !== 6 && error?.code !== 'already-exists') throw error;
    }
    return res.status(200).send('OK');
  } catch (error) {
    const status = error?.statusCode || (error?.type === 'StripeSignatureVerificationError' ? 400 : 500);
    if (status === 400) console.warn('Stripe webhook signature verification failed');
    else console.error('Stripe webhook processing failed:', error);
    return res.status(status).send(status === 400 ? 'Invalid Stripe signature' : 'Webhook processing failed');
  }
}
