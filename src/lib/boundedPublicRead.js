// Shared only by public, bounded reads. Failures may briefly suppress retries,
// but only successful results enter the response cache.
export function createBoundedPublicRead({ ttlMs = 60000, maxEntries = 8, maxConcurrent = 2, maxQueued = 8, maxQueueWaitMs = 15000,
  failureBackoffMs = 0, maxFailureBackoffMs = 2000, now = Date.now } = {}) {
  const entries = new Map();
  const failures = new Map();
  const queue = [];
  let active = 0;
  let epoch = 0;

  const drain = () => {
    while (active < maxConcurrent && queue.length) {
      const job = queue.shift();
      clearTimeout(job.timer);
      active += 1;
      Promise.resolve().then(job.load).then(value => {
        if (job.epoch === epoch) {
          entries.delete(job.key);
          failures.delete(job.key);
          entries.set(job.key, { value, expires: now() + ttlMs });
        }
        while ([...entries.values()].filter(entry => !entry.promise).length > maxEntries) {
          const oldestCompleted = [...entries].find(([, entry]) => !entry.promise)?.[0];
          if (!oldestCompleted) break;
          entries.delete(oldestCompleted);
        }
        job.resolve(value);
      }, error => {
        if (job.epoch === epoch) {
          entries.delete(job.key);
          if (failureBackoffMs > 0) {
            const attempts = Math.min(8, (failures.get(job.key)?.attempts || 0) + 1);
            const duration = Math.min(maxFailureBackoffMs, failureBackoffMs * 2 ** (attempts - 1));
            failures.delete(job.key);
            failures.set(job.key, { error, attempts, until: now() + duration });
            if (failures.size > maxEntries) failures.delete(failures.keys().next().value);
          }
        }
        job.reject(error);
      }).finally(() => { active -= 1; drain(); });
    }
  };

  const read = (key, load) => {
    const cached = entries.get(key);
    if (cached?.promise) return cached.promise;
    if (cached && cached.expires > now()) return Promise.resolve(cached.value);
    entries.delete(key);
    const failure = failures.get(key);
    if (failure && now() < failure.until) return Promise.reject(failure.error);
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    entries.set(key, { promise });
    if (queue.length >= maxQueued) {
      const obsolete = queue.shift();
      clearTimeout(obsolete.timer);
      if (obsolete.epoch === epoch) entries.delete(obsolete.key);
      obsolete.reject(new Error('Superseded public read'));
    }
    const job = { key, load, resolve, reject, epoch };
    job.timer = setTimeout(() => {
      const index = queue.indexOf(job);
      if (index < 0) return;
      queue.splice(index, 1);
      if (job.epoch === epoch) entries.delete(key);
      reject(new Error('Queued public read timed out'));
    }, maxQueueWaitMs);
    queue.push(job);
    drain();
    return promise;
  };
  read.clear = () => { epoch += 1; entries.clear(); failures.clear(); };
  return read;
}
