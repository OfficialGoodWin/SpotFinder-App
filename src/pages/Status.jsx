import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { getFirebaseServices } from '../api/firebaseClient';
import { reportedUptimePercent } from '@/lib/statusMetrics';
import { useLanguage } from '@/lib/LanguageContext';

// ── Status page ────────────────────────────────────────────────────────────
// Reads two optional Firestore collections, both public-read / admin-write:
//
//   status_services/{serviceId}   { name, order, days: ['up'|'degraded'|'down', ...] }
//     `days` is oldest → newest, one entry per day, up to 90 entries.
//
//   status_incidents/{incidentId} { title, date: 'YYYY-MM-DD', resolved: bool,
//     updates: [{ type: 'investigating'|'identified'|'monitoring'|'resolved',
//                 message, at: ISO timestamp }] }  — updates oldest → newest.
//
// Empty, missing, or unreadable monitoring data is shown as unverified. The
// page never substitutes successful intervals that were not actually stored.

const STATUS_META = {
  up:       { label: 'Operational', dot: 'bg-[#4C7A52]',  bar: 'bg-[#4C7A52]'  },
  degraded: { label: 'Degraded',    dot: 'bg-[#C98A2C]',  bar: 'bg-[#C98A2C]'  },
  down:     { label: 'Down',        dot: 'bg-[#B4453A]',  bar: 'bg-[#B4453A]'  },
  unknown:  { label: 'No data',     dot: 'bg-[#8A8270]',  bar: 'bg-[#CFC8B8]'  },
};

const UPDATE_META = {
  investigating: { label: 'Investigating', border: 'border-[#B4453A]' },
  identified:    { label: 'Identified',    border: 'border-[#C98A2C]' },
  monitoring:    { label: 'Monitoring',    border: 'border-[#8A6E52]' },
  resolved:      { label: 'Resolved',      border: 'border-[#4C7A52]' },
};

const STATUS_SEVERITY = { up: 0, degraded: 1, down: 2 };

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// The stored service history is intentionally simple, but incidents should
// still be visible in the 90-day bars without requiring the admin to manually
// edit every day. Overlay each incident from its start date through today (or
// through the date of its resolved update). Existing manual service history is
// preserved and the more severe state wins.
function incidentAdjustedDays(rawDays, incidents) {
  const days = rawDays?.length ? [...rawDays] : [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayKey = localDateKey(today);

  return days.map((storedStatus, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (days.length - 1 - index));
    const dayKey = localDateKey(day);
    let effectiveStatus = STATUS_META[storedStatus] && storedStatus !== 'unknown' ? storedStatus : 'unknown';

    for (const incident of incidents || []) {
      const startKey = incident.date;
      if (!startKey) continue;

      let endKey = todayKey;
      if (incident.resolved) {
        const resolvedUpdate = [...(incident.updates || [])]
          .reverse()
          .find(update => update.type === 'resolved');
        endKey = resolvedUpdate?.at
          ? localDateKey(new Date(resolvedUpdate.at))
          : startKey;
      }

      if (dayKey < startKey || dayKey > endKey) continue;

      // Old incidents did not have an impact field. Treat those as degraded,
      // matching the headline compatibility behaviour below.
      const incidentStatus = incident.impact === 'down' ? 'down' : 'degraded';
      if ((STATUS_SEVERITY[incidentStatus] || 0) > (STATUS_SEVERITY[effectiveStatus] || 0)) {
        effectiveStatus = incidentStatus;
      }
    }

    return effectiveStatus;
  });
}

