// Keep confirmed uploads available for a retry when a sibling upload or the
// subsequent spot write fails. The caller retains this cache only while its
// contribution form is open.
export async function uploadSelectedPhotos(files, upload, cache = new Map()) {
  const results = await Promise.allSettled(files.map(async (file, index) => {
    if (cache.has(file)) return cache.get(file);
    const url = await upload(file, index);
    cache.set(file, url);
    return url;
  }));
  if (results.some(result => result.status === 'rejected')) {
    const reason = results.find(result => result.status === 'rejected')?.reason?.message || 'Check your connection and retry.';
    throw new Error(`One or more photos could not be uploaded. ${reason} Your changes are still here.`);
  }
  return results.map(result => result.value);
}
