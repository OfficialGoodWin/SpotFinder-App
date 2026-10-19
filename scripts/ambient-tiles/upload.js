#!/usr/bin/env node
import { put } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const file = process.argv[2] || 'ambient-poi.candidate.pmtiles';

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is not set.');
    process.exit(1);
  }
  const data = await readFile(file);
  const digest = createHash('sha256').update(data).digest('hex');
  const pathname = `spotfinder/ambient-poi-candidates/${digest}.pmtiles`;
  console.log(`Uploading ${file} (${(data.length / 1024 / 1024).toFixed(1)} MB)...`);
  const blob = await put(pathname, data, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: 'application/vnd.pmtiles',
    cacheControlMaxAge: 86400,
    multipart: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  console.log(`Uploaded: ${blob.url}`);
  console.log(`SHA-256: ${digest}`);
  console.log('Candidate only. After review, set VITE_AMBIENT_TILES_URL to this URL and redeploy; retain the old URL for rollback.');
}
main().catch(err => { console.error(err); process.exit(1); });
