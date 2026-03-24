/**
 * Vercel Serverless Function: POST /api/create-checkout-session
 *
 * Creates a Stripe Checkout Session for SpotFinder Elite / Ultra subscriptions.
 *
 * Required environment variables (set in Vercel dashboard → Settings → Environment Variables):
 *   STRIPE_SECRET_KEY          sk_live_... (or sk_test_... for testing)
 *
 * The client sends: { priceId, customerEmail, successUrl, cancelUrl }
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

export default async function handler(req, res) {
  // CORS headers — allow requests from your own domain only
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ message: 'STRIPE_SECRET_KEY is not configured on the server.' });
  }

  const { priceId, customerEmail, successUrl, cancelUrl } = req.body || {};

  if (!priceId) {
    return res.status(400).json({ message: 'priceId is required' });
  }

  try {
    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${req.headers.origin}/?subscribed=success`,
      cancel_url:  cancelUrl  || `${req.headers.origin}/?subscribed=cancel`,
      // Collect billing address for EU VAT compliance
      billing_address_collection: 'auto',
      // Allow promotional codes
      allow_promotion_codes: true,
    };

    // Attach email if provided (pre-fills the checkout form)
    if (customerEmail) {
      sessionParams.customer_email = customerEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('[Stripe] Checkout session error:', err.message);
    return res.status(500).json({ message: err.message });
  }
}
