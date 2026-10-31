const ID = /^[A-Za-z0-9_-]{1,150}$/;
const INITIAL_TIMEOUT_MS = 8000;

export function validRevocationFeed(data) {
  return Boolean(data?.format === 1 && Array.isArray(data.revoked)
    && data.revoked.length < 500 && data.revoked.every(id => typeof id === 'string' && ID.test(id))
    && new Set(data.revoked).size === data.revoked.length);
}

// A snapshot from the local Firestore cache is never evidence that the feed is
// current. Every start/reconnect needs a server-confirmed document snapshot.
export function createPublicSpotRevocationState({ listen, timeoutMs = INITIAL_TIMEOUT_MS } = {}) {
  if (typeof listen !== 'function') throw new TypeError('A document listener is required');
  const observed = new Set();
  const subscribers = new Set();
  let healthy = false;
  let started = false;
  let failure = null;
  let unsubscribe = null;
  let generation = 0;
  let waiters = new Set();
  const notify = () => subscribers.forEach(callback => callback({ healthy, revoked: new Set(observed) }));
  const fail = error => {
    healthy = false;
    failure = error instanceof Error ? error : new Error('Revocation feed unavailable');
    for (const waiter of waiters) waiter.reject(failure);
    waiters = new Set();
    notify();
  };
  const accept = snapshot => {
    if (snapshot?.fromCache || !snapshot?.exists) {
      fail(new Error('Revocation feed not server-confirmed'));
      return;
    }
    if (!validRevocationFeed(snapshot.data)) {
      fail(new Error('Invalid revocation feed'));
      return;
    }
    for (const id of snapshot.data.revoked) observed.add(id);
    healthy = true;
    failure = null;
    for (const waiter of waiters) waiter.resolve(new Set(observed));
    waiters = new Set();
    notify();
  };
  const start = () => {
    if (started) return;
    started = true;
    healthy = false;
    failure = null;
    const currentGeneration = ++generation;
    try { unsubscribe = listen(snapshot => {
      if (currentGeneration === generation) accept(snapshot);
    }, error => {
      if (currentGeneration === generation) fail(error);
    }); }
    catch (error) { fail(error); }
  };
  const current = () => {
    start();
    if (healthy) return Promise.resolve(new Set(observed));
    if (failure) return Promise.reject(failure);
    return new Promise((resolve, reject) => {
      const waiter = { resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); } };
      const timer = setTimeout(() => { waiters.delete(waiter); reject(new Error('Revocation feed timeout')); }, timeoutMs);
      waiters.add(waiter);
    });
  };
  const subscribe = callback => {
    start();
    subscribers.add(callback);
    callback({ healthy, revoked: new Set(observed) });
    return () => subscribers.delete(callback);
  };
  const invalidate = () => {
    generation += 1;
    fail(new Error('Revocation feed connection unavailable'));
  };
  const restart = () => {
    generation += 1;
    unsubscribe?.();
    unsubscribe = null;
    started = false;
    healthy = false;
    failure = null;
    start();
    notify();
  };
  return { current, subscribe, invalidate, restart, isRevoked: id => observed.has(id),
    stop: () => { generation += 1; unsubscribe?.(); unsubscribe = null; started = false; invalidate(); } };
}
