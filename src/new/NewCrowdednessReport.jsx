import React, { useEffect, useState } from 'react';
import { getMyCrowdednessReport, submitCrowdednessReport } from '@/api/firebaseClient';

const REPORTS = ['quiet', 'moderate', 'crowded'];

export default function NewCrowdednessReport({ spot, user, isOwner, onShowAuth, language }) {
  const cs = String(language || '').startsWith('cs');
  const L = (czech, english) => cs ? czech : english;
  const [myReport, setMyReport] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const canReport = Boolean(user?.id && user.emailVerified && !isOwner);

  useEffect(() => {
    if (!canReport) { setMyReport(null); setSelected(null); return undefined; }
    let active = true;
    setLoading(true);
    getMyCrowdednessReport(spot.id, user.id)
      .then(value => {
        if (!active) return;
        setMyReport(value);
        setSelected(value);
      })
      .catch(cause => {
        if (!active) return;
        setError(L('Tvoji uloženou zprávu se nepodařilo načíst.', 'Your saved report could not be loaded.'));
        console.error('Crowdedness report read failed', { code: cause?.code || cause?.name || 'unknown' });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canReport, spot.id, user?.id, language]);

  const counts = {
    quiet: Number(spot.crowdedness_quiet_count) || 0,
    moderate: Number(spot.crowdedness_moderate_count) || 0,
    crowded: Number(spot.crowdedness_crowded_count) || 0,
  };
  const total = Number(spot.crowdedness_report_count) || 0;
  const rows = REPORTS.map(key => ({
    key,
    count: counts[key],
    label: key === 'quiet' ? L('Klidno', 'Quiet') : key === 'moderate' ? L('Přiměřeně', 'Moderate') : L('Rušno', 'Crowded'),
  }));
  const top = rows.reduce((best, row) => row.count > best.count ? row : best, rows[0]);
  const topCount = top.count;
  const tied = rows.filter(row => row.count === topCount).length > 1;
  const summary = tied
    ? L('Zprávy se různí', 'Reports vary')
    : top.key === 'quiet'
      ? L('Většinou klidno', 'Usually quiet')
      : top.key === 'moderate'
        ? L('Většinou přiměřeně rušno', 'Usually moderately busy')
        : L('Většinou rušno', 'Usually crowded');
  const topDetail = L(`Podle ${total} zpráv od návštěvníků · ${top.label}: ${topCount}`, `Based on ${total} visitor reports · ${top.label}: ${topCount}`);

  const save = async () => {
    if (!canReport || !selected || busy || selected === myReport) return;
    setBusy(true); setError(''); setStatus('');
    try {
      await submitCrowdednessReport(spot.id, selected, user.id);
      setMyReport(selected);
      setStatus(L('Zpráva uložena. Souhrn se aktualizuje po zpracování serverem; znovu otevři místo pro nejnovější počet.', 'Report saved. The summary updates after server processing; reopen the spot for the latest count.'));
    } catch (cause) {
      setError(L('Zprávu se nepodařilo uložit. Zkus to znovu.', 'The report could not be saved. Try again.'));
      console.error('Crowdedness report submit failed', { code: cause?.code || cause?.name || 'unknown' });
    } finally {
      setBusy(false);
    }
  };

  return <div className="sf-new-crowd">
    <div className="sf-new-crowd-heading"><strong>{L('Jak moc tu bývá rušno?', 'How crowded is it usually?')}</strong><small>{L('Volitelné · zprávy návštěvníků, ne živá obsazenost.', 'Optional · visitor reports, not live occupancy.')}</small></div>

    {total >= 3 ? <div className="sf-new-crowd-summary">
      <div><strong>{summary}</strong><small>{topDetail}</small></div>
      <div className="sf-new-crowd-counts">{rows.map(row => <span key={row.key}><i className={`is-${row.key}`} />{row.label} <b>{row.count}</b></span>)}</div>
    </div> : <div className="sf-new-crowd-summary is-limited">
      <div><strong>{L('Zatím méně než 3 zprávy', 'Fewer than 3 reports so far')}</strong><small>{total === 0 ? L('Souhrn zobrazíme, až se sejde alespoň 3 zpráv.', 'The summary appears once at least 3 reports are available.') : L(`Máme ${total} z ${3} potřebných zpráv.`, `${total} of the 3 reports needed.`)}</small></div>
    </div>}

    {canReport ? <div className="sf-new-crowd-form">
      <div className="sf-new-crowd-options" role="group" aria-label={L('Jak moc tu bývá rušno?', 'How crowded is it usually?')}>
        {rows.map(row => <button type="button" key={row.key} className={selected === row.key ? 'selected' : ''} aria-pressed={selected === row.key} onClick={() => { setSelected(row.key); setStatus(''); setError(''); }} disabled={loading || busy}>{row.label}</button>)}
      </div>
      <div className="sf-new-crowd-actions">{myReport && selected === myReport ? <small>{L('Tvoje aktuální zpráva', 'Your current report')}</small> : <button type="button" onClick={save} disabled={!selected || busy || loading}>{busy ? L('Ukládám…', 'Saving…') : myReport ? L('Aktualizovat zprávu', 'Update report') : L('Uložit zprávu', 'Save report')}</button>}</div>
      {status && <p className="sf-new-crowd-note" role="status">{status}</p>}
      {error && <p className="sf-new-crowd-error" role="alert">{error}</p>}
    </div> : !isOwner ? <div className="sf-new-crowd-guest">{!user ? <button type="button" onClick={onShowAuth}>{L('Přihlásit se a přidat zprávu', 'Sign in to add a report')}</button> : <small>{L('Pro přidání zprávy nejprve ověř svůj e-mail.', 'Verify your email before adding a report.')}</small>}</div> : null}
  </div>;
}
