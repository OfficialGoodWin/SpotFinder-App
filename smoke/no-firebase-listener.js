// The shared reader's default app listener is unreachable in this smoke page.
// Replace its import so no Firebase module enters the isolated bundle.
export function getPublicSpotRevocationListener() {
  throw new Error('Application listener is disabled in synthetic smoke mode');
}
