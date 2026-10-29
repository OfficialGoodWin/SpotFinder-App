export class WebhookMappingError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const EVENT_LEASE_MS = 5 * 60 * 1000;
const SUPPORTED_EVENTS = new Set([
  'checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted',
]);

const idOf = value => typeof value === 'string' ? value : value?.id || null;
const validPlan = value => ['elite', 'ultra'].includes(value);

// Existing SpotFinder billing policy grants access only for an active paid
// subscription. Trials and payment-problem states remain visible but inactive.
export function hasPaidAccess(subscription, now = Date.now()) {
  return validPlan(subscription?.plan) && subscription?.status === 'active'
    && Number(subscription?.currentPeriodEnd) > now / 1000;
}

function sameOrMissing(values, code) {
  const present = values.filter(value => typeof value === 'string' && value.length);
  if (new Set(present).size > 1) throw new WebhookMappingError(code);
  return present[0] || null;
}

async function resolveSubscription(stripe, event) {
  const session = event.type === 'checkout.session.completed' ? event.data.object : null;
  const eventSubscription = session ? null : event.data.object;
  const subscriptionId = idOf(session?.subscription) || eventSubscription?.id;
  if (!subscriptionId || !/^sub_[A-Za-z0-9]+$/.test(subscriptionId))
    throw new WebhookMappingError('missing_subscription');
  let subscription;
  try { subscription = await stripe.subscriptions.retrieve(subscriptionId); }
  catch (error) {
    // A deleted subscription can be absent from a provider lookup. Its signed
    // deletion event is sufficient to deny that subscription's access.
    if (event.type !== 'customer.subscription.deleted' || eventSubscription?.status !== 'canceled'
        || ![404, 'resource_missing'].includes(error?.statusCode || error?.code)) throw error;
    subscription = eventSubscription;
  }
  if (subscription.id !== subscriptionId) throw new WebhookMappingError('subscription_mismatch');
  const customerId = sameOrMissing([idOf(subscription.customer), idOf(session?.customer)], 'customer_mismatch');
  return { session, subscription, subscriptionId, customerId, observedAtMs: Date.now() };
}

async function resolveMapping(db, details) {
  const { session, subscription, subscriptionId, customerId } = details;
  const linkRef = db.collection('stripe_subscription_links').doc(subscriptionId);
  const link = await linkRef.get();
  const customerRef = customerId ? db.collection('stripe_customer_links').doc(customerId) : null;
  const customerLink = customerRef ? await customerRef.get() : null;
  const users = await db.collection('users').where('subscription.stripeSubscriptionId', '==', subscriptionId).limit(2).get();
  if (users.size > 1) throw new WebhookMappingError('duplicate_local_mapping');
  const priorUser = users.empty ? null : users.docs[0];
  const uid = sameOrMissing([
    subscription.metadata?.userId, session?.metadata?.userId,
    link.exists ? link.data().userId : null,
    customerLink?.exists ? customerLink.data().userId : null,
    priorUser?.id,
  ], 'uid_mapping_conflict');
  const plan = sameOrMissing([
    subscription.metadata?.plan, session?.metadata?.plan,
    link.exists ? link.data().plan : null,
    priorUser?.data().subscription?.plan,
  ], 'plan_mapping_conflict');
  if (!uid || !validPlan(plan)) throw new WebhookMappingError('unresolved_mapping');
  if (session && session.payment_status !== 'paid' && subscription.status === 'active')
    throw new WebhookMappingError('checkout_not_paid');
  return { uid, plan, linkRef, customerRef };
}

function shouldReplaceSubscription(current, next, nowSeconds) {
  if (!current?.stripeSubscriptionId) return true;
  if (current.stripeSubscriptionId === next.stripeSubscriptionId) {
    if (Number(current.lastObservedAtMs || 0) > Number(next.lastObservedAtMs || 0)) return false;
    // If two observations share a millisecond, prefer the state that does
    // not grant access unless the newer Stripe event explicitly reactivated it.
    if (Number(current.lastObservedAtMs || 0) === Number(next.lastObservedAtMs || 0)
        && current.status !== 'active' && next.status === 'active'
        && next.lastStripeEventCreated <= Number(current.lastStripeEventCreated || 0)) return false;
    return true;
  }
  const currentEligible = current.status === 'active' && Number(current.currentPeriodEnd) > nowSeconds;
  const nextEligible = next.status === 'active' && Number(next.currentPeriodEnd) > nowSeconds;
  if (currentEligible && !nextEligible) return false;
  if (!currentEligible && nextEligible) return true;
  return Number(next.stripeSubscriptionCreated || 0) >= Number(current.stripeSubscriptionCreated || 0);
}

