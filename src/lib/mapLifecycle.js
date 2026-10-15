/** Register one named MapLibre-style event handler without stacking duplicates. */
export function registerSingleMapListener(map, eventName, handler) {
  if (!map?.on || !map?.off || typeof handler !== 'function') return () => {};
  map.off(eventName, handler);
  map.on(eventName, handler);
  return () => map.off(eventName, handler);
}
