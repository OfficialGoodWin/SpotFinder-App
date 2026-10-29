import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createStripeWebhookHandler } from '../api/stripeWebhookRequest.js';
import { hasPaidAccess } from '../api/stripeWebhookPolicy.js';

const copy = value => structuredClone(value);

function memoryDb() {
  const tables = new Map();
  const table = name => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  };
  const ref = (name, id) => ({
    id,
    async get() { const row = table(name).get(id); return { id, exists: row !== undefined, data: () => copy(row) }; },
    async set(data, options = {}) {
      const old = table(name).get(id) || {};
      table(name).set(id, copy(options.merge ? { ...old, ...data } : data));
    },
    async update(data) { table(name).set(id, { ...copy(table(name).get(id)), ...copy(data) }); },
    async delete() { table(name).delete(id); },
  });
  const db = {
    collection(name) {
      return {
        doc(id) { return ref(name, id); },
        where(path, operator, value) {
          assert.equal(operator, '==');
          return { limit(max) { return { async get() {
            const docs = [...table(name)].filter(([, row]) => path.split('.').reduce((part, key) => part?.[key], row) === value)
              .slice(0, max).map(([id, row]) => ({ id, ref: ref(name, id), data: () => copy(row) }));
            return { docs, size: docs.length, empty: docs.length === 0 };
          } }; } };
        },
      };
    },
    async runTransaction(callback) {
      const writes = [];
      const tx = {
        get: reference => reference.get(),
        set: (reference, data, options) => writes.push(() => reference.set(data, options)),
        update: (reference, data) => writes.push(() => reference.update(data)),
      };
      const result = await callback(tx);
      for (const write of writes) await write();
      return result;
    },
    table,
  };
  return db;
}

function harness() {
  const db = memoryDb();
  const subscriptions = new Map();
  let retrieveCount = 0;
  const stripe = {
    subscriptions: { retrieve: async id => { retrieveCount += 1; return copy(subscriptions.get(id)); } },
    webhooks: { constructEvent: (raw, signature) => {
      if (signature !== 'valid') throw Object.assign(new Error('bad signature'), { type: 'StripeSignatureVerificationError' });
      return JSON.parse(raw.toString());
    } },
  };
  const handler = createStripeWebhookHandler({ db, getSecrets: () => ({ key: 'dummy-key', webhook: 'dummy-secret' }),
    stripeFactory: () => stripe });
  const deliver = async (event, signature = 'valid') => {
    const payload = Buffer.from(JSON.stringify(event));
    const req = Readable.from([payload]);
    req.method = 'POST'; req.headers = { 'content-length': String(payload.length), 'stripe-signature': signature };
    const res = { code: 0, body: '', status(code) { this.code = code; return this; }, send(body) { this.body = body; return this; } };
    await handler(req, res);
    return res;
  };
  return { db, subscriptions, deliver, get retrieveCount() { return retrieveCount; } };
}

const future = () => Math.floor(Date.now() / 1000) + 3600;
const subscription = (status = 'active', extra = {}) => ({ id: 'sub_dummy', customer: 'cus_dummy',
  metadata: { userId: 'dummy-user', plan: 'elite' }, created: 100, current_period_end: future(),
  status, cancel_at_period_end: false, ...extra });
const checkout = (id = 'evt_checkout') => ({ id, type: 'checkout.session.completed', created: 100,
  data: { object: { subscription: 'sub_dummy', customer: 'cus_dummy', payment_status: 'paid',
    metadata: { userId: 'dummy-user', plan: 'elite' } } } });
const change = (id, type, object, created = 101) => ({ id, type, created, data: { object: copy(object) } });
const userSubscription = async db => (await db.collection('users').doc('dummy-user').get()).data()?.subscription;

test('checkout then immediate cancellation removes entitlement', async () => {
  const h = harness(); h.subscriptions.set('sub_dummy', subscription());
  assert.equal((await h.deliver(checkout())).code, 200);
  assert.equal(hasPaidAccess(await userSubscription(h.db)), true);
  h.subscriptions.set('sub_dummy', subscription('canceled'));
  assert.equal((await h.deliver(change('evt_cancel', 'customer.subscription.deleted', subscription('canceled')))).code, 200);
  assert.equal(hasPaidAccess(await userSubscription(h.db)), false);
});

