export function createInFlightRead() {
  const pending = new Map();
  const read = (key, load) => {
    if (pending.has(key)) return pending.get(key);
    const promise = Promise.resolve().then(load).finally(() => {
      if (pending.get(key) === promise) pending.delete(key);
    });
    pending.set(key, promise);
    return promise;
  };
  read.clear = () => pending.clear();
  return read;
}
