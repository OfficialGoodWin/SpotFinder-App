import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { createBoundedPublicRead } from '../../src/lib/boundedPublicRead.js';
import { createPublicCoverageCache } from '../../src/lib/publicCoverageCache.js';
import { createInFlightRead } from '../../src/lib/inFlightRead.js';

const projectId = 'demo-spotfinder-consumption';
const hostPort = process.env.FIRESTORE_EMULATOR_HOST;
if (!hostPort || !/^127\.0\.0\.1:\d+$|^localhost:\d+$/.test(hostPort)) {
  throw new Error('Refusing to run without a loopback Firestore emulator.');
}
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId) {
  throw new Error('Refusing a non-demo Firebase project.');
}
const [host, portString] = hostPort.split(':');
const mode = process.argv[2];
if (!['baseline', 'optimized'].includes(mode)) throw new Error('Use baseline or optimized mode.');

const testEnv = await initializeTestEnvironment({ projectId, firestore: {
  host, port: Number(portString), rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
} });
const db = testEnv.unauthenticatedContext().firestore();
const ownerDb = testEnv.authenticatedContext('synthetic-owner', {
  email: 'synthetic@example.invalid', email_verified: true,
}).firestore();
const metrics = () => ({ calls: 0, queries: 0, docs: 0, duplicateIds: 0, bytes: 0, seen: new Set() });

async function seed(from, to) {
  await testEnv.withSecurityRulesDisabled(async context => {
    const adminDb = context.firestore();
    for (let start = from; start < to; start += 400) {
      const batch = adminDb.batch();
      for (let i = start; i < Math.min(to, start + 400); i++) {
        const row = {
          is_public: i % 10 !== 0, status: i % 10 === 1 ? 'pending_trust' : 'published',
          lat: i < 100 ? 50.01 + (i % 10) * 0.0002 : 50.1 + (i % 100) * 0.0002,
          lng: i < 100 ? 14.01 + Math.floor(i / 10) * 0.0002 : 14.1 + Math.floor((i - 100) / 100) * 0.0002,
          title: `Synthetic spot ${i}`, description: 'x'.repeat(1700),
          created_date: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(),
          created_by_uid: i % 10 === 0 ? 'synthetic-owner' : 'another-synthetic-owner',
          created_by: i % 10 === 0 ? 'synthetic@example.invalid' : 'other@example.invalid',
          image_urls: ['https://example.invalid/synthetic.jpg'],
        };
        batch.set(adminDb.collection('spots').doc(`synthetic-${String(i).padStart(5, '0')}`), row);
      }
      await batch.commit();
    }
  });
}

async function runJourney(size) {
  const m = metrics();
  const publicRead = createBoundedPublicRead({ ttlMs: 60000 });
  const coverage = mode === 'optimized' ? createPublicCoverageCache() : null;
  const detailRead = mode === 'optimized' ? createInFlightRead() : null;
  const query = async (q, key, usePublicCache = false, countCall = true) => {
    if (countCall) m.calls++;
    const load = async () => {
      m.queries++;
      const snap = await q.get();
      for (const doc of snap.docs || (snap.exists ? [snap] : [])) {
        m.docs++;
        if (m.seen.has(doc.id)) m.duplicateIds++;
        m.seen.add(doc.id);
        m.bytes += Buffer.byteLength(JSON.stringify({ id: doc.id, ...doc.data() }));
      }
      return snap;
    };
    return usePublicCache ? publicRead(key, load) : load();
  };
  const map = async (bounds) => {
    const covered = coverage?.lookup(bounds, 300);
    if (covered) { m.calls++; return covered; }
    const snap = await query(db.collection('spots').where('is_public', '==', true)
    .where('status', 'in', ['published', 'pending_trust'])
    .where('lat', '>=', bounds.south).where('lat', '<=', bounds.north)
    .where('lng', '>=', bounds.west).where('lng', '<=', bounds.east).limit(300),
    `map:${bounds.south}:${bounds.west}:${bounds.north}:${bounds.east}`, true);
    coverage?.remember(bounds, snap.docs.map(doc => ({ id: doc.id, ...doc.data() })), 300);
    return snap;
  };
  const nearBounds = { south: 50.005, west: 14.005, north: 50.025, east: 14.025 };
  const nearby = () => {
    const covered = coverage?.lookup(nearBounds, 250);
    if (covered) { m.calls++; return Promise.resolve(covered); }
    return query(db.collection('spots').where('is_public', '==', true)
    .where('status', 'in', ['published', 'pending_trust'])
    .where('lat', '>=', nearBounds.south).where('lat', '<=', nearBounds.north)
    .where('lng', '>=', nearBounds.west).where('lng', '<=', nearBounds.east)
    .orderBy('lat').orderBy('lng').limit(250), 'near:finite', true);
  };
  const discover = () => query(db.collection('spots').where('is_public', '==', true)
    .where('status', 'in', ['published', 'pending_trust'])
    .orderBy('created_date', 'desc').limit(25), 'discover:first', true);
  const detail = () => detailRead
    ? (m.calls++, detailRead('synthetic-00001', () => query(db.collection('spots').doc('synthetic-00001'), 'detail', false, false)))
    : query(db.collection('spots').doc('synthetic-00001'), 'detail');
  const profile = () => query(ownerDb.collection('spots').where('created_by_uid', '==', 'synthetic-owner').limit(100), 'profile:owner');
  const mapA = { south: 50, west: 14, north: 50.03, east: 14.03 };
  await Promise.all([map(mapA), map(mapA)]); // concurrent remount
  await map({ south: 50.005, west: 14.005, north: 50.025, east: 14.025 }); // contained movement
  await map({ south: 50.1, west: 14.1, north: 50.12, east: 14.12 }); // dense movement
  await map(mapA); // return navigation
  await nearby(); await nearby();
  await discover(); await discover();
  await Promise.all([detail(), detail()]);
  await profile(); await profile();
  const { seen, ...result } = m;
  return { size, mode, ...result, cacheHits: m.calls - m.queries,
    uniqueIds: seen.size, rssMiB: Math.round(process.memoryUsage().rss / 1048576) };
}

try {
  let prior = 0;
  for (const size of [100, 1000, 10000]) {
    await seed(prior, size);
    console.log(JSON.stringify(await runJourney(size)));
    prior = size;
  }
} finally {
  await testEnv.cleanup();
}
