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
import { adminDb, verifyRequestAuth } from './_firebaseAdmin.js';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
}) : null;

const ALLOWED_ORIGINS = [
  'https://spotfinder.cz',
  'https://www.spotfinder.cz',
  'https://spot-finder-app.vercel.app',
];
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function getPricePlans() {
  return new Map([
    [process.env.STRIPE_ELITE_MONTHLY_PRICE_ID || process.env.VITE_STRIPE_ELITE_MONTHLY, 'elite'],
    [process.env.STRIPE_ELITE_YEARLY_PRICE_ID || process.env.VITE_STRIPE_ELITE_YEARLY, 'elite'],
    [process.env.STRIPE_ULTRA_MONTHLY_PRICE_ID || process.env.VITE_STRIPE_ULTRA_MONTHLY, 'ultra'],
    [process.env.STRIPE_ULTRA_YEARLY_PRICE_ID || process.env.VITE_STRIPE_ULTRA_YEARLY, 'ultra'],
  ].filter(([priceId]) => typeof priceId === 'string' && /^price_[A-Za-z0-9]+$/.test(priceId)));
}

async function isRateLimited(uid) {
  const ref = adminDb.collection('server_rate_limits').doc(`checkout_${uid}`);
  return adminDb.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const now = Date.now();
    const current = snapshot.exists ? snapshot.data() : null;
    if (!current || now - Number(current.windowStart) >= RATE_WINDOW) {
      transaction.set(ref, { count: 1, windowStart: now, updatedAt: new Date(now).toISOString() });
      return false;
    }
    if (Number(current.count) >= RATE_LIMIT) return true;
    transaction.update(ref, { count: Number(current.count) + 1, updatedAt: new Date(now).toISOString() });
    return false;
  });
}

export default async function handler(req, res) {
  // CORS — restrict to own domain in production
  const origin = req.headers.origin || '';
  if (!isAllowedOrigin(origin)) return res.status(403).json({ message: 'Origin not allowed' });
  const responseOrigin = origin || 'https://spotfinder.cz';
  res.setHeader('Access-Control-Allow-Origin', responseOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ message: 'STRIPE_SECRET_KEY is not configured on the server.' });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > 16 * 1024) return res.status(413).json({ message: 'Request body too large' });

  const { priceId, userId } = req.body || {};

  const decoded = await verifyRequestAuth({ headers: new Headers({ authorization: req.headers.authorization || '' }) });
  if (!decoded || decoded.uid !== userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (await isRateLimited(decoded.uid)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ message: 'Too many requests. Please try again later.' });
  }

  const plan = getPricePlans().get(priceId);
  if (!plan) return res.status(400).json({ message: 'Unknown subscription price' });
  if (!userId) {
    // Without this, the webhook has no way to know whose account to
    // upgrade after a successful payment — a paid subscription would
    // silently never take effect. See api/webhooks/route.js.
    return res.status(400).json({ message: 'userId is required' });
  }

  try {
    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${responseOrigin}/?subscribed=success`,
      cancel_url: `${responseOrigin}/?subscribed=cancel`,
      // Collect billing address for EU VAT compliance
      billing_address_collection: 'auto',
      // Allow promotional codes
      allow_promotion_codes: true,
      // Read by the webhook to attribute payment -> Firestore user doc.
      metadata: { userId: decoded.uid, plan },
      subscription_data: { metadata: { userId: decoded.uid, plan } },
    };

    // Attach email if provided (pre-fills the checkout form)
    if (decoded.email) {
      sessionParams.customer_email = decoded.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('[Stripe] Checkout session error:', err);
    return res.status(500).json({ message: 'Unable to start checkout. Please try again.' });
  }
}
