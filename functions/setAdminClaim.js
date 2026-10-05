/**
 * Grant the `admin` custom claim to an account. The caller must already
 * have a signed `admin: true` claim.
 *
 * HOW TO RUN (once):
 *   1. Deploy this alongside the rest of functions/ (it's exported from
 *      index.js — see the require() at the bottom of this file, or just
 *      add `exports.setAdminClaim = require('./setAdminClaim').setAdminClaim;`
 *      to index.js).
 *   2. Sign in with an existing claimed admin account.
 *   3. Call the callable function:
 *        const fn = firebase.functions().httpsCallable('setAdminClaim');
 *        await fn({ targetEmail: 'new-admin@example.com' });
 *   4. The target signs out and back in so its refreshed token includes the claim.
 *
 * This function only lets an already-claimed admin grant the claim.
 */
const functions = require('firebase-functions/v1');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  const callerEmail = context.auth?.token?.email;
  const callerAlreadyHasClaim = context.auth?.token?.admin === true;

  if (!context.auth || !callerAlreadyHasClaim) {
    throw new functions.https.HttpsError('permission-denied', 'Only an existing admin can grant admin access.');
  }

  const targetEmail = data?.targetEmail?.trim()?.toLowerCase();
  if (!targetEmail) {
    throw new functions.https.HttpsError('invalid-argument', 'targetEmail is required.');
  }

  const user = await getAuth().getUserByEmail(targetEmail);
  await getAuth().setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    admin: true,
  });

  await getFirestore().collection('admin_audit_log').add({
    action: 'grant_admin_claim',
    target_email: targetEmail,
    performed_by: callerEmail,
    performed_at: new Date().toISOString(),
  });

  return { success: true, uid: user.uid };
});
