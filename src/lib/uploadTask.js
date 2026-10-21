export function waitForUploadTask(task, { signal, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { task.cancel(); reject(new DOMException('Upload interrupted', 'AbortError')); return; }
    let finished = false;
    const finish = (callback, value) => {
      if (finished) return;
      finished = true;
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const abort = () => {
      task.cancel();
      finish(reject, new DOMException('Upload interrupted', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    task.on('state_changed', snapshot => {
      onProgress?.(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0);
    }, error => finish(reject, error), () => finish(resolve, task.snapshot));
  });
}
