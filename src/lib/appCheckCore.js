export function validAppCheckConfig(siteKey, providerName) {
  return typeof siteKey === 'string' && siteKey.trim().length > 0 && (!providerName || providerName === 'enterprise');
}

// Only call this in an isolated staging build. The observer receives token
// objects, but diagnostics deliberately report status without their contents.
export function observeAppCheckStatus(appCheck, subscribe, log) {
  return subscribe(appCheck,
    result => log(result?.token ? 'ready' : 'unavailable'),
    () => log('failed'));
}

export async function readAppCheckToken(appCheck, getToken) {
  if (!appCheck) throw new Error('App verification is unavailable. Please reload and try again.');
  try {
    const result = await getToken(appCheck, false);
    if (!result?.token) throw new Error('empty token');
    return result.token;
  } catch {
    throw new Error('App verification failed. Please reload and try again.');
  }
}
