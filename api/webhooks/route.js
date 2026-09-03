import Stripe from 'stripe';
import { adminDb } from '../_firebaseAdmin.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  const sig = request.headers.get('stripe-signature');
  const body = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Webhook signature failed', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId; // must be set by the client when creating the session

    if (userId && session.payment_status === 'paid') {
      // Stripe sends the subscription ID as a string on this event, not the
      // expanded object, so pull period end from the subscription resource.
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      let currentPeriodEnd = null;
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        currentPeriodEnd = sub.current_period_end;
      }

      // Uses the Admin SDK — bypasses Firestore Security Rules by design,
      // since this is trusted server code that already verified the Stripe
      // signature above. This is the ONLY place `users/{id}.subscription`
      // should ever be written (see firestore.rules: `allow write: if false`).
      await adminDb.collection('users').doc(userId).set({
        subscription: {
          plan: session.metadata?.plan || 'elite',
          status: 'active',
          stripeCustomer: session.customer,
          stripeSubscriptionId: subscriptionId || null,
          currentPeriodEnd,
        },
      }, { merge: true });
    }
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
          status: subscription.status === 'active' ? 'active' : 'inactive',
          currentPeriodEnd: subscription.current_period_end,
        },
      }, { merge: true });
    }
  }

  return new Response('OK', { status: 200 });
}
