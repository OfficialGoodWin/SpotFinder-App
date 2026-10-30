import test from 'node:test';
import assert from 'node:assert/strict';
import { reportPriorityCounts, flagPriorityCounts, sortForManualReview } from '../src/lib/manualReviewPriority.js';

test('three distinct open spot reporters are placed first for manual review', () => {
  const reports = [
    { id: 'newer', target_type: 'spot', target_id: 'B', reporter_uid: 'one', status: 'open' },
    ...['one', 'two', 'three'].map((uid, index) => ({ id: `a${index}`, target_type: 'spot', target_id: 'A', reporter_uid: uid, status: 'open' })),
    { id: 'duplicate', target_type: 'spot', target_id: 'A', reporter_uid: 'one', status: 'open' },
    { id: 'resolved', target_type: 'spot', target_id: 'B', reporter_uid: 'two', status: 'resolved' },
  ];
  const counts = reportPriorityCounts(reports);
  assert.equal(counts.get('A'), 3);
  assert.equal(counts.get('B'), 1);
  assert.equal(sortForManualReview(reports, counts, row => row.target_id)[0].target_id, 'A');
});

test('historical flags count case-insensitive distinct reporters', () => {
  const flags = ['ONE@example.test', 'one@example.test', 'two@example.test', 'three@example.test']
    .map(reporter_email => ({ spot_id: 'A', reporter_email, status: 'open' }));
  assert.equal(flagPriorityCounts(flags).get('A'), 3);
});
