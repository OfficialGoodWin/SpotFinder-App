const countsFor = (rows, targetOf, reporterOf) => {
  const reporters = new Map();
  for (const row of rows) {
    if (row.status !== 'open') continue;
    const target = targetOf(row);
    const reporter = reporterOf(row);
    if (!target || !reporter) continue;
    if (!reporters.has(target)) reporters.set(target, new Set());
    reporters.get(target).add(reporter);
  }
  return new Map([...reporters].map(([target, users]) => [target, users.size]));
};

export const reportPriorityCounts = reports => countsFor(reports,
  report => report.target_type === 'spot' ? report.target_id : null,
  report => report.reporter_uid);

export const flagPriorityCounts = flags => countsFor(flags,
  flag => flag.spot_id,
  flag => String(flag.reporter_email || '').trim().toLowerCase());

export const sortForManualReview = (rows, counts, targetOf) => [...rows].sort((a, b) => {
  const left = a.status === 'open' ? counts.get(targetOf(a)) || 0 : 0;
  const right = b.status === 'open' ? counts.get(targetOf(b)) || 0 : 0;
  return Number(right >= 3) - Number(left >= 3) || right - left;
});
