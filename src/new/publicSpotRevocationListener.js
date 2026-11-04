import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseServices } from '../api/firebaseClient.js';
import { createPublicSpotRevocationState } from './publicSpotRevocationState.js';
import { loadPublicSpotRevocations } from './publicSpotRevocationHttpClient.js';

let singleton;
let subscribers = 0;
let listenerSequence = 0;
const offline = () => { listenerSequence += 1; singleton?.invalidate(); };
const online = () => singleton?.restart();
const foreground = () => {
  if (document.visibilityState === 'visible') singleton?.restart();
};
export function getPublicSpotRevocationListener() {
  if (!singleton) singleton = createPublicSpotRevocationState({ listen: (accept, fail) => {
    const services = getFirebaseServices();
    if (!services?.db) throw new Error('Staging Firestore unavailable');
    const unsubscribe = onSnapshot(doc(services.db, 'spot_snapshot_revocation_feed', 'current'),
      { includeMetadataChanges: true }, snapshot => {
        const sequence = ++listenerSequence;
        if (!snapshot.exists()) {
          accept({ exists: false, fromCache: snapshot.metadata.fromCache });
          return;
        }
        if (snapshot.metadata.fromCache) { singleton?.hold(); return; }
        // Hide spots while validating the complete public feed. The listener
        // provides the live change signal; there is no HTTP polling timer.
        singleton?.hold();
        loadPublicSpotRevocations(snapshot.data()).then(data => {
          if (sequence === listenerSequence) accept({ exists: true, fromCache: false, data });
        }).catch(error => { if (sequence === listenerSequence) fail(error); });
      }, error => { listenerSequence += 1; fail(error); });
    return () => { listenerSequence += 1; unsubscribe(); };
  } });
  return singleton;
}

export function subscribePublicSpotRevocations(callback) {
  const source = getPublicSpotRevocationListener();
  const unsubscribe = source.subscribe(callback);
  subscribers += 1;
  if (subscribers === 1) {
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', foreground);
  }
  return () => {
    unsubscribe();
    subscribers -= 1;
    if (subscribers === 0) {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', foreground);
      source.stop();
    }
  };
}
