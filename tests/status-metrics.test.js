import test from 'node:test';
import assert from 'node:assert/strict';
import { reportedUptimePercent } from '../src/lib/statusMetrics.js';

test('status uptime never invents operational intervals', () => {
  assert.equal(reportedUptimePercent([]), null);
  assert.equal(reportedUptimePercent([null, 'unknown']), null);
  assert.equal(reportedUptimePercent(['up', null, 'down']), '50');
  assert.equal(reportedUptimePercent(['up', 'degraded']), '100');
});
