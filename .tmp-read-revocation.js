async page => page.evaluate(() => ({ initialServerConfirmed: window.__cdnTest?.initial,
  revoked: window.__cdnTest?.revoked, observedAt: window.__cdnTest?.observedAt,
  error: window.__cdnTest?.error }))
