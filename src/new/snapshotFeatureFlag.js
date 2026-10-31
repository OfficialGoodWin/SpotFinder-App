export function snapshotFeatureEnabled({ dev, mode, stage, emulatorOnly, flag, productionRelease }) {
  if (flag !== 'true') return false;
  if (dev) return stage === 'emulator' && emulatorOnly === 'true';
  return (mode === 'snapshot-staging' && stage === 'staging')
    || (mode === 'snapshot-production' && stage === 'production' && productionRelease === 'true');
}

export function originalMapSnapshotFeatureEnabled(options) {
  return options.originalFlag === 'true' && snapshotFeatureEnabled(options);
}
