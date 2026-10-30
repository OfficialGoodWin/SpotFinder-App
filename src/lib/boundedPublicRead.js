// Shared only by public, bounded reads. Failed requests are never cached.
export function createBoundedPublicRead({ ttlMs = 60000, maxEntries = 8, maxConcurrent = 2, maxQueued = 8, maxQueueWaitMs = 15000 } = {}) {
  const entries = new Map();
  const queue = [];
  let active = 0;

  const drain = () => {
    while (active < maxConcurrent && queue.length) {
      const job = queue.shift();
      clearTimeout(job.timer);
      active += 1;
      Promise.resolve().then(job.load).then(value => {
        entries.delete(job.key);
        entries.set(job.key, { value, expires: Date.now() + ttlMs });
        while ([...entries.values()].filter(entry => !entry.promise).length > maxEntries) {
          const oldestCompleted = [...entries].find(([, entry]) => !entry.promise)?.[0];
          if (!oldestCompleted) break;
          entries.delete(oldestCompleted);
        }
        job.resolve(value);
      }, error => {
        entries.delete(job.key);
        job.reject(error);
      }).finally(() => { active -= 1; drain(); });
    }
  };

  return (key, load) => {
    const cached = entries.get(key);
    if (cached?.promise) return cached.promise;
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.value);
    entries.delete(key);
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    entries.set(key, { promise });
    if (queue.length >= maxQueued) {
      const obsolete = queue.shift();
      clearTimeout(obsolete.timer);
      entries.delete(obsolete.key);
      obsolete.reject(new Error('Superseded public read'));
    }
    const job = { key, load, resolve, reject };
    job.timer = setTimeout(() => {
      const index = queue.indexOf(job);
      if (index < 0) return;
      queue.splice(index, 1);
      entries.delete(key);
      reject(new Error('Queued public read timed out'));
    }, maxQueueWaitMs);
    queue.push(job);
    drain();
    return promise;
  };
}