export async function reconcileStripeEvent({ stripe, db, event, now = Date.now() }) {
  if (!SUPPORTED_EVENTS.has(event.type)) return { ignored: true };
  const details = await resolveSubscription(stripe, event);
  const mapping = await resolveMapping(db, details);
  const observedAtMs = details.observedAtMs;
  const { subscription, subscriptionId, customerId } = details;
  const periodEnd = Number(subscription.current_period_end) || null;
  const next = {
    plan: mapping.plan,
    status: subscription.status || 'incomplete',
    stripeCustomer: customerId,
    stripeSubscriptionId: subscriptionId,
    stripeSubscriptionCreated: Number(subscription.created) || 0,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    lastStripeEventCreated: Number(event.created) || 0,
    lastObservedAtMs: observedAtMs,
    lastReconciledAt: new Date(now).toISOString(),
  };
  return db.runTransaction(async tx => {
    const userRef = db.collection('users').doc(mapping.uid);
    const [user, link, customerLink, deletion] = await Promise.all([
      tx.get(userRef), tx.get(mapping.linkRef),
      mapping.customerRef ? tx.get(mapping.customerRef) : Promise.resolve(null),
      tx.get(db.collection('account_deletion_requests').doc(mapping.uid)),
    ]);
    if (deletion.exists && deletion.data().status === 'complete')
      return { userId: mapping.uid, ignored: 'account_deleted' };
    if (deletion.exists && ['processing', 'auth_deletion_started', 'failed'].includes(deletion.data().status))
      throw new WebhookMappingError('account_deletion_in_progress');
    if (link.exists && (link.data().userId !== mapping.uid || link.data().plan !== mapping.plan))
      throw new WebhookMappingError('uid_mapping_conflict');
    if (customerLink?.exists && customerLink.data().userId !== mapping.uid)
      throw new WebhookMappingError('uid_mapping_conflict');
    if (!link.exists) tx.set(mapping.linkRef, {
      userId: mapping.uid, plan: mapping.plan, customerId, linkedAt: new Date(now).toISOString(),
    });
    if (mapping.customerRef && !customerLink?.exists)
      tx.set(mapping.customerRef, { userId: mapping.uid, linkedAt: new Date(now).toISOString() });
    const current = user.exists ? user.data().subscription : null;
    if (!shouldReplaceSubscription(current, next, now / 1000))
      return { userId: mapping.uid, updated: false, status: current?.status || null };
    if (user.exists) tx.update(userRef, { subscription: next });
    else tx.set(userRef, { subscription: next });
    return { userId: mapping.uid, updated: true, status: next.status };
  });
}

export async function claimStripeEvent(db, event, now = Date.now()) {
  const ref = db.collection('stripe_webhook_events').doc(event.id);
  return db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.exists && current.data().status === 'complete') return { state: 'complete', ref };
    if (current.exists && current.data().status === 'processing'
        && Number(current.data().leaseUntil) > now) return { state: 'busy', ref };
    tx.set(ref, { type: event.type, status: 'processing', leaseUntil: now + EVENT_LEASE_MS,
      attempts: Number(current.data()?.attempts || 0) + 1,
      receivedAt: current.data()?.receivedAt || new Date(now).toISOString() }, { merge: true });
    return { state: 'claimed', ref };
  });
}

export async function processClaimedStripeEvent({ stripe, db, event, now = Date.now() }) {
  const claim = await claimStripeEvent(db, event, now);
  if (claim.state === 'complete') return { duplicate: true };
  if (claim.state === 'busy') throw new WebhookMappingError('event_processing');
  try {
    const result = await reconcileStripeEvent({ stripe, db, event, now });
    await claim.ref.set({ status: 'complete', processedAt: new Date(now).toISOString() }, { merge: true });
    return result;
  } catch (error) {
    await claim.ref.set({ status: error instanceof WebhookMappingError ? 'unresolved' : 'retryable',
      lastErrorCode: error?.code || 'processing_error', lastAttemptAt: new Date(now).toISOString() }, { merge: true });
    throw error;
  }
}
