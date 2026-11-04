/**
 * Migrate the admin claim to the verified Google account with TOTP enrolled.
 *
 * The existing claimed admin calls this once after the target has linked
 * Google, verified email, and enrolled TOTP. The target then signs in again.
 * Roll out the 30-minute server and rules gate only after this migration.
 */
const functions = require('firebase-functions/v1');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

exports.setAdminClaim = functions.runWith({ enforceAppCheck: false }).https.onCall(async (data, context) => {
  const callerEmail = context.auth?.token?.email;
  const callerAlreadyHasClaim = context.auth?.token?.admin === true;

  if (!context.auth || !callerAlreadyHasClaim) {
    throw new functions.https.HttpsError('permission-denied', 'Only an existing admin can grant admin access.');
  }

  const targetEmail = data?.targetEmail?.trim()?.toLowerCase();
  if (targetEmail !== 'redm3467@gmail.com') throw new functions.https.HttpsError('invalid-argument', 'Target must be the designated admin account.');

  const auth = getAuth();
  const [user, caller] = await Promise.all([auth.getUserByEmail(targetEmail), auth.getUser(context.auth.uid)]);
  if (user.uid === caller.uid || !user.emailVerified
    || !user.providerData.some(provider => provider.providerId === 'google.com')
    || !user.multiFactor?.enrolledFactors?.some(factor => factor.factorId === 'totp')) {
    throw new functions.https.HttpsError('failed-precondition', 'Target must be a separate verified Google account with TOTP enrolled.');
  }
  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    admin: true,
  });
  await auth.setCustomUserClaims(caller.uid, { ...(caller.customClaims || {}), admin: false });
  await auth.revokeRefreshTokens(caller.uid);

  await getFirestore().collection('admin_audit_log').add({
    action: 'migrate_admin_claim',
    target_email: targetEmail,
    performed_by: callerEmail,
    previous_admin_uid: caller.uid,
    performed_at: new Date().toISOString(),
  });

  return { success: true, uid: user.uid };
});
