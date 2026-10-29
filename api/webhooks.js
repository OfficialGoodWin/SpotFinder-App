import Stripe from 'stripe';
import { adminDb } from './_firebaseAdmin.js';
import { createStripeWebhookHandler } from './stripeWebhookRequest.js';

export const config = { api: { bodyParser: false } };

export default createStripeWebhookHandler({
  db: adminDb,
  getSecrets: () => ({ key: process.env.STRIPE_SECRET_KEY, webhook: process.env.STRIPE_WEBHOOK_SECRET }),
  stripeFactory: key => new Stripe(key, { apiVersion: '2024-06-20' }),
});
