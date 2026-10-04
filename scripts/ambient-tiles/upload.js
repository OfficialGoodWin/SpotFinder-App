#!/usr/bin/env node
import { put } from '@vercel/blob';
import { readFile } from 'node:fs/promises';

const file = process.argv[2] || 'ambient-poi.pmtiles';

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is not set.');
    process.exit(1);
  }
  const data = await readFile(file);
  console.log(`Uploading ${file} (${(data.length / 1024 / 1024).toFixed(1)} MB)...`);
  const blob = await put('spotfinder/ambient-poi.pmtiles', data, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/vnd.pmtiles',
    cacheControlMaxAge: 86400,
    multipart: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  console.log(`Uploaded: ${blob.url}`);
  console.log(`Set this in Vercel: VITE_AMBIENT_TILES_URL=${blob.url}`);
}
main().catch(err => { console.error(err); process.exit(1); });
