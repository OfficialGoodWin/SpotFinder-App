/**
 * One-time migration: backfills existing `spots` documents with the fields
 * introduced by the moderation/duplicate-detection update:
 *   status, geohash, quality_score, upvote_count, downvote_count, flag_count
 *
 * Run once, locally, with Node. Safe to re-run — skips docs that already
 * have a `status` field.
 *
 * SETUP:
 * 1. npm install firebase-admin
 * 2. Get a service account key:
 *    Firebase Console → Project Settings → Service Accounts → Generate new private key
 *    Save it as serviceAccountKey.json next to this script.
 *    (Do NOT commit this file — add it to .gitignore.)
 * 3. node migrate-spots.js
 */

import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ── geohash encode (same algorithm as src/utils/geohash.js) ──────────────────
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
function encodeGeohash(lat, lng, precision = 9) {
  let latRange = [-90, 90];
  let lngRange = [-180, 180];
  let hash = '';
  let bit = 0;
  let ch = 0;
  let evenBit = true;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) { ch |= (1 << (4 - bit)); lngRange[0] = mid; } else { lngRange[1] = mid; }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) { ch |= (1 << (4 - bit)); latRange[0] = mid; } else { latRange[1] = mid; }
    }
    evenBit = !evenBit;
    if (bit < 4) { bit++; } else { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

async function migrate() {
  const snapshot = await db.collection('spots').get();
  console.log(`Found ${snapshot.size} spots.`);

  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let opsInBatch = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    if (data.status) {
      skipped++;
      continue;
    }

    const lat = data.lat;
    const lng = data.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      console.warn(`Skipping ${docSnap.id} — missing/invalid lat/lng`);
      skipped++;
      continue;
    }

    batch.update(docSnap.ref, {
      status: 'published',       // existing spots are treated as already-trusted
      geohash: encodeGeohash(lat, lng, 9),
      quality_score: data.quality_score ?? 0,
      upvote_count: data.upvote_count ?? 0,
      downvote_count: data.downvote_count ?? 0,
      flag_count: data.flag_count ?? 0,
    });
    updated++;
    opsInBatch++;

    // Firestore batches cap at 500 writes
    if (opsInBatch === 450) {
      await batch.commit();
      console.log(`Committed batch of ${opsInBatch}...`);
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  console.log(`Done. Updated: ${updated}, skipped (already migrated or bad data): ${skipped}`);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
