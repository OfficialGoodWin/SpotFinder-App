import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import ignore from 'ignore';
import { validateSnapshotArtifacts } from '../scripts/public-spots/export.mjs';

const APPROVED_REVISION = 'b774fb3c76a166ed9433';
const candidate = new URL('../release-snapshot-candidate/spot-snapshots/', import.meta.url);

test('Vercel package includes the Vite build fixture but excludes tests', async () => {
  const rules = await readFile(new URL('../.vercelignore', import.meta.url), 'utf8');
  const filter = ignore().add(rules);
  const testFiles = await readdir(new URL('./', import.meta.url));
  const included = testFiles.filter(file => !filter.ignores(`tests/${file}`));

  assert.deepEqual(included, ['spot-page-fixtures.js']);
});

test('Vercel package includes exactly the approved public snapshot candidate', async () => {
  const rules = await readFile(new URL('../.vercelignore', import.meta.url), 'utf8');
  const filter = ignore().add(rules);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', candidate), 'utf8'));
  const provenance = JSON.parse(await readFile(new URL('../spot-snapshots.production-source.json', candidate), 'utf8'));
  const names = Object.values(manifest.regions).sort();
  const actual = (await readdir(new URL('v3/', candidate))).sort();
  const candidateRootFiles = (await readdir(new URL('../', candidate))).sort();
  const snapshotRootFiles = (await readdir(candidate)).sort();
  const files = new Map();
  const canonicalBytes = async url => Buffer.byteLength((await readFile(url, 'utf8')).replace(/\r\n/g, '\n'));
  let bytes = await canonicalBytes(new URL('manifest.json', candidate));
  for (const name of names) files.set(name, JSON.parse(await readFile(new URL(`v3/${name}`, candidate), 'utf8')));
  for (const name of names) bytes += await canonicalBytes(new URL(`v3/${name}`, candidate));

  assert.equal(manifest.format, 3);
  assert.equal(manifest.revision, APPROVED_REVISION);
  assert.equal(manifest.publishedAt, '2026-10-31T19:48:00.380Z');
  assert.equal(provenance.projectId, 'spotfinderapp-cdc7b');
  assert.equal(provenance.revision, APPROVED_REVISION);
  assert.equal(provenance.format, 3);
  assert.equal(provenance.included, [...files.values()].reduce((count, file) => count + file.spots.length, 0));
  assert.equal(provenance.artifactBytes, bytes);
  assert.ok(provenance.documentsRead <= 3000);
  assert.deepEqual(actual, names);
  assert.deepEqual(candidateRootFiles, ['spot-snapshots', 'spot-snapshots.production-source.json']);
  assert.deepEqual(snapshotRootFiles, ['manifest.json', 'v3']);
  assert.doesNotMatch(rules, /release-snapshot-candidate/);
  assert.equal(filter.ignores('release-snapshot-candidate/spot-snapshots.production-source.json'), false);
  assert.equal(filter.ignores('release-snapshot-candidate/spot-snapshots/manifest.json'), false);
  for (const name of names) assert.equal(filter.ignores(`release-snapshot-candidate/spot-snapshots/v3/${name}`), false);

  validateSnapshotArtifacts({ manifest, files });
  const raw = JSON.stringify([...files.values()]);
  assert.doesNotMatch(raw, /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  assert.doesNotMatch(raw, /"(?:created_by_uid|owner_uid|description|image_urls|moderation_notes|password|token)"/i);
  assert.doesNotMatch(raw, /(?:smoke|synthetic)-|cdn_release_test_/i);

  const missing = new Map(files);
  missing.delete(names[0]);
  assert.throws(() => validateSnapshotArtifacts({ manifest, files: missing }));
  const corrupt = new Map(files);
  corrupt.set(names[0], { ...files.get(names[0]), spots: [] });
  assert.throws(() => validateSnapshotArtifacts({ manifest, files: corrupt }));
  assert.throws(() => validateSnapshotArtifacts({ manifest: { ...manifest, revision: '0'.repeat(20) }, files }));
});

test('Vercel package excludes local diagnostics and generated reports', async () => {
  const rules = await readFile(new URL('../.vercelignore', import.meta.url), 'utf8');
  const filter = ignore().add(rules);
  for (const path of [
    '.tmp-read-revocation.js',
    '.tmp-watch-revocation.js',
    'reports/i18n-coverage.md',
    'reports/i18n-issues.json',
    'docs/article-template.json',
    'docs/cdn-public-spot-map.md',
    '.github/workflows/build-ambient-tiles.yml',
    '.github/workflows/staging-public-spot-snapshot.yml',
  ]) assert.equal(filter.ignores(path), true, path);
  for (const path of [
    'api/spot-snapshot-revocations.js',
    'src/new/publicSpotRevocationListener.js',
    'src/new/publicSpotRevocationState.js',
    'scripts/public-spots/build-vercel.mjs',
    'vercel.json',
    'vite.config.js',
  ]) assert.equal(filter.ignores(path), false, path);
});
