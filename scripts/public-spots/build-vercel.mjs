import { spawnSync } from 'node:child_process';

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}

const approved = process.env.SPOTFINDER_SNAPSHOT_PREVIEW_APPROVED === 'true';
if (approved) {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VITE_SPOTFINDER_STAGE !== 'staging'
    || process.env.VITE_PUBLIC_SPOT_SNAPSHOTS !== 'true'
    || !process.env.SPOTFINDER_SNAPSHOT_CANDIDATE_DIRECTORY)
    throw new Error('Snapshot Preview build requires explicit preview target, flag and candidate');
  run(['scripts/news/prepare.mjs']);
  run(['node_modules/vite/bin/vite.js', 'build', '--mode', 'snapshot-staging']);
  run(['scripts/news/prerender.mjs']);
} else {
  if (process.env.VITE_PUBLIC_SPOT_SNAPSHOTS === 'true'
    || process.env.VITE_ORIGINAL_MAP_SNAPSHOTS === 'true')
    throw new Error('Snapshot feature flag requires approved Preview build');
  run(['scripts/news/prepare.mjs']);
  run(['node_modules/vite/bin/vite.js', 'build']);
  run(['scripts/news/prerender.mjs']);
}
