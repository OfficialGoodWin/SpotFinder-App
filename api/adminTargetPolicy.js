const PRODUCTION_PROJECT = 'spotfinderapp-cdc7b';

export function assertSafeAdminTarget({ deployment, projectId, clientEmail, stagingProjectId }) {
  if (deployment === 'production') return;
  if (!projectId || projectId === PRODUCTION_PROJECT) {
    throw new Error('Nonproduction Admin SDK cannot use the production Firebase project.');
  }
  if (deployment === 'preview' && projectId !== stagingProjectId) {
    throw new Error('Preview Admin SDK project must match the staging web project.');
  }
  if (!clientEmail?.endsWith(`@${projectId}.iam.gserviceaccount.com`)) {
    throw new Error('Nonproduction Admin SDK credentials must belong to the isolated project.');
  }
}
