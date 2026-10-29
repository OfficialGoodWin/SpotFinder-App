import { processClaimedStripeEvent, WebhookMappingError } from './stripeWebhookPolicy.js';

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

export function createStripeWebhookHandler({ db, getSecrets, stripeFactory }) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');
    const { key, webhook } = getSecrets();
    if (!key || !webhook) return res.status(503).send('Webhook unavailable');
    if (Number(req.headers['content-length'] || 0) > MAX_WEBHOOK_BYTES)
      return res.status(413).send('Payload too large');
    const signature = Array.isArray(req.headers['stripe-signature'])
      ? req.headers['stripe-signature'][0] : req.headers['stripe-signature'];
    if (!signature) return res.status(400).send('Missing Stripe signature');
    try {
      const stripe = stripeFactory(key);
      const event = stripe.webhooks.constructEvent(await readRawBody(req), signature, webhook);
      const result = await processClaimedStripeEvent({ stripe, db, event });
      return res.status(200).send(result.duplicate ? 'Already received' : 'OK');
    } catch (error) {
      const status = error?.statusCode || (error?.type === 'StripeSignatureVerificationError' ? 400
        : error instanceof WebhookMappingError ? 503 : 500);
      if (status !== 400) console.error('Stripe webhook processing failed', { code: error?.code || 'unknown' });
      return res.status(status).send(status === 400 ? 'Invalid Stripe signature' : 'Webhook processing failed');
    }
  };
}
