/**
 * Shared Firebase Admin SDK bootstrap for the Vercel /api serverless
 * functions. This is server-only code (never bundled into the client by
 * Vite, since Vite only bundles src/) and is the ONLY correct way for these
 * endpoints to read/write Firestore — the previous implementation used the
 * *client* SDK (`src/api/firebaseClient.js`) from a serverless function,
 * which cannot authenticate as any user and was silently blocked by
 * Firestore Security Rules (or, if rules were ever loosened to make it
 * "work", would have meant the webhook route was an open write to anyone's
 * user document). See SECURITY_REVIEW.md §3/§11.
 *
 * Required environment variables (Vercel dashboard → Settings → Environment
 * Variables), taken from a Firebase service account JSON:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (paste with literal \n escaped, see below)
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function initAdmin() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel env vars store newlines as literal "\n" — convert back.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin credentials are not configured. Set FIREBASE_PROJECT_ID, ' +
      'FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in the Vercel environment.'
    );
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const app = initAdmin();
export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);

/**
 * Verify a Firebase ID token sent by the client (Authorization: Bearer <token>)
 * and return the decoded token, or null if missing/invalid.
 */
export async function verifyRequestAuth(request) {
  const authHeader = request.headers.get
    ? request.headers.get('authorization')
    : request.headers?.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}
