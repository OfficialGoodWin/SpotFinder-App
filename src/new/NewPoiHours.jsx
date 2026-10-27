import React, { useEffect, useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { evaluatePoiOpeningHours } from './poiOpeningHours';

function nextTime(date, timeZone, language) {
  if (!date || !timeZone) return '';
  const locale = language?.startsWith('cs') ? 'cs-CZ' : 'en-US';
  const sameDay = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = sameDay.format(new Date()) === sameDay.format(date);
  return new Intl.DateTimeFormat(locale, {
    timeZone, ...(today ? {} : { weekday: 'short', day: 'numeric', month: 'numeric' }),
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
}

export default function NewPoiHours({ raw, lat, lon, language, source }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [raw, lat, lon]);
  const result = useMemo(() => evaluatePoiOpeningHours(raw, { lat, lon, now, language }),
    [raw, lat, lon, now, language]);
  const cs = language?.startsWith('cs');
  const status = result.kind === 'always' ? cs ? 'Otevřeno nonstop' : 'Open 24/7'
    : result.kind === 'open' ? cs ? 'Otevřeno' : 'Open'
      : result.kind === 'closed' ? cs ? 'Zavřeno' : 'Closed'
        : result.kind === 'missing' ? cs ? 'Otevírací doba není uvedena' : 'Opening hours not provided'
          : cs ? 'Otevírací dobu nelze spolehlivě určit' : 'Opening hours cannot be determined reliably';
  const next = result.nextChange && (result.kind === 'open' || result.kind === 'closed')
    ? `${result.kind === 'open' ? cs ? 'Zavírá' : 'Closes' : cs ? 'Otevírá' : 'Opens'} ${nextTime(result.nextChange, result.timeZone, language)}` : '';
  return <div className={`sf-new-poi-hours is-${result.kind}`}>
    <div className="sf-new-poi-hours-status"><Clock3 size={17} aria-hidden="true" /><strong>{status}</strong>{next && <span>{next}</span>}</div>
    <details className="sf-new-poi-hours-details"><summary>{cs ? 'Otevírací doba' : 'Opening hours'}</summary>
      {result.rows ? <><div className="sf-new-poi-hours-week">{result.rows.map(row => <div className={`sf-new-poi-hours-day${row.today ? ' is-today' : ''}`} key={row.label}>
        <span>{row.label}<small>{row.date}{row.holiday ? ` · ${cs ? 'svátek' : 'holiday'}` : ''}</small></span>
        <span>{row.periods.length ? row.periods.map((period, index) => <span key={`${period.label}-${index}`}>{period.label}{period.unknown ? ` (${cs ? 'nejisté' : 'uncertain'})` : ''}{period.comment ? ` · ${period.comment}` : ''}</span>) : cs ? 'Zavřeno' : 'Closed'}</span>
      </div>)}</div>{result.variable && <p className="sf-new-poi-hours-note">{cs ? 'Zobrazen je tento týden; sezónní a sváteční doba se může lišit.' : 'Showing this week; seasonal and holiday hours may differ.'}</p>}</>
        : <p className="sf-new-poi-hours-note">{status}</p>}
      {result.raw && <p className="sf-new-poi-hours-raw">{cs ? 'Zapsaná otevírací doba' : 'Recorded hours'}: <span>{result.raw}</span></p>}
      {source && <small className="sf-new-poi-hours-source">{cs ? 'Zdroj' : 'Source'}: {source}</small>}
    </details>
  </div>;
}