function ServiceRow({ service, incidents }) {
  const { t } = useLanguage();
  const rawDays = service.days?.length ? service.days : [];
  const days = incidentAdjustedDays(rawDays, incidents);
  const current = STATUS_META[days.at(-1)] ? days.at(-1) : 'unknown';
  const uptime = reportedUptimePercent(days);

  return (
    <div className="py-5 border-b border-[#DDD6C8] last:border-0">
      <div className="flex items-baseline justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[current]?.dot || STATUS_META.up.dot}`} />
          <span className="font-medium text-[#1B2A1E]">{service.name}</span>
        </div>
        <span className="text-sm font-mono text-[#5C5546]">{uptime === null ? t('statusPage.noHistory') : t('statusPage.reportedUptime').replace('{value}', uptime)}</span>
      </div>
      {days.length > 0 ? <><div className="flex gap-[2px] h-8">
        {days.map((d, i) => {
          const day = new Date();
          day.setHours(12, 0, 0, 0);
          day.setDate(day.getDate() - (days.length - 1 - i));
          return (
            <div
              key={i}
              className={`flex-1 rounded-[1px] ${STATUS_META[d]?.bar || STATUS_META.unknown.bar}`}
              title={`${localDateKey(day)} — ${t(`statusPage.${STATUS_META[d] ? d : 'unknown'}`)}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5 text-xs font-mono text-[#8A8270]">
        <span>{t('statusPage.daysAgo').replace('{value}', Math.max(days.length - 1, 0))}</span>
        <span>{t('statusPage.reportedIntervals').replace('{value}', days.filter(day => ['up', 'degraded', 'down'].includes(day)).length)}</span>
      </div>
      </> : <p className="rounded-md bg-[#E7E2D3] px-3 py-2 text-sm text-[#5C5546]">{t('statusPage.noServiceHistory')}</p>}
    </div>
  );
}

function IncidentGroup({ date, incidents }) {
  const { t, language } = useLanguage();
  const d = new Date(date + 'T00:00:00');
  const label = d.toLocaleDateString(language, { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="py-6 border-b border-[#DDD6C8] last:border-0">
      <h3 className="font-mono text-xs tracking-wide text-[#8A8270] mb-3">{label}</h3>
      {incidents.map((inc, i) => (
        <div key={i} className="mb-4 last:mb-0">
          <p className="font-medium text-[#1B2A1E] mb-2">{inc.title}</p>
          <div className="space-y-2 pl-3">
            {inc.updates?.map((u, j) => (
              <div key={j} className={`border-l-2 pl-3 ${UPDATE_META[u.type]?.border || UPDATE_META.investigating.border}`}>
                <p className="text-sm text-[#3C382F]">
                  <span className="font-medium">{UPDATE_META[u.type] ? t(`statusPage.${u.type}`) : u.type}</span> — {u.message}
                </p>
                <p className="text-xs font-mono text-[#8A8270] mt-0.5">
                  {new Date(u.at).toLocaleString(language, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StatusPage() {
  const { t } = useLanguage();
  const [services, setServices] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataNotice, setDataNotice] = useState('');

  useEffect(() => {
    (async () => {
      const firebase = getFirebaseServices();
      if (!firebase?.db) { setDataNotice('dataUnavailable'); setLoading(false); return; }
      try {
        const [serviceResult, incidentResult] = await Promise.allSettled([
          getDocs(query(collection(firebase.db, 'status_services'), orderBy('order', 'asc'))),
          getDocs(query(collection(firebase.db, 'status_incidents'), orderBy('date', 'desc'), limit(30))),
        ]);
        if (serviceResult.status === 'fulfilled') {
          const records = serviceResult.value.docs.map(d => ({ id: d.id, ...d.data() }));
          setServices(records);
          if (!records.length) setDataNotice('noMonitoring');
        } else {
          setDataNotice('monitoringUnverified');
        }
        if (incidentResult.status === 'fulfilled') setIncidents(incidentResult.value.docs.map(d => ({ id: d.id, ...d.data() })));
        else setDataNotice(current => current || 'incidentsUnverified');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeIncidents = incidents.filter(inc => !inc.resolved);
  const pastIncidents = incidents.filter(inc => inc.resolved);
  const groupByDate = (items) => {
    const byDate = {};
    items.forEach(inc => { (byDate[inc.date] ||= []).push(inc); });
    return Object.entries(byDate);
  };
  const activeIncidentGroups = groupByDate(activeIncidents);
  const pastIncidentGroups = groupByDate(pastIncidents);

  // An active incident affects the headline even if the service history was
  // not manually changed. Legacy incidents have no `impact`, so default them
  // to degraded. This makes already-open incidents behave correctly too.
  const incidentDown = activeIncidents.some(inc => inc.impact === 'down');
  const incidentDegraded = activeIncidents.some(inc => inc.impact !== 'down');
  const hasCurrentServiceData = services.some(service => ['up', 'degraded', 'down'].includes(service.days?.at(-1)));
  const overallDown = services.some(s => s.days?.at(-1) === 'down') || incidentDown;
  const overallDegraded = services.some(s => s.days?.at(-1) === 'degraded') || incidentDegraded;
  const bannerColor = overallDown ? 'bg-[#B4453A]' : overallDegraded ? 'bg-[#C98A2C]' : hasCurrentServiceData ? 'bg-[#4C7A52]' : 'bg-[#6F6A5E]';
  const bannerText = t(`statusPage.${overallDown ? 'outage' : overallDegraded ? 'degradation' : hasCurrentServiceData ? 'operational' : 'currentUnverified'}`);

  return (
    <div className="min-h-screen bg-[#F3F1EA]">
      <div className="max-w-2xl mx-auto px-6 py-14">
        <header className="mb-10">
          <p className="font-mono text-xs tracking-wide text-[#8A8270] mb-1">SPOTFINDER</p>
          <h1 className="text-2xl font-semibold text-[#1B2A1E]">{t('statusPage.title')}</h1>
        </header>

        {loading ? (
          <div className="h-14 rounded-md bg-[#E7E2D3] animate-pulse mb-10" />
        ) : (
          <div className={`${bannerColor} text-white rounded-md px-5 py-4 mb-10 font-medium`}>
            {bannerText}
          </div>
        )}

        {!loading && (
          <>
            <section>
              {services.map(s => <ServiceRow key={s.id} service={s} incidents={incidents} />)}
              {dataNotice && <p className="rounded-md bg-[#E7E2D3] px-4 py-3 text-sm text-[#5C5546]">{t(`statusPage.${dataNotice}`)}</p>}
            </section>

            <p className="mt-4 text-xs leading-5 text-[#8A8270]">{t('statusPage.method')}</p>

            {activeIncidentGroups.length > 0 && (
              <section className="mt-4">
                <h2 className="font-mono text-xs tracking-wide text-[#B4453A] mb-1 pt-6 border-t border-[#DDD6C8]">
                  {t('statusPage.activeIncidents')}
                </h2>
                {activeIncidentGroups.map(([date, groupedIncidents]) => (
                  <IncidentGroup key={`active-${date}`} date={date} incidents={groupedIncidents} />
                ))}
              </section>
            )}

            <section className="mt-4">
              <h2 className="font-mono text-xs tracking-wide text-[#8A8270] mb-1 pt-6 border-t border-[#DDD6C8]">
                {t('statusPage.pastIncidents')}
              </h2>
              {pastIncidentGroups.length === 0 ? (
                <p className="text-sm text-[#8A8270] py-6">{t('statusPage.noResolved')}</p>
              ) : (
                pastIncidentGroups.map(([date, groupedIncidents]) => (
                  <IncidentGroup key={`past-${date}`} date={date} incidents={groupedIncidents} />
                ))
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
