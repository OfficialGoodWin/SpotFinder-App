export function visiblePhotoIndex(photos, selected, failedUrls) {
  if (photos[selected] && !failedUrls.has(photos[selected].url)) return selected;
  return photos.findIndex(photo => !failedUrls.has(photo.url));
}

export function nextPhotoIndex(photos, selected, failedUrls, direction) {
  if (!photos.length) return -1;
  const start = visiblePhotoIndex(photos, selected, failedUrls);
  if (start < 0) return -1;
  for (let step = 1; step <= photos.length; step += 1) {
    const index = (start + direction * step + photos.length * 2) % photos.length;
    if (!failedUrls.has(photos[index].url)) return index;
  }
  return start;
}