test('cancellation before delayed checkout completion never grants access', async () => {
  const h = harness(); h.subscriptions.set('sub_dummy', subscription('canceled'));
  assert.equal((await h.deliver(change('evt_cancel', 'customer.subscription.deleted', subscription('canceled')))).code, 200);
  assert.equal((await h.deliver(checkout())).code, 200);
  assert.equal((await userSubscription(h.db)).status, 'canceled');
  assert.equal(hasPaidAccess(await userSubscription(h.db)), false);
});

test('duplicate checkout and cancellation events are idempotent', async () => {
  const h = harness(); h.subscriptions.set('sub_dummy', subscription());
  await h.deliver(checkout());
  const retrieved = h.retrieveCount;
  assert.equal((await h.deliver(checkout())).body, 'Already received');
  assert.equal(h.retrieveCount, retrieved);
  h.subscriptions.set('sub_dummy', subscription('canceled'));
  const deleted = change('evt_cancel', 'customer.subscription.deleted', subscription('canceled'));
  await h.deliver(deleted);
  assert.equal((await h.deliver(deleted)).body, 'Already received');
  assert.equal(hasPaidAccess(await userSubscription(h.db)), false);
});

test('late active update reads canceled current Stripe state', async () => {
  const h = harness(); h.subscriptions.set('sub_dummy', subscription('canceled'));
  await h.deliver(change('evt_cancel', 'customer.subscription.deleted', subscription('canceled'), 102));
  const stale = change('evt_old_update', 'customer.subscription.updated', subscription('active'), 101);
  assert.equal((await h.deliver(stale)).code, 200);
  assert.equal((await userSubscription(h.db)).status, 'canceled');
});

test('an old event still revokes access if Stripe is now canceled and cancellation delivery was missed', async () => {
  const h = harness(); h.subscriptions.set('sub_dummy', subscription());
  await h.deliver(checkout());
  assert.equal(hasPaidAccess(await userSubscription(h.db)), true);
  h.subscriptions.set('sub_dummy', subscription('canceled'));
  const late = change('evt_late', 'customer.subscription.updated', subscription('active'), 99);
  assert.equal((await h.deliver(late)).code, 200);
  assert.equal(hasPaidAccess(await userSubscription(h.db)), false);
});

test('period-end cancellation retains access only through the paid period', async () => {
  const h = harness(); const atEnd = subscription('active', { cancel_at_period_end: true });
  h.subscriptions.set('sub_dummy', atEnd);
  await h.deliver(change('evt_period_end', 'customer.subscription.updated', atEnd));
  const stored = await userSubscription(h.db);
  assert.equal(stored.cancelAtPeriodEnd, true);
  assert.equal(hasPaidAccess(stored), true);
  assert.equal(hasPaidAccess(stored, (stored.currentPeriodEnd + 1) * 1000), false);
  for (const status of ['trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'paused'])
    assert.equal(hasPaidAccess({ ...stored, status }), false);
});

test('invalid signature is rejected before any event claim', async () => {
  const h = harness(); h.subscriptions.set('sub_dummy', subscription());
  assert.equal((await h.deliver(checkout(), 'invalid')).code, 400);
  assert.equal(h.db.table('stripe_webhook_events').size, 0);
  assert.equal(h.db.table('users').size, 0);
});

test('unknown mapping remains retryable and succeeds after a trusted link appears', async () => {
  const h = harness(); const unknown = subscription('active', { metadata: {} });
  h.subscriptions.set('sub_dummy', unknown);
  const event = change('evt_unknown', 'customer.subscription.updated', unknown);
  assert.equal((await h.deliver(event)).code, 503);
  assert.equal((await h.db.collection('stripe_webhook_events').doc(event.id).get()).data().status, 'unresolved');
  assert.equal(h.db.table('users').size, 0);
  await h.db.collection('stripe_subscription_links').doc('sub_dummy').set({ userId: 'dummy-user', plan: 'elite', customerId: 'cus_dummy' });
  assert.equal((await h.deliver(event)).code, 200);
  assert.equal(hasPaidAccess(await userSubscription(h.db)), true);
});

test('a completed account deletion is not recreated by a late billing event', async () => {
  const h = harness(); h.subscriptions.set('sub_dummy', subscription());
  await h.db.collection('account_deletion_requests').doc('dummy-user').set({ status: 'complete' });
  assert.equal((await h.deliver(checkout())).code, 200);
  assert.equal(h.db.table('users').size, 0);
});
