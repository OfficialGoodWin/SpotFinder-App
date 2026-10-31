async page => page.evaluate(async () => {
  const id = 'cdn_release_test_1793476772427_1f063fc5';
  const base = 'https://www.gstatic.com/firebasejs/12.19.0/';
  const [{ initializeApp }, { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken },
    { getFirestore, doc, onSnapshot }] = await Promise.all([
    import(base + 'firebase-app.js'), import(base + 'firebase-app-check.js'),
    import(base + 'firebase-firestore.js')]);
  const app = initializeApp({ projectId: 'spotfinderapp-cdc7b',
    apiKey: 'AIzaSyCJfu6SSuKJoDtLSJvNz491a8YtWznCDMk',
    appId: '1:179466659021:web:f93b90b96948a264d23584' }, 'cdn-revocation-watch');
  const check = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider('6LfJm6ktAAAAAHkr3xV2vBHvezh9nZ5iiSF14ghP'),
    isTokenAutoRefreshEnabled: false });
  await getToken(check, false);
  window.__cdnTest = { id, initial: false, revoked: false, observedAt: null, error: null };
  const db = getFirestore(app);
  const unsubscribe = onSnapshot(doc(db, 'spot_snapshot_revocation_feed', 'current'),
    { includeMetadataChanges: true }, snapshot => {
      if (snapshot.metadata.fromCache || !snapshot.exists()) return;
      window.__cdnTest.initial = true;
      if (snapshot.data()?.revoked?.includes(id)) {
        window.__cdnTest.revoked = true;
        window.__cdnTest.observedAt = Date.now();
      }
    }, error => { window.__cdnTest.error = error.code || String(error); });
  window.__cdnTestStop = unsubscribe;
  for (let i = 0; i < 20 && !window.__cdnTest.initial && !window.__cdnTest.error; i += 1)
    await new Promise(resolve => setTimeout(resolve, 250));
  return { initialServerConfirmed: window.__cdnTest.initial,
    revokedBeforeHide: window.__cdnTest.revoked, error: window.__cdnTest.error };
})
