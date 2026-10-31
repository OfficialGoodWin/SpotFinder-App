export function snapshotFeatureEnabled({ dev, mode, stage, emulatorOnly, flag }) {
  if (flag !== 'true') return false;
  if (dev) return stage === 'emulator' && emulatorOnly === 'true';
  return mode === 'snapshot-staging' && stage === 'staging';
}

export function originalMapSnapshotFeatureEnabled(options) {
  return options.originalFlag === 'true' && snapshotFeatureEnabled(options);
}
