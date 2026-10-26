import {
  EmailAuthProvider, GoogleAuthProvider, linkWithCredential, reauthenticateWithCredential,
  reauthenticateWithPopup, reload, unlink, verifyBeforeUpdateEmail,
} from 'firebase/auth';
import { getFirebaseServices, isRestrictedBrowser } from '@/api/firebaseClient';

export function currentAccount() {
  const user = getFirebaseServices()?.auth?.currentUser;
  if (!user || user.isAnonymous) throw Object.assign(new Error('A signed-in account is required.'), { code: 'auth/no-current-user' });
  return user;
}

export function linkedProviders(user = currentAccount()) {
  return new Set(user.providerData.map(provider => provider.providerId));
}

async function reauthenticateWithGoogle(user) {
  if (isRestrictedBrowser()) throw Object.assign(new Error('Open this page in a full browser for Google reauthentication.'), { code: 'auth/restricted-browser' });
  const result = await reauthenticateWithPopup(user, new GoogleAuthProvider());
  if (result.user.uid !== user.uid) throw Object.assign(new Error('The Google account did not match this SpotFinder account.'), { code: 'auth/user-mismatch' });
}

export async function reauthenticateAccount(method, password = '') {
  const user = currentAccount();
  if (method === 'google' && linkedProviders(user).has('google.com')) return reauthenticateWithGoogle(user);
  if (method === 'password' && linkedProviders(user).has('password')) return verifyPasswordForAccount(user, password);
  throw Object.assign(new Error('Choose a linked sign-in method.'), { code: 'auth/provider-not-linked' });
}

export async function verifyPasswordForAccount(user, password) {
  if (!password) throw Object.assign(new Error('Current password is required.'), { code: 'auth/missing-password' });
  if (!user.email) throw Object.assign(new Error('This account has no email address.'), { code: 'auth/missing-email' });
  const result = await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  if (result.user.uid !== user.uid) throw Object.assign(new Error('The password did not match this account.'), { code: 'auth/user-mismatch' });
}

export async function linkPasswordToCurrentAccount(password) {
  const user = currentAccount();
  if (!user.email || password.length < 8) throw Object.assign(new Error('A valid account email and an 8-character password are required.'), { code: 'auth/invalid-password' });
  if (linkedProviders(user).has('password')) throw Object.assign(new Error('Password sign-in is already connected.'), { code: 'auth/provider-already-linked' });
  if (linkedProviders(user).has('google.com')) await reauthenticateWithGoogle(user);
  const uid = user.uid;
  const credential = EmailAuthProvider.credential(user.email, password);
  const result = await linkWithCredential(user, credential);
  if (result.user.uid !== uid) throw Object.assign(new Error('Account identity changed during linking.'), { code: 'auth/user-mismatch' });
  await reload(user);
  if (!linkedProviders(user).has('password')) throw Object.assign(new Error('Password provider could not be confirmed.'), { code: 'auth/provider-not-confirmed' });
  try {
    await verifyPasswordForAccount(user, password);
    return { linked: true, verified: true };
  } catch (error) {
    // Linking has already succeeded. Leave Google attached until password sign-in
    // can be verified on this same UID, including any required MFA challenge.
    return { linked: true, verified: false, verificationError: error?.code || 'unknown' };
  }
}

export async function unlinkGoogleAfterPasswordVerification(password) {
  const user = currentAccount();
  const providers = linkedProviders(user);
  if (!providers.has('google.com') || !providers.has('password')) throw Object.assign(new Error('Both sign-in methods must be linked.'), { code: 'auth/provider-not-linked' });
  await verifyPasswordForAccount(user, password);
  const uid = user.uid;
  const result = await unlink(user, 'google.com');
  if (result.uid !== uid) throw Object.assign(new Error('Account identity changed during unlinking.'), { code: 'auth/user-mismatch' });
  await reload(user);
  return user;
}

export async function requestVerifiedEmailChange(nextEmail, { method, password, language }) {
  const user = currentAccount();
  const email = String(nextEmail || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.toLowerCase() === user.email?.toLowerCase()) {
    throw Object.assign(new Error('Enter a different, valid email address.'), { code: 'auth/invalid-email' });
  }
  if (method === 'google' && linkedProviders(user).has('google.com')) await reauthenticateWithGoogle(user);
  else if (method === 'password' && linkedProviders(user).has('password')) await verifyPasswordForAccount(user, password);
  else throw Object.assign(new Error('Choose a linked sign-in method.'), { code: 'auth/provider-not-linked' });
  const { auth } = getFirebaseServices();
  auth.languageCode = String(language || 'en').split('-')[0];
  await verifyBeforeUpdateEmail(user, email);
  return email;
}
