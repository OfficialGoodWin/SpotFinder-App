// Usage units only. One continuously active hour per tab, one synthetic
// 250k-spot cold/pan/zoom/return journey, two feed updates, no reconnects.
const visitors = [10, 100, 1000, 10000];
const feedBytes = Buffer.byteLength(JSON.stringify({ format: 1,
  revoked: Array.from({ length: 100 }, (_, i) => `synthetic-${String(i).padStart(12, '0')}`) }));
const journey = { originalFirestoreReturnedDocuments: 604,
  snapshotHttpRequests: 6, snapshotRawJsonBytes: 2698737,
  snapshotLocalGzipBytes: 95043 };
const updatesPerHour = 2;
const listenerReadsPerTab = 1 + updatesPerHour;
for (const tabs of visitors) {
  console.log(JSON.stringify({ continuouslyActiveTabs: tabs, hours: 1,
    assumptions: { updatesPerHour, reconnectsPerTab: 0, viewportJourneysPerTab: 1,
      tombstones: 100, feedBytes, simulatedNotBilled: true },
    phase3Polling: { firestoreReads: tabs * 240, functionInvocations: tabs * 240,
      revocationHttpRequests: tabs * 240, estimatedFeedPayloadBytes: tabs * 240 * feedBytes,
      snapshotHttpRequests: tabs * journey.snapshotHttpRequests,
      snapshotRawJsonBytes: tabs * journey.snapshotRawJsonBytes },
    phase4Listener: { firestoreReads: tabs * listenerReadsPerTab, functionInvocations: 0,
      revocationHttpRequests: 0, estimatedFeedPayloadBytes: tabs * listenerReadsPerTab * feedBytes,
      snapshotHttpRequests: tabs * journey.snapshotHttpRequests,
      snapshotRawJsonBytes: tabs * journey.snapshotRawJsonBytes },
    originalMapJourney: { firestoreReturnedDocuments: tabs * journey.originalFirestoreReturnedDocuments,
      viewportQueries: tabs * 3 },
    publicationWritesFor100Changes: { journalAcknowledgementsAtMost: 100, checkpoint: 1,
      candidateBuildWrites: 0 },
    publisherReadsFor100Changes: { journalResultsAtMost: 101, feedDocuments: 1,
      currentSpotDocumentsAtMost: 100, moderationDocumentsAtMost: 10200 },
    journalGrowth: 'one current document per changed spot; failure records require manual resolution',
    revocationGrowth: 'one tombstone document and one ID in the single feed per revoked spot' }));
}
