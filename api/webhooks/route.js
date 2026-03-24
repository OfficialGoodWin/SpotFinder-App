import Stripe from 'stripe';
import { getFirebaseServices } from '../../../src/api/firebaseClient.js'; // Adjust path

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
    const userId = session.metadata?.userId; // Pass from client

    if (userId && session.payment_status === 'paid') {
      const { db } = await getFirebaseServices();
      await db.collection('users').doc(userId).update({
        subscription: {
          plan: session.subscription,
          status: 'active',
          stripeCustomer: session.customer,
          currentPeriodEnd: session.subscription.ends_at
        }
      });
    }
  }

  return new Response('OK', { status: 200 });
}

