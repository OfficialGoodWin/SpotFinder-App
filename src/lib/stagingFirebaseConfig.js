const REQUIRED = ['apiKey', 'authDomain', 'projectId', 'appId', 'messagingSenderId', 'storageBucket'];
export const emulatorFirebaseConfig = Object.freeze({
  apiKey: 'demo-key', authDomain: 'demo-spotfinder-local.firebaseapp.com',
  projectId: 'demo-spotfinder-local', appId: '1:123456789:web:demo',
  storageBucket: 'demo-spotfinder-local.appspot.com', messagingSenderId: '123456789',
});

export function selectBrowserFirebaseConfig(stage, production, staging) {
  if (stage === 'emulator') return emulatorFirebaseConfig;
  if (stage !== 'staging') return production;
  if (REQUIRED.some(key => typeof staging?.[key] !== 'string' || !staging[key].trim())) {
    throw new Error('Staging Firebase web configuration is incomplete.');
  }
  if (staging.projectId === production.projectId || staging.appId === production.appId
    || staging.apiKey === production.apiKey || staging.authDomain === production.authDomain
    || staging.storageBucket === production.storageBucket) {
    throw new Error('Staging Firebase configuration must use a separate project and web app.');
  }
  return staging;
}
