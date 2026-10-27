import React, { useState } from 'react';
import { ArrowRight, Check, Clock3, MapPin, Pencil, X } from 'lucide-react';
import { getFirebaseServices, updateSpot } from '@/api/firebaseClient';
import { getSpotDisplayName, getVerifiedSpotCategory } from '@/lib/spotPresentation';
import { categoryLabel, spotPrimaryCategory } from '@/lib/spotCategories';
import { normalizeBestTimeValues, VISIT_TIME_SUNRISE_SUNSET } from '@/lib/visitTime';
import { checkContent } from '@/lib/moderation';
import SpotImage from '@/components/spots/SpotImage';

const PARKING = [['', 'Nevyplněno'], ['yes', 'K dispozici'], ['street', 'Na ulici'], ['paid', 'Placené'], ['no', 'Není']];
const TIMES = [[VISIT_TIME_SUNRISE_SUNSET, 'Východ a západ slunce'], ['golden_hour', 'Zlatá hodinka'], ['night', 'Po setmění'], ['anytime', 'Kdykoli']];
const CATEGORY = {
  viewpoint: 'Vyhlídka', 'hiking spot': 'Výlet', 'swimming spot': 'U vody',
  waterfall: 'Vodopád', 'café': 'Jídlo', castle: 'Hrad', mountain: 'Hora',
  'historic ruin': 'Zřícenina', place: 'Místo',
};

export function newSpotCategoryLabel(spot) {
  const key = spotPrimaryCategory(spot);
  if (key) return categoryLabel(key, 'cs');
  if (spot?.tags?.includes('Other')) return 'Jiné';
  const raw = getVerifiedSpotCategory(spot) || '';
  return CATEGORY[raw] || (raw ? raw.replace(/^./, letter => letter.toLocaleUpperCase('cs')) : 'Místo');
}

export default function NewPublishConfirmation({ spot, onBack, onView, onUpdated, socialWarning }) {
  const [current, setCurrent] = useState(spot);
  const [editing, setEditing] = useState(false);
  const [parking, setParking] = useState(spot.parking || '');
  const [bestTime, setBestTime] = useState(normalizeBestTimeValues(spot.best_time));
  const [description, setDescription] = useState(spot.description || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const live = current.status === 'published' && current.is_public === true;
  const pending = current.status === 'pending_trust';
  const viewable = current.is_public === true && (live || pending);
  const ownerUid = getFirebaseServices().auth.currentUser?.uid;
  const canImprove = Boolean(ownerUid && current.created_by_uid === ownerUid);
  const name = getSpotDisplayName(current, 'cs');
  const toggleTime = value => setBestTime(existing => normalizeBestTimeValues(value === 'anytime'
    ? existing.includes('anytime') ? [] : ['anytime']
    : existing.includes(value) ? existing.filter(item => item !== value) : [...existing.filter(item => item !== 'anytime'), value]));
  const saveImprovements = async () => {
    if (busy || !canImprove) return;
    if (!checkContent(description).ok) { setError('Popis nelze uložit. Uprav text a zkus to znovu.'); return; }
    setBusy(true); setError(''); setSaved(false);
    const patch = { parking, best_time: bestTime, description: description.trim().slice(0, 2000) };
    try {
      await updateSpot(current.id, patch);
      const updated = { ...current, ...patch };
      setCurrent(updated); onUpdated?.(updated); setEditing(false); setSaved(true);
    } catch (cause) {
      console.error('Post-publication details update failed', { stage: 'owner-edit', code: cause?.code || cause?.name || 'unknown' });
      setError('Doplňující údaje se nepodařilo uložit. Zkontroluj připojení a zkus to znovu.');
    } finally { setBusy(false); }
  };

  return <section className="sf-new-publish" aria-label="Potvrzení místa">
    <header className="sf-new-publish-top"><span>SPOTFINDER</span><button type="button" onClick={onBack} aria-label="Zpět na mapu"><X size={21} /></button></header>
    <div className="sf-new-publish-scroll">
      <div className={`sf-new-publish-status ${live ? 'is-live' : 'is-pending'}`}><span>{live ? <Check size={28} /> : <Clock3 size={28} />}</span><p>{live ? 'Spot přidán' : pending ? 'Místo čeká na kontrolu' : 'Stav zveřejnění se ověřuje'}</p></div>
      <h1>{live ? 'Tvé místo je na mapě' : pending ? 'Děkujeme za přidání místa' : 'Místo bylo odesláno'}</h1>
      <p className="sf-new-publish-intro">{live ? 'Místo je teď veřejné pro všechny.' : pending ? 'Místo bylo uložené, ale čeká na kontrolu. Zatím neslibujeme, že je viditelné pro všechny.' : 'Místo není potvrzené jako veřejné. Jeho stav najdeš v detailu.'}</p>
      <article className="sf-new-publish-card"><div className="sf-new-publish-photo"><SpotImage spot={current} alt={name} className="sf-new-publish-image" fallbackClassName="sf-new-publish-fallback" /></div><div className="sf-new-publish-card-copy"><span>{newSpotCategoryLabel(current)}</span><h2>{name}</h2><small><MapPin size={14} /> {Number.isFinite(Number(current.lat)) && Number.isFinite(Number(current.lng)) ? `${Number(current.lat).toFixed(4)}, ${Number(current.lng).toFixed(4)}` : 'Poloha není k dispozici'}</small><em>{live ? 'Veřejné' : pending ? 'Čeká na kontrolu' : 'Neveřejné'}</em></div></article>
      {socialWarning && <p className="sf-new-publish-warning" role="status">{socialWarning}</p>}
      {canImprove && <section className="sf-new-publish-improve"><div><span className="sf-new-publish-improve-icon"><Pencil size={20} /></span><div><h2>Ještě něco doplnit?</h2><p>Parkování, nejlepší čas a krátký popis pomohou ostatním.</p></div></div>{editing ? <div className="sf-new-publish-edit"><label>Parkování<select value={parking} onChange={event => setParking(event.target.value)}>{PARKING.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><fieldset><legend>Nejlepší čas</legend><div className="sf-new-publish-times">{TIMES.map(([value, label]) => <button type="button" key={value} className={bestTime.includes(value) ? 'selected' : ''} onClick={() => toggleTime(value)}>{label}</button>)}</div></fieldset><label>Krátký popis<textarea maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Co je dobré vědět před návštěvou?" /></label>{error && <p className="sf-new-publish-warning" role="alert">{error}</p>}<div className="sf-new-publish-edit-actions"><button type="button" onClick={() => setEditing(false)} disabled={busy}>Zrušit</button><button type="button" onClick={saveImprovements} disabled={busy}>{busy ? 'Ukládám…' : 'Uložit údaje'}</button></div></div> : <><button type="button" className="sf-new-publish-add-details" onClick={() => setEditing(true)}>Doplnit údaje</button>{saved && <p className="sf-new-publish-saved" role="status">Doplňující údaje byly uložené.</p>}</>}</section>}
    </div>
    <footer className="sf-new-publish-footer"><button type="button" onClick={onBack}>Zpět na mapu</button><button type="button" onClick={() => onView(current)} disabled={!viewable}><ArrowRight size={18} /> {viewable ? 'Zobrazit místo' : 'Detail zatím nedostupný'}</button></footer>
  </section>;
}
