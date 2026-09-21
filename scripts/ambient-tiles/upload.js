#!/usr/bin/env node
// Uploads the built PMTiles file to Vercel Blob (which supports HTTP range
// requests — required for PMTiles — and files up to 5TB). Run after build.sh.
//
// Requires BLOB_READ_WRITE_TOKEN (Vercel dashboard → Storage → your Blob
// store → ".env.local" tab, or `vercel env pull` if the store is linked to
// this project already).
//
// Usage: BLOB_READ_WRITE_TOKEN=... node upload.js ambient-poi.pmtiles

import { put } from '@vercel/blob';
import { readFile } from 'node:fs/promises';

const file = process.argv[2] || 'ambient-poi.pmtiles';

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is not set. See the comment at the top of this file.');
    process.exit(1);
  }
  const data = await readFile(file);
  console.log(`Uploading ${file} (${(data.length / 1024 / 1024).toFixed(1)} MB) to Vercel Blob...`);

  const blob = await put(file, data, {
    access: 'public',
    addRandomSuffix: false, // stable URL across rebuilds, so VITE_AMBIENT_TILES_URL never has to change
    multipart: true,        // recommended by Vercel for anything over ~100MB
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  console.log(`\nUploaded: ${blob.url}`);
  console.log('\nNext steps (one-time, if not done already):');
  console.log(`  1. Set VITE_AMBIENT_TILES_URL=${blob.url} in Vercel's project env vars.`);
  console.log(`  2. Add https://${new URL(blob.url).host} to connect-src in index.html's CSP.`);
}

main().catch(e => { console.error(e); process.exit(1); });
