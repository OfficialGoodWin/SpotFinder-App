import React, { useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, ImagePlus, MapPin, Mic, X } from 'lucide-react';
import { addSocialPost, createSpot, deleteCloudSpotDraft, getFirebaseServices, getPublicSpotsNear, loadDraftImageFile, saveCloudSpotDraft, uploadDraftImage, uploadSpotImage } from '@/api/firebaseClient';
import { createDraftId, deleteGuestDraft, getGuestDraftOwnerKey, normalizeSpotDraft, saveGuestDraft } from '@/lib/spotDrafts';
import { deleteGuestDraftPhotos, loadGuestDraftPhoto, persistGuestDraftPhotos, pruneGuestDraftPhotos } from '@/lib/guestDraftPhotos';
import { IMAGE_ACCEPT, validateImageFileMetadata } from '@/lib/imageUploadValidation';
import { prepareContributionPhoto } from '@/lib/prepareContributionPhoto';
import { moderateSubmission } from '@/lib/moderation';
import { validateSocialPostUrl } from '@/lib/socialUrlPolicy';
import { getSpotDisplayName } from '@/lib/spotPresentation';

const CATEGORIES = [
  { label: 'Vyhlídka', tag: 'Viewpoint', type: 'viewpoint' },
  { label: 'Výlet', tag: 'Hike', type: 'general' },
  { label: 'U vody', tag: 'SwimSpot', type: 'general' },
  { label: 'Jídlo', tag: 'SecretCafe', type: 'general' },
  { label: 'Jiné', tag: 'Other', type: 'general' },
];
const COST = [['free', 'Zdarma'], ['paid', 'Placené'], ['donation', 'Dobrovolné']];
const EFFORT = [['easy', 'Snadná procházka'], ['moderate', 'Kousek pěšky'], ['hard', 'Výprava']];
const PARKING = [['yes', 'K dispozici'], ['street', 'Na ulici'], ['paid', 'Placené'], ['no', 'Žádné']];
const TIMES = [['sunrise', 'Východ slunce'], ['sunset', 'Západ slunce'], ['golden_hour', 'Zlatá hodinka'], ['after_dark', 'Po setmění'], ['anytime', 'Kdykoli']];
const validCoords = point => Number.isFinite(point?.lat) && point.lat >= -90 && point.lat <= 90 && Number.isFinite(point?.lng) && point.lng >= -180 && point.lng <= 180;
export const quickAddRecoveryKey = user => `spotfinder:new:active-draft:${user?.id || getGuestDraftOwnerKey(localStorage)}`;
const photoError = (index, error) => `Fotografii ${index + 1} se nepodařilo uložit. ${error?.code === 'storage/unauthorized' ? 'Přihlas se znovu.' : 'Zkontroluj připojení a zkus to znovu.'}`;
const czechError = (error, fallback) => {
  const message = String(error?.message || '');
  const code = String(error?.cause?.code || error?.code || '');
  if (/^Fotografii \d+|^Příliš mnoho|^Text není možné|^Účet se změnil|^Počkej na načtení/.test(message)) return message;
  if (/resource-exhausted/.test(code)) return 'Příliš mnoho odeslání. Zkus to prosím později.';
  if (/unauthenticated|permission-denied|unauthorized/.test(code)) return 'Přihlášení vypršelo nebo nemáš oprávnění. Přihlas se a zkus to znovu.';
  if (/invalid-argument/.test(code)) return 'Místo se nepodařilo ověřit. Zkontroluj zadané údaje.';
  return fallback;
};
const photoLog = (stage, index, photo, error) => console.error('Quick add photo failed', {
  stage, imageIndex: index, mimeType: photo?.diagnostic?.type || photo?.file?.type || 'unknown',
  size: photo?.diagnostic?.size || photo?.file?.size || 0,
  dimensions: photo?.diagnostic ? { width: photo.diagnostic.width, height: photo.diagnostic.height } : null,
  conversion: photo?.file ? 'prepared-jpeg' : 'failed', code: error?.cause?.code || error?.code || error?.name || 'unknown',
});

