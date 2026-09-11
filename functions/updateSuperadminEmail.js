/**
 * One-time migration: replace the superadmin account's placeholder email
 * (superadmin@spotfinder.cz — not a real inbox, so it can never click a
 * verification link) with a real email YOU control, and mark it verified
 * directly via the Admin SDK. This is what unblocks MFA enrollment, which
 * Firebase refuses for unverified accounts.
 *
 * HOW TO RUN (once):
 *   1. Add to functions/index.js:
 *        exports.updateSuperadminEmail = require('./updateSuperadminEmail').updateSuperadminEmail;
 *      then `firebase deploy --only functions`.
 *   2. Sign in to the app as superadmin@spotfinder.cz (the old placeholder).
 *   3. Call it once from the browser console:
 *        const fn = firebase.functions().httpsCallable('updateSuperadminEmail');
 *        await fn({ newEmail: 'you@yourrealdomain.com' });
 *   4. Sign out and back in using the NEW email + same password.
 *   5. IMPORTANT: firestore.rules and the client-side isSuperAdmin checks
 *      still hardcode 'superadmin@spotfinder.cz'. Either:
 *        (a) run setAdminClaim.js first (grants the `admin` custom claim,
 *            which doesn't care about email at all — recommended), or
 *        (b) find/replace the hardcoded email string everywhere it appears
 *            with your new real email.
 *      Do (a). It's strictly better and you were already planning to do it.
 *   6. Delete/disable this function once done — it's a one-time tool, not
 *      something that should stay callable forever.
 */
const functions = require('firebase-functions/v1');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const HARDCODED_BOOTSTRAP_ADMIN = 'superadmin@spotfinder.cz';

exports.updateSuperadminEmail = functions.https.onCall(async (data, context) => {
  const callerEmail = context.auth?.token?.email;
  const callerIsBootstrapAdmin = callerEmail === HARDCODED_BOOTSTRAP_ADMIN;
  const callerAlreadyHasClaim = context.auth?.token?.admin === true;

  if (!context.auth || !(callerIsBootstrapAdmin || callerAlreadyHasClaim)) {
    throw new functions.https.HttpsError('permission-denied', 'Only the existing superadmin can do this.');
  }

  const newEmail = data?.newEmail;
  if (!newEmail || !newEmail.includes('@')) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid newEmail is required.');
  }

  const user = await getAuth().getUserByEmail(HARDCODED_BOOTSTRAP_ADMIN);
  await getAuth().updateUser(user.uid, { email: newEmail, emailVerified: true });

  await getFirestore().collection('admin_audit_log').add({
    action: 'update_superadmin_email',
    old_email: HARDCODED_BOOTSTRAP_ADMIN,
    new_email: newEmail,
    performed_at: new Date().toISOString(),
  });

  return { success: true, uid: user.uid, newEmail };
});
