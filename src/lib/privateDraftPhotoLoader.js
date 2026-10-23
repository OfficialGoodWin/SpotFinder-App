// Share only in-flight downloads. A later explicit retry must make a new request.
export function createPrivateDraftPhotoLoader(download) {
  const pending = new Map();

  return (user, photoRef) => {
    const path = String(photoRef?.path || '');
    if (!user || user.isAnonymous || !path.startsWith(`drafts/${user.uid}/`)) {
      return Promise.reject(new Error('This private draft photo is not available to the signed-in account.'));
    }

    const key = `${user.uid}:${path}`;
    if (pending.has(key)) return pending.get(key);

    const request = (async () => {
      try {
        return await download(path);
      } catch (error) {
        // A stale token can cause an auth failure. Missing objects, CORS, and
        // network failures cannot be fixed by repeating the same download.
        if (error?.code !== 'storage/unauthenticated') throw error;
        await user.getIdToken(true);
        return download(path);
      }
    })();
    pending.set(key, request);
    void request.finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    }).catch(() => {});
    return request;
  };
}

export function draftPhotoLoadMessage(error, offline = false) {
  const code = String(error?.code || '');
  if (code === 'storage/object-not-found') return 'A saved draft photo is missing. Remove it or upload it again.';
  if (code === 'storage/unauthorized') return 'Your account does not have permission to read this private draft photo.';
  if (code === 'storage/unauthenticated') return 'Your session cannot access this private photo. Sign in again and retry.';
  if (offline) return 'This draft photo is unavailable offline.';
  return 'The private draft photo could not be downloaded. Check your connection and try again. If other pages work, the Storage bucket may need CORS access for this site.';
}