export default function QuickAddFlow({ coords, draft, hidden, user, onMove, onClose, onAuth, onViewSpot, onCreated }) {
  const initial = useRef(normalizeSpotDraft(draft || { id: createDraftId(), ...coords }));
  const draftId = initial.current.id;
  const [form, setForm] = useState(() => ({
    title: initial.current.title, category: initial.current.tags[0] || '', description: initial.current.description,
    cost: initial.current.cost, difficulty: initial.current.accessDifficulty, parking: initial.current.parking,
    bestTime: initial.current.bestTime, socialUrl: initial.current.socialUrl,
  }));
  const [photos, setPhotos] = useState([]);
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [ready, setReady] = useState(!draft?.photo_refs?.length);
  const [photoReload, setPhotoReload] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('');
  const [rights, setRights] = useState(false);
  const [attested, setAttested] = useState(false);
  const [goodToKnow, setGoodToKnow] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState(null);
  const [result, setResult] = useState(null);
  const [socialWarning, setSocialWarning] = useState('');
  const [activePhoto, setActivePhoto] = useState(0);
  const photosRef = useRef([]);
  const lockRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const uploadedPublicPhotosRef = useRef(new Map());
  const latestRef = useRef(null);
  const revisionRef = useRef(0);
  const voiceRef = useRef(null);
  const cloud = Boolean(user && !user.isAnonymous);
  const ownerUidRef = useRef(getFirebaseServices().auth.currentUser?.uid || null);

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => { photosRef.current.forEach(photo => URL.revokeObjectURL(photo.url)); voiceRef.current?.stop?.(); }, []);
  useEffect(() => {
    if (!draft?.photo_refs?.length) return undefined;
    if (photosRef.current.length === draft.photo_refs.length) { setReady(true); return undefined; }
    let alive = true;
    (async () => {
      try {
        const owner = cloud ? null : getGuestDraftOwnerKey(localStorage);
        const restored = await Promise.all(draft.photo_refs.map(async ref => {
          const file = cloud ? await loadDraftImageFile(ref) : await loadGuestDraftPhoto(ref, owner);
          return { id: createDraftId(), file, url: URL.createObjectURL(file), ref, diagnostic: null };
        }));
        if (alive) { setPhotos(restored); setReady(true); }
        else restored.forEach(photo => URL.revokeObjectURL(photo.url));
      } catch (cause) { if (alive) { setError('Uložené fotografie se nepodařilo načíst. Obnov připojení a zkus to znovu.'); setReady(false); console.error('Quick add photo restore failed', { stage: 'restore', code: cause?.code || cause?.name || 'unknown' }); } }
    })();
    return () => { alive = false; };
  }, [cloud, draft, photoReload]);

  const update = (key, value) => { setForm(current => ({ ...current, [key]: value })); setDuplicateCheck(null); setError(''); };
  latestRef.current = { form, coords, photos, pendingPhotos };
  const saveDraft = () => {
    const snapshot = latestRef.current;
    const revision = revisionRef.current;
    const work = async () => {
      if (!ready) throw new Error('Počkej na načtení uložených fotografií.');
      setSaveState('Ukládám rozpracované místo…');
      const ownerKey = cloud ? null : getGuestDraftOwnerKey(localStorage);
      const data = normalizeSpotDraft({
        ...initial.current, id: draftId, lat: snapshot.coords.lat, lng: snapshot.coords.lng,
        title: snapshot.form.title, description: snapshot.form.description, tags: snapshot.form.category ? [snapshot.form.category] : [],
        cost: snapshot.form.cost, accessDifficulty: snapshot.form.difficulty, parking: snapshot.form.parking,
        bestTime: snapshot.form.bestTime, socialUrl: snapshot.form.socialUrl,
      });
      let refs = [];
      if (cloud) {
        const currentUid = getFirebaseServices().auth.currentUser?.uid;
        if (!currentUid || (ownerUidRef.current && currentUid !== ownerUidRef.current)) throw new Error('Účet se změnil. Přihlas se k původnímu účtu.');
        ownerUidRef.current = currentUid;
        for (let index = 0; index < snapshot.photos.length; index += 1) {
          const photo = snapshot.photos[index];
          if (!photo.ref?.path) {
            try { photo.ref = await uploadDraftImage(photo.file, draftId, fraction => { const percent = Math.round((index + fraction) / snapshot.photos.length * 100); setProgress(percent); setSaveState(`Ukládám fotografie… ${percent} %`); }); }
            catch (cause) { photoLog('draft-upload', index, photo, cause); throw new Error(photoError(index, cause), { cause }); }
          }
          refs.push(photo.ref);
        }
        await saveCloudSpotDraft({ ...data, photo_refs: refs }, currentUid);
      } else {
        if (snapshot.photos.length) {
          if (snapshot.photos.every(photo => photo.ref?.local_id)) refs = snapshot.photos.map(photo => photo.ref);
          else {
            refs = await persistGuestDraftPhotos(ownerKey, draftId, snapshot.photos.map(photo => photo.file));
            snapshot.photos.forEach((photo, index) => { photo.ref = refs[index]; });
          }
        }
        saveGuestDraft(localStorage, ownerKey, { ...data, photo_refs: refs });
        await pruneGuestDraftPhotos(ownerKey, draftId, refs).catch(cause => console.warn('Draft photo cleanup failed', { code: cause?.code || cause?.name || 'unknown' }));
      }
      window.dispatchEvent(new CustomEvent('spotfinder:drafts-changed'));
      try { localStorage.setItem(quickAddRecoveryKey(user), draftId); } catch { /* Draft remains available in the drafts list. */ }
      if (revision === revisionRef.current) setSaveState(snapshot.pendingPhotos.length ? 'Údaje uložené; nepřipravené fotografie čekají na opravu' : 'Rozpracované místo uloženo');
      return refs;
    };
    const pending = saveQueueRef.current.then(work);
    saveQueueRef.current = pending.catch(() => {});
    return pending;
  };
  useEffect(() => {
    if (!ready || result) return undefined;
    revisionRef.current += 1;
    setSaveState('Neuložené změny');
    const timer = setTimeout(() => { saveDraft().catch(cause => { setSaveState('Automatické uložení se nezdařilo'); console.error('Quick add draft save failed', { stage: 'autosave', code: cause?.cause?.code || cause?.code || cause?.name || 'unknown' }); }); }, 1200);
    return () => clearTimeout(timer);
  }, [form, coords, photos, pendingPhotos, ready, result]);

  const selectPhotos = async event => {
    const picked = [...(event.target.files || [])];
    const files = picked.slice(0, Math.max(0, 3 - photosRef.current.length - pendingPhotos.length));
    event.target.value = '';
    if (!files.length || preparing || busy) return;
    setPreparing(true); setError(picked.length > files.length ? 'K jednomu místu lze přidat nejvýše 3 fotografie.' : '');
    for (let index = 0; index < files.length; index += 1) {
      const source = files[index];
      try {
        validateImageFileMetadata(source);
        const prepared = await prepareContributionPhoto(source);
        const photo = { id: createDraftId(), file: prepared.file, url: URL.createObjectURL(prepared.file), ref: null, diagnostic: prepared.original };
        setPhotos(current => { const next = [...current, photo].slice(0, 3); photosRef.current = next; return next; });
      } catch (cause) {
        photoLog('preparation', photosRef.current.length + index, { file: source }, cause);
        setPendingPhotos(current => [...current, { id: createDraftId(), file: source }]);
        setError(`Fotografii ${source.name || index + 1} se nepodařilo připravit. Zkus JPEG kopii.`);
      }
    }
    setPreparing(false);
  };
  const retryPendingPhoto = async pending => {
    if (preparing || busy) return;
    setPreparing(true); setError('');
    try {
      const prepared = await prepareContributionPhoto(pending.file);
      const photo = { id: createDraftId(), file: prepared.file, url: URL.createObjectURL(prepared.file), ref: null, diagnostic: prepared.original };
      setPhotos(current => { const next = [...current, photo]; photosRef.current = next; return next; });
      setPendingPhotos(current => current.filter(item => item.id !== pending.id));
    } catch (cause) { photoLog('preparation-retry', photosRef.current.length, { file: pending.file }, cause); setError(`Fotografii ${pending.file.name || ''} se stále nedaří připravit. Vyber JPEG kopii nebo ji odeber.`); }
    finally { setPreparing(false); }
  };
  const removePhoto = index => setPhotos(current => { const next = current.filter((_, i) => i !== index); URL.revokeObjectURL(current[index].url); photosRef.current = next; setActivePhoto(value => Math.min(value, Math.max(0, next.length - 1))); return next; });
  const movePhoto = (from, to) => setPhotos(current => { if (to < 0 || to >= current.length) return current; const next = [...current]; next.splice(to, 0, next.splice(from, 1)[0]); photosRef.current = next; setActivePhoto(to); return next; });
  const dictate = key => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setError('Hlasové zadávání není v tomto prohlížeči dostupné.'); return; }
    try { voiceRef.current?.stop?.(); const recognition = new Recognition(); recognition.lang = 'cs-CZ'; recognition.onresult = event => update(key, `${latestRef.current.form[key]} ${event.results[0][0].transcript}`.trim()); recognition.onerror = () => setError('Mikrofon není dostupný. Zadej text ručně.'); voiceRef.current = recognition; recognition.start(); }
    catch { setError('Mikrofon není dostupný. Zadej text ručně.'); }
  };
  const close = async () => {
    if (lockRef.current || preparing) return;
    if (pendingPhotos.length) { setError('Nejdřív oprav nebo odeber nepřipravené fotografie. Tyto soubory zatím nelze uložit do návrhu.'); return; }
    setBusy('draft'); setError('');
    try { await saveDraft(); onClose(); }
    catch (cause) { setError(czechError(cause, 'Rozpracované místo se nepodařilo uložit. Údaje zůstaly ve formuláři; zkus to znovu.')); }
    finally { setBusy(''); }
  };
  const viewDuplicate = async spot => {
    if (lockRef.current || busy) return;
    if (pendingPhotos.length) { setError('Nejdřív oprav nebo odeber nepřipravené fotografie.'); return; }
    setBusy('draft'); setError('');
    try { await saveDraft(); onViewSpot(spot); }
    catch (cause) { setError(czechError(cause, 'Rozpracované místo se nepodařilo uložit. Údaje zůstaly ve formuláři; zkus to znovu.')); }
    finally { setBusy(''); }
  };
  const beginPublish = async () => {
    if (lockRef.current || preparing || !ready) return;
    if (pendingPhotos.length) { setError('Nejdřív oprav nebo odeber nepřipravené fotografie.'); return; }
    if (!form.title.trim() || !form.category || !validCoords(coords)) { setError('Vyplň název, vyber kategorii a potvrď platnou polohu.'); return; }
    if (photos.length && !rights) { setError('Potvrď, že máš právo fotografie sdílet.'); return; }
    if (!attested) { setError('Před odesláním potvrď souhlas s podmínkami.'); return; }
    const social = form.socialUrl.trim() ? validateSocialPostUrl(form.socialUrl.trim()) : null;
    if (social && !social.ok) { setError('Vlož platný odkaz na příspěvek Instagramu nebo TikToku.'); return; }
    if (social && (!user || user.isAnonymous || user.emailVerified !== true)) { setError('Pro připojení sociálního příspěvku je nutný ověřený účet.'); onAuth(); return; }
    if (!getFirebaseServices().auth.currentUser) { setError('Pro zveřejnění místa se přihlas. Rozpracované údaje zůstávají zachované.'); onAuth(); return; }
    setBusy('checking'); setError('');
    try {
      const nearby = await getPublicSpotsNear([coords.lat, coords.lng], 0.2, { maxCandidates: 100 });
      const titleWords = form.title.trim().toLocaleLowerCase('cs').split(/\s+/).filter(word => word.length > 3);
      const plausible = nearby.spots.filter(spot => {
        const existing = getSpotDisplayName(spot, 'cs').toLocaleLowerCase('cs');
        return spot._km <= 0.075 || titleWords.some(word => existing.includes(word));
      }).slice(0, 5);
      if (plausible.length) { setDuplicateCheck(plausible); return; }
      await publish(social);
    } catch (cause) { setError('Podobná místa se nepodařilo ověřit. Zkontroluj připojení a zkus to znovu.'); console.error('Quick add duplicate check failed', { stage: 'duplicate-check', code: cause?.code || cause?.name || 'unknown' }); }
    finally { setBusy(''); }
  };
  const publish = async (validatedSocial = null) => {
    if (lockRef.current) return;
    if (pendingPhotos.length || !form.title.trim() || !form.category || !validCoords(coords) || photos.length > 0 && !rights || !attested) {
      setError('Doplň povinné údaje a oprav nebo odeber nepřipravené fotografie.'); return;
    }
    lockRef.current = true;
    setBusy('publishing'); setError('');
    try {
      const description = form.description.trim() || `${form.title.trim()} – ${CATEGORIES.find(item => item.tag === form.category)?.label || 'zajímavé místo'}.`;
      const moderation = moderateSubmission({ text: description, rateLimitKey: `rate:add_spot:${user?.email || 'anon'}`, maxPerWindow: 5, windowMs: 10 * 60 * 1000 });
      if (!moderation.allowed) throw new Error(moderation.reasonKey === 'moderation.tooManySubmissions' ? 'Příliš mnoho odeslání. Zkus to prosím později.' : 'Text není možné odeslat. Uprav popis místa.');
      await saveDraft();
      const imageUrls = [];
      if (!cloud) {
        for (let index = 0; index < photos.length; index += 1) {
          const photo = photos[index];
          try {
            let url = uploadedPublicPhotosRef.current.get(photo.id);
            if (!url) { url = await uploadSpotImage(photo.file, { onProgress: fraction => setProgress(Math.round((index + fraction) / photos.length * 100)) }); uploadedPublicPhotosRef.current.set(photo.id, url); }
            imageUrls.push(url);
          }
          catch (cause) { photoLog('public-upload', index, photo, cause); throw new Error(photoError(index, cause), { cause }); }
        }
      }
      const category = CATEGORIES.find(item => item.tag === form.category);
      const created = await createSpot({
        lat: coords.lat, lng: coords.lng, title: form.title.trim(), description, spot_type: category?.type || 'general',
        tags: [form.category], image_url: imageUrls[0] || null, image_urls: imageUrls, is_public: true,
        created_by: user?.email || 'anonymous', created_by_name: user?.displayName || user?.email?.split('@')[0] || 'Anonymous',
        created_by_uid: getFirebaseServices().auth.currentUser?.uid || null,
        cost: form.cost, access_difficulty: form.difficulty, parking: form.parking, best_time: form.bestTime,
        submission_attestation: { accepted: attested, photo_rights_confirmed: photos.length > 0 && rights }, _draft_id: draftId,
      });
      if (validatedSocial?.ok) {
        try { await addSocialPost({ url: validatedSocial.canonicalUrl, targetType: 'spot', targetId: String(created.id), targetName: getSpotDisplayName(created, 'cs') }); }
        catch (cause) { setSocialWarning('Místo bylo odesláno, ale odkaz se nepodařilo připojit.'); console.error('Quick add social link failed', { stage: 'social-link', code: cause?.code || cause?.name || 'unknown' }); }
      }
      onCreated(created); setResult(created);
      try { if (cloud) await deleteCloudSpotDraft(draftId); else { const owner = getGuestDraftOwnerKey(localStorage); deleteGuestDraft(localStorage, owner, draftId); await deleteGuestDraftPhotos(owner, draftId); } window.dispatchEvent(new CustomEvent('spotfinder:drafts-changed')); }
      catch (cause) { console.warn('Published draft cleanup failed', { code: cause?.code || cause?.name || 'unknown' }); }
      try { if (localStorage.getItem(quickAddRecoveryKey(user)) === draftId) localStorage.removeItem(quickAddRecoveryKey(user)); } catch { /* Draft list remains usable. */ }
    } catch (cause) {
      const raw = String(cause?.message || '');
      setError(/one or more images couldn't be saved|internal \[0\]/i.test(raw)
        ? 'Fotografie se nepodařilo dokončit při odeslání. Údaje a výběr fotografií zůstaly zachované; zkus to znovu.'
        : czechError(cause, 'Místo se nepodařilo odeslat. Údaje a fotografie zůstaly zachované. Zkus to znovu.'));
      console.error('Quick add publication failed', { stage: 'publication', code: cause?.cause?.code || cause?.code || cause?.name || 'unknown', imageCount: photos.length });
    }
    finally { lockRef.current = false; setBusy(''); }
  };

  if (hidden) return null;
  if (result) return <section className="sf-new-quick-add sf-new-quick-add--result" role="status"><div className="sf-new-quick-body"><h1>{result.status === 'published' ? 'Místo je zveřejněné' : 'Místo čeká na schválení'}</h1><p>{result.status === 'published' ? 'Tvé místo je na mapě.' : 'Místo bylo odesláno. Na mapě se zobrazí po kontrole.'}</p>{socialWarning && <p className="sf-new-quick-error">{socialWarning}</p>}<button className="sf-new-quick-primary" onClick={() => result.status === 'published' ? onViewSpot(result) : onClose()}>{result.status === 'published' ? 'Zobrazit místo' : 'Zpět na mapu'}</button></div></section>;
  return <section className="sf-new-quick-add" aria-label="Nové místo">
    <header className="sf-new-quick-header"><button type="button" onClick={goodToKnow ? () => setGoodToKnow(false) : close} aria-label={goodToKnow ? 'Zpět' : 'Uložit a zavřít'}>{goodToKnow ? <ChevronLeft /> : <X />}</button><h1>{goodToKnow ? 'Dobré vědět' : 'Nové místo'}</h1><span /></header>
    {goodToKnow ? <div className="sf-new-quick-body sf-new-quick-good">
      <h2>Co pomůže ostatním?</h2><p>Volitelné detaily usnadní plánování návštěvy.</p>
      {[[COST, 'Cena', 'cost'], [EFFORT, 'Náročnost', 'difficulty'], [PARKING, 'Parkování', 'parking']].map(([options, label, key]) => <div className="sf-new-quick-field" key={key}><strong>{label}</strong><div className="sf-new-quick-chips">{options.map(([value, text]) => <button type="button" className={form[key] === value ? 'selected' : ''} key={value} onClick={() => update(key, form[key] === value ? '' : value)}>{text}</button>)}</div></div>)}
      <div className="sf-new-quick-field"><strong>Nejlepší čas</strong><div className="sf-new-quick-chips">{TIMES.map(([value, text]) => <button type="button" className={form.bestTime.includes(value) ? 'selected' : ''} key={value} onClick={() => update('bestTime', value === 'anytime' ? (form.bestTime.includes(value) ? [] : [value]) : form.bestTime.includes(value) ? form.bestTime.filter(item => item !== value) : [...form.bestTime.filter(item => item !== 'anytime'), value])}>{text}</button>)}</div></div>
      <label className="sf-new-quick-field"><strong>Krátký popis</strong><span className="sf-new-quick-textarea"><textarea maxLength={2000} value={form.description} onChange={event => update('description', event.target.value)} placeholder="Co je na místě zajímavé?" /><button type="button" aria-label="Nadiktovat popis" onClick={() => dictate('description')}><Mic size={20} /></button></span></label>
      <button className="sf-new-quick-primary" type="button" onClick={() => setGoodToKnow(false)}>Hotovo</button>
    </div> : <div className="sf-new-quick-body">
      <div className="sf-new-quick-photo-area">{photos.length ? <><img className="sf-new-quick-hero" src={photos[activePhoto]?.url || photos[0].url} alt={`Fotografie ${activePhoto + 1}`} /><div className="sf-new-quick-thumbs">{photos.map((photo, index) => <div key={photo.id}><button type="button" className={activePhoto === index ? 'selected' : ''} onClick={() => setActivePhoto(index)}><img src={photo.url} alt={`Vybrat fotografii ${index + 1}`} /></button><button type="button" aria-label={`Odebrat fotografii ${index + 1}`} onClick={() => removePhoto(index)}><X size={14} /></button><button type="button" aria-label={`Posunout fotografii ${index + 1} doleva`} disabled={index === 0} onClick={() => movePhoto(index, index - 1)}>←</button><button type="button" aria-label={`Posunout fotografii ${index + 1} doprava`} disabled={index === photos.length - 1} onClick={() => movePhoto(index, index + 1)}>→</button></div>)}</div></> : <div className="sf-new-quick-photo-empty"><ImagePlus size={31} /><strong>Přidej fotky místa</strong><span>Volitelné · maximálně 3 fotografie</span></div>}
        {photos.length + pendingPhotos.length < 3 && <div className="sf-new-quick-photo-actions"><label><Camera size={17} /> Fotoaparát<input type="file" accept={IMAGE_ACCEPT} capture="environment" onChange={selectPhotos} disabled={preparing || !!busy} /></label><label><ImagePlus size={17} /> Galerie<input type="file" accept={IMAGE_ACCEPT} multiple onChange={selectPhotos} disabled={preparing || !!busy} /></label></div>}
      </div>
      {pendingPhotos.map(pending => <div className="sf-new-quick-pending" key={pending.id}><span>{pending.file.name || 'Nepřipravená fotografie'}</span><button type="button" onClick={() => retryPendingPhoto(pending)} disabled={preparing || !!busy}>Zkusit znovu</button><button type="button" onClick={() => setPendingPhotos(current => current.filter(item => item.id !== pending.id))}>Odebrat</button></div>)}
      {photos.length > 0 && <label className="sf-new-quick-check"><input type="checkbox" checked={rights} onChange={event => setRights(event.target.checked)} /> Mám právo tyto fotografie sdílet.</label>}
      <label className="sf-new-quick-field"><strong>Název místa *</strong><span className="sf-new-quick-input"><input maxLength={100} value={form.title} onChange={event => update('title', event.target.value)} placeholder="Jak se místo jmenuje?" /><button type="button" aria-label="Nadiktovat název" onClick={() => dictate('title')}><Mic size={19} /></button></span></label>
      <div className="sf-new-quick-field"><strong>O jaké místo jde? *</strong><div className="sf-new-quick-chips">{CATEGORIES.map(item => <button type="button" className={form.category === item.tag ? 'selected' : ''} key={item.tag} onClick={() => update('category', item.tag)}>{item.label}</button>)}</div></div>
      <div className="sf-new-quick-location"><MapPin size={21} /><div><strong>Poloha</strong><small>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</small></div><button type="button" onClick={onMove}>Upravit</button></div>
      <button type="button" className="sf-new-quick-more" onClick={() => setGoodToKnow(true)}><span><strong>Dobré vědět</strong><small>Cena, cesta, parkování a krátký popis · volitelné</small></span><ChevronRight size={20} /></button>
      <label className="sf-new-quick-field"><strong>Instagram nebo TikTok · volitelné</strong><input type="url" value={form.socialUrl} onChange={event => update('socialUrl', event.target.value)} placeholder="https://www.instagram.com/p/…" autoCapitalize="off" /></label>
      <p className="sf-new-quick-note">Když nepřidáš popis, odešle se stručný popis podle názvu a kategorie. Zveřejnění podléhá kontrole.</p>
      <label className="sf-new-quick-check"><input type="checkbox" checked={attested} onChange={event => setAttested(event.target.checked)} /> <span>Souhlasím s <a href="/TermsAndConditions" target="_blank" rel="noopener noreferrer">podmínkami přidávání míst</a>.</span></label>
      {duplicateCheck && <div className="sf-new-quick-duplicates"><strong>Podobná místa poblíž</strong><p>Podívej se, jestli už místo na mapě není. Pokud jde o jiné místo, pokračuj.</p>{duplicateCheck.map(spot => <button type="button" key={spot.id} onClick={() => viewDuplicate(spot)}>{getSpotDisplayName(spot, 'cs')} <span>Zobrazit</span></button>)}<button type="button" className="sf-new-quick-primary" onClick={() => publish(form.socialUrl.trim() ? validateSocialPostUrl(form.socialUrl.trim()) : null)}>Přesto odeslat</button></div>}
      {error && <p className="sf-new-quick-error" role="alert">{error} <button type="button" onClick={() => { setError(''); if (!ready) setPhotoReload(value => value + 1); else if (!pendingPhotos.length && form.title.trim() && form.category) void beginPublish(); }}>{!ready || !pendingPhotos.length && form.title.trim() && form.category ? 'Zkusit znovu' : 'Zavřít'}</button></p>}
      <p className="sf-new-quick-save-status" role="status">{preparing ? 'Připravuji fotografie…' : busy === 'publishing' ? `Odesílám místo… ${progress ? `${progress} %` : ''}` : busy === 'checking' ? 'Hledám podobná místa…' : busy === 'draft' ? `Ukládám… ${progress ? `${progress} %` : ''}` : saveState}</p>
      <div className="sf-new-quick-buttons"><button type="button" onClick={close} disabled={!!busy || preparing || !ready}>Uložit návrh</button><button type="button" className="sf-new-quick-primary" onClick={beginPublish} disabled={!!busy || preparing || !ready || !!pendingPhotos.length || !form.title.trim() || !form.category || !validCoords(coords)}>Odeslat místo</button></div>
    </div>}
  </section>;
}
