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

// Simple in-memory rate limiter (resets on cold start, good enough for serverless)
const rateLimitMap = new Map();
const RATE_LIMIT = 10;       // max requests
const RATE_WINDOW = 60000;   // per 60 seconds

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count += 1;
  rateLimitMap.set(ip, entry);
  return entry.count > RATE_LIMIT;
}

const ALLOWED_ORIGINS = [
  'https://spotfinder.cz',
  'https://www.spotfinder.cz',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.startsWith('http://localhost')) return true;
  // Allow all Vercel preview deployments (*.vercel.app)
  if (/^https:\/\/[a-z0-9-]+-officialgoodwins-projects\.vercel\.app$/.test(origin)) return true;
  if (/^https:\/\/spot-finder-app[a-z0-9-]*\.vercel\.app$/.test(origin)) return true;
  return false;
}

export default async function handler(req, res) {
  // CORS — restrict to own domain in production, allow preview deployments
  const origin = req.headers.origin || '';
  const allowedOrigin = isAllowedOrigin(origin) ? origin : 'https://spotfinder.cz';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  // Rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ message: 'Too many requests. Please try again later.' });
  }

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
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Checkout session error:', err.message);
    return res.status(500).json({ message: err.message });
  }
}
