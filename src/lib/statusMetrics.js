export function reportedUptimePercent(days) {
  const reported = (days || []).filter(day => ['up', 'degraded', 'down'].includes(day));
  if (!reported.length) return null;
  const available = reported.filter(day => day !== 'down').length;
  return ((available / reported.length) * 100).toFixed(2).replace(/\.00$/, '');
}

