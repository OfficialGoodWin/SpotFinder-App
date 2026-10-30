import { processReport } from './reportPilot.js';
import turnstile from '../functions/turnstileSiteverify.js';
import { requireVercelAppCheck } from './appCheckGuard.js';

// The server switch remains off by default, including on preview deployments.
export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

export function createReportHandler({ loadAdmin = () => import('./_firebaseAdmin.js'), verifyChallenge = turnstile.verifyTurnstileToken } = {}) {
return async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  if (process.env.REPORT_API_ENABLED !== 'true' ||
      (process.env.VERCEL_ENV === 'production' && process.env.REPORT_API_PRODUCTION_APPROVED !== 'true')) {
    return res.status(503).json({ code: 'REPORT_API_DISABLED' });
  }
  // Vercel previews must never use the production Firebase project, even if
  // server credentials were accidentally copied into preview environment vars.
  if (process.env.VERCEL_ENV !== 'production' && process.env.FIREBASE_PROJECT_ID === 'spotfinderapp-cdc7b') {
    return res.status(503).json({ code: 'PREVIEW_PRODUCTION_PROJECT_BLOCKED' });
  }
  const allowedHostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || '')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!process.env.TURNSTILE_SECRET_KEY?.trim() || !allowedHostnames.length) {
    return res.status(503).json({ code: 'REPORT_API_NOT_CONFIGURED' });
  }
  try {
    const { adminDb, adminAuth, adminApp, adminAppCheck } = await loadAdmin();
    if (!await requireVercelAppCheck(req, res, { adminApp, adminAppCheck,
      required: true })) return;
    const reply = await processReport(req, {
      db: adminDb,
      verifyAuth: token => adminAuth.verifyIdToken(token, true),
      verifyChallenge,
      challengeSecret: process.env.TURNSTILE_SECRET_KEY,
      allowedHostnames,
    });
    for (const [key, value] of Object.entries(reply.headers)) res.setHeader(key, value);
    return res.status(reply.status).json(reply.body);
  } catch (error) {
    // Never return credentials, tokens, request bodies or Admin SDK errors.
    console.error('Report API failed', { type: error?.name || 'Error' });
    return res.status(503).json({ code: 'REPORT_SERVICE_UNAVAILABLE' });
  }
};
}

export default createReportHandler();
