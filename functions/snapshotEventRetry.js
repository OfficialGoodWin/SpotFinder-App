const crypto = require('node:crypto');

async function processSnapshotEvent(db, kind, eventId, operation) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try { return await operation(); }
    catch (error) { lastError = error; }
  }
  const eventHash = crypto.createHash('sha256').update(String(eventId || 'unknown')).digest('hex').slice(0, 32);
  try {
    await db.collection('spot_snapshot_failures').doc(eventHash).set({ kind, attempts: 2,
      last_failure_at: new Date().toISOString(), resolved: false }, { merge: true });
  } catch { /* Health reconciliation catches durable gaps when this write fails too. */ }
  console.error('Snapshot journal event failed', { kind, eventHash, code: String(lastError?.code || 'unknown').slice(0, 40) });
  throw lastError;
}

module.exports = { processSnapshotEvent };
