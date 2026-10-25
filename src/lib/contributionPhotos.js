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
    const index = results.findIndex(result => result.status === 'rejected');
    const cause = results[index].reason;
    const error = new Error(`Fotografii ${index + 1} (${files[index]?.name || 'bez názvu'}) se nepodařilo nahrát. Zkontrolujte připojení a zkuste to znovu.`, { cause });
    error.imageIndex = index;
    throw error;
  }
  return results.map(result => result.value);
}
