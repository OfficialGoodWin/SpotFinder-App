/**
 * One-time migration: grant the `admin` custom claim to the existing
 * hardcoded superadmin account, so firestore.rules can stop trusting a
 * plain email-string comparison.
 *
 * HOW TO RUN (once):
 *   1. Deploy this alongside the rest of functions/ (it's exported from
 *      index.js — see the require() at the bottom of this file, or just
 *      add `exports.setAdminClaim = require('./setAdminClaim').setAdminClaim;`
 *      to index.js).
 *   2. Sign in to the app as superadmin@spotfinder.cz.
 *   3. Call the callable function once from the browser console:
 *        const fn = firebase.functions().httpsCallable('setAdminClaim');
 *        await fn({ targetEmail: 'superadmin@spotfinder.cz' });
 *   4. Sign out and back in (custom claims only apply to freshly-issued
 *      tokens) — `request.auth.token.admin` will now be true.
 *   5. Once confirmed working, remove the `|| authEmail() == '...'` fallback
 *      from `isSuperAdmin()` in firestore.rules.
 *
 * This function only ever lets an account that is ALREADY recognized as
 * admin (by the existing hardcoded-email check) grant the claim — it can't
 * be used by an arbitrary user to promote themselves.
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');

const HARDCODED_BOOTSTRAP_ADMIN = 'superadmin@spotfinder.cz';

exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  const callerEmail = context.auth?.token?.email;
  const callerIsBootstrapAdmin = callerEmail === HARDCODED_BOOTSTRAP_ADMIN;
  const callerAlreadyHasClaim = context.auth?.token?.admin === true;

  if (!context.auth || !(callerIsBootstrapAdmin || callerAlreadyHasClaim)) {
    throw new functions.https.HttpsError('permission-denied', 'Only an existing admin can grant admin access.');
  }

  const targetEmail = data?.targetEmail;
  if (!targetEmail) {
    throw new functions.https.HttpsError('invalid-argument', 'targetEmail is required.');
  }

  const user = await admin.auth().getUserByEmail(targetEmail);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });

  await admin.firestore().collection('admin_audit_log').add({
    action: 'grant_admin_claim',
    target_email: targetEmail,
    performed_by: callerEmail,
    performed_at: new Date().toISOString(),
  });

  return { success: true, uid: user.uid };
});
