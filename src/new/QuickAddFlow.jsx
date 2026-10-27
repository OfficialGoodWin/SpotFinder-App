import React, { useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, ImagePlus, MapPin, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { addSocialPost, createSpot, deleteCloudSpotDraft, getFirebaseServices, getPublicSpotsNear, getSpotPhotoLimit, loadDraftImageFile, saveCloudSpotDraft, uploadDraftImage, uploadSpotImage } from '@/api/firebaseClient';
import { createDraftId, deleteGuestDraft, getGuestDraftOwnerKey, normalizeSpotDraft, saveGuestDraft } from '@/lib/spotDrafts';
import { deleteGuestDraftPhotos, loadGuestDraftPhoto, persistGuestDraftPhotos, pruneGuestDraftPhotos } from '@/lib/guestDraftPhotos';
import { IMAGE_ACCEPT, validateImageFileMetadata } from '@/lib/imageUploadValidation';
import { prepareContributionPhoto } from '@/lib/prepareContributionPhoto';
import { moderateSubmission } from '@/lib/moderation';
import { validateSocialPostUrl } from '@/lib/socialUrlPolicy';
import { getSpotDisplayName } from '@/lib/spotPresentation';
import NewPublishConfirmation from './NewPublishConfirmation';
import { NewLegalLink } from './legalRoutes';
import NewVoiceButton, { NewVoiceStatus } from './NewVoiceButton';
import { appendSpeechText, useVoiceInput } from './useVoiceInput';
import DraftConfirmationDialog from '@/components/ui/DraftConfirmationDialog';

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
const TIMES = [['sunrise', 'Východ slunce'], ['sunset', 'Západ slunce'], ['golden_hour', 'Zlatá hodinka'], ['night', 'Po setmění'], ['anytime', 'Kdykoli']];
const VIBE_TAGS = ['Viewpoint', 'SecretCafe', 'Sunset', 'Sunrise', 'PhotoSpot', 'Waterfall', 'Hike', 'SwimSpot', 'Ruin', 'UrbanExplore'];
const MAX_QUICK_PHOTOS = 5;
const optionSuffix = value => value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join('');
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

export default function QuickAddFlow({ coords, draft, hidden, user, onMove, onClose, onAuth, onViewSpot, onCreated, mode = 'create', spot, onUpdate }) {
  const { language, t } = useLanguage();
  const cs = language?.startsWith('cs');
  const L = (czech, english) => cs ? czech : english;
  const editing = mode === 'edit';
  const initial = useRef(editing ? null : normalizeSpotDraft(draft || { id: createDraftId(), ...coords }));
  const draftId = initial.current?.id;
  const [form, setForm] = useState(() => ({
    title: editing ? spot.title || '' : initial.current.title,
    category: editing ? spot.tags?.[0] || '' : initial.current.tags[0] || '',
    description: editing ? spot.description || '' : initial.current.description,
    cost: editing ? spot.cost || '' : initial.current.cost,
    difficulty: editing ? spot.access_difficulty || '' : initial.current.accessDifficulty,
    parking: editing ? spot.parking || '' : initial.current.parking,
    bestTime: (editing ? spot.best_time || [] : initial.current.bestTime).map(value => value === 'after_dark' ? 'night' : value),
    socialUrl: editing ? '' : initial.current.socialUrl,
  }));
  const existingPhotoUrls = useRef(editing ? (Array.isArray(spot.image_urls) && spot.image_urls.length ? spot.image_urls : [spot.image_url].filter(Boolean)) : []);
  const [photos, setPhotos] = useState(() => existingPhotoUrls.current.map((url, index) => ({ id: `existing-${index}`, url, existing: true })));
  const [photoLimit, setPhotoLimit] = useState(Math.max(3, existingPhotoUrls.current.length));
  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [ready, setReady] = useState(editing || !draft?.photo_refs?.length);
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
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [directions, setDirections] = useState(editing ? spot.directions || '' : '');
  const [extraTags, setExtraTags] = useState(editing ? (spot.tags || []).slice(1) : []);
  const photosRef = useRef([]);
  const lockRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const uploadedPublicPhotosRef = useRef(new Map());
  const latestRef = useRef(null);
  const revisionRef = useRef(0);
  const voice = useVoiceInput(language, (key, transcript) => {
    setForm(current => ({ ...current, [key]: appendSpeechText(current[key], transcript, key === 'title' ? 100 : 2000) }));
    setDuplicateCheck(null);
    setError('');
  });
  const cloud = Boolean(user && !user.isAnonymous);
  const ownerUidRef = useRef(getFirebaseServices().auth.currentUser?.uid || null);

  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => { let active = true; getSpotPhotoLimit().then(limit => { if (active) setPhotoLimit(Math.max(limit, existingPhotoUrls.current.length)); }); return () => { active = false; }; }, []);
  useEffect(() => { voice.stop(); }, [hidden, goodToKnow, voice.stop]);
  useEffect(() => () => { photosRef.current.forEach(photo => { if (!photo.existing) URL.revokeObjectURL(photo.url); }); }, []);
  useEffect(() => {
    if (editing || !draft?.photo_refs?.length) return undefined;
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
  }, [cloud, draft, photoReload, editing]);

  const update = (key, value) => { setForm(current => ({ ...current, [key]: value })); setDuplicateCheck(null); setError(''); };
  latestRef.current = { form, coords, photos, pendingPhotos };
  const saveDraft = () => {
    const snapshot = latestRef.current;
    const revision = revisionRef.current;
    const work = async () => {
      if (!ready) throw new Error('Počkej na načtení uložených fotografií.');
      if (snapshot.photos.length > MAX_QUICK_PHOTOS) throw new Error('Příliš mnoho fotografií.');
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
    if (editing || !ready || result) return undefined;
    revisionRef.current += 1;
    setSaveState('Neuložené změny');
    const timer = setTimeout(() => { saveDraft().catch(cause => { setSaveState('Automatické uložení se nezdařilo'); console.error('Quick add draft save failed', { stage: 'autosave', code: cause?.cause?.code || cause?.code || cause?.name || 'unknown' }); }); }, 1200);
    return () => clearTimeout(timer);
  }, [form, coords, photos, pendingPhotos, ready, result, editing]);

  const selectPhotos = async event => {
    const picked = [...(event.target.files || [])];
    event.target.value = '';
    if (!picked.length || preparing || busy) return;
    if (picked.length > photoLimit - photosRef.current.length - pendingPhotos.length) {
      setError(L(`K jednomu místu lze přidat nejvýše ${photoLimit} fotografií. Vyber méně souborů.`, `You can add up to ${photoLimit} photos. Choose fewer files.`));
      return;
    }
    setPreparing(true); setError('');
    for (let index = 0; index < picked.length; index += 1) {
      const source = picked[index];
      try {
        validateImageFileMetadata(source);
        const prepared = await prepareContributionPhoto(source);
        const photo = { id: createDraftId(), file: prepared.file, url: URL.createObjectURL(prepared.file), ref: null, diagnostic: prepared.original };
        const next = [...photosRef.current, photo];
        photosRef.current = next; setPhotos(next);
      } catch (cause) {
        photoLog('preparation', photosRef.current.length + index, { file: source }, cause);
        setPendingPhotos(current => [...current, { id: createDraftId(), file: source }]);
        setError(L(`Fotografii ${source.name || index + 1} se nepodařilo připravit. Zkus JPEG kopii.`, `Photo ${source.name || index + 1} could not be prepared. Try a JPEG copy.`));
      }
    }
    setPreparing(false);
  };
  const replacePhoto = async (index, event) => {
    const source = event.target.files?.[0];
    event.target.value = '';
    if (!source || preparing || busy) return;
    setPreparing(true); setError('');
    try {
      validateImageFileMetadata(source);
      const prepared = await prepareContributionPhoto(source);
      const previous = photosRef.current[index];
      if (!previous) return;
      const photo = { id: createDraftId(), file: prepared.file, url: URL.createObjectURL(prepared.file), ref: null, diagnostic: prepared.original };
      const next = [...photosRef.current]; next[index] = photo;
      photosRef.current = next; setPhotos(next); setActivePhoto(index);
      if (!previous.existing) URL.revokeObjectURL(previous.url);
    } catch (cause) {
      photoLog('replacement', index, { file: source }, cause);
      setError(L(`Fotografii ${index + 1} se nepodařilo nahradit. Zkus JPEG kopii.`, `Photo ${index + 1} could not be replaced. Try a JPEG copy.`));
    } finally { setPreparing(false); }
  };
  const retryPendingPhoto = async pending => {
    if (preparing || busy) return;
    setPreparing(true); setError('');
    try {
      const prepared = await prepareContributionPhoto(pending.file);
      const photo = { id: createDraftId(), file: prepared.file, url: URL.createObjectURL(prepared.file), ref: null, diagnostic: prepared.original };
      setPhotos(current => { const next = [...current, photo]; photosRef.current = next; return next; });
      setPendingPhotos(current => current.filter(item => item.id !== pending.id));
    } catch (cause) { photoLog('preparation-retry', photosRef.current.length, { file: pending.file }, cause); setError(L(`Fotografii ${pending.file.name || ''} se stále nedaří připravit. Vyber JPEG kopii nebo ji odeber.`, `Photo ${pending.file.name || ''} still cannot be prepared. Choose a JPEG copy or remove it.`)); }
    finally { setPreparing(false); }
  };
  const removePhoto = index => setPhotos(current => { const next = current.filter((_, i) => i !== index); if (!current[index].existing) URL.revokeObjectURL(current[index].url); photosRef.current = next; setActivePhoto(value => Math.min(value, Math.max(0, next.length - 1))); return next; });
  const movePhoto = (from, to) => setPhotos(current => { if (to < 0 || to >= current.length) return current; const next = [...current]; next.splice(to, 0, next.splice(from, 1)[0]); photosRef.current = next; setActivePhoto(to); return next; });
  const photoDirty = editing && JSON.stringify(photos.map(photo => photo.existing ? photo.url : photo.id)) !== JSON.stringify(existingPhotoUrls.current);
  const editDirty = editing && (form.title !== (spot.title || '') || form.description !== (spot.description || '') ||
    form.category !== (spot.tags?.[0] || '') || form.cost !== (spot.cost || '') ||
    form.difficulty !== (spot.access_difficulty || '') || form.parking !== (spot.parking || '') ||
    JSON.stringify(form.bestTime) !== JSON.stringify((spot.best_time || []).map(value => value === 'after_dark' ? 'night' : value)) ||
    directions !== (spot.directions || '') || JSON.stringify(extraTags) !== JSON.stringify((spot.tags || []).slice(1)) || photoDirty || pendingPhotos.length > 0);
  const saveEdit = async () => {
    if (!editing || lockRef.current || preparing || busy) return;
    if (!editDirty) { onClose(); return; }
    if (!form.title.trim() || !form.category) { setError(language?.startsWith('cs') ? 'Vyplň název a vyber kategorii.' : 'Enter a name and choose a category.'); return; }
    if (pendingPhotos.length || photos.length > photoLimit) { setError(language?.startsWith('cs') ? 'Oprav fotografie před uložením.' : 'Resolve photo issues before saving.'); return; }
    if (photos.some(photo => !photo.existing) && !rights) { setError(language?.startsWith('cs') ? 'Potvrď právo sdílet nové fotografie.' : 'Confirm your right to share the new photos.'); return; }
    const currentUid = getFirebaseServices().auth.currentUser?.uid;
    const ownsSpot = currentUid && (spot.created_by_uid ? spot.created_by_uid === currentUid : spot.created_by && spot.created_by === user?.email);
    if (!ownsSpot) {
      setError(language?.startsWith('cs') ? 'Toto místo může upravit jen jeho autor.' : 'Only the creator can edit this spot.'); return;
    }
    lockRef.current = true;
    setBusy('saving'); setError('');
    try {
      const patch = {};
      if (form.title !== (spot.title || '')) patch.title = form.title;
      if (form.description !== (spot.description || '')) patch.description = form.description;
      if (form.category !== (spot.tags?.[0] || '') || JSON.stringify(extraTags) !== JSON.stringify((spot.tags || []).slice(1))) patch.tags = [form.category, ...extraTags.filter(tag => tag !== form.category)];
      if (form.cost !== (spot.cost || '')) patch.cost = form.cost;
      if (form.difficulty !== (spot.access_difficulty || '')) patch.access_difficulty = form.difficulty;
      if (form.parking !== (spot.parking || '')) patch.parking = form.parking;
      if (JSON.stringify(form.bestTime) !== JSON.stringify((spot.best_time || []).map(value => value === 'after_dark' ? 'night' : value))) patch.best_time = form.bestTime;
      if (directions !== (spot.directions || '')) patch.directions = directions;
      if (photoDirty) {
        const urls = [];
        for (const photo of photos) {
          if (photo.existing) urls.push(photo.url);
          else {
            let url = uploadedPublicPhotosRef.current.get(photo.id);
            if (!url) { url = await uploadSpotImage(photo.file); uploadedPublicPhotosRef.current.set(photo.id, url); }
            urls.push(url);
          }
        }
        patch.image_urls = urls;
        patch.image_url = urls[0] || null;
      }
      await onUpdate(patch);
    } catch (cause) {
      setError(language?.startsWith('cs') ? 'Změny se nepodařilo uložit. Úpravy zůstaly ve formuláři.' : 'Changes could not be saved. Your edits are still here.');
      console.error('Spot edit failed', { code: cause?.code || cause?.name || 'unknown' });
    } finally { lockRef.current = false; setBusy(''); }
  };
  const close = async () => {
    if (lockRef.current || preparing) return;
    if (editing) { if (editDirty) setConfirmDiscard(true); else onClose(); return; }
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
    if (photos.length > photoLimit) { setError(`Server aktuálně podporuje nejvýše ${photoLimit} fotografie. Před odesláním některé odeber.`); return; }
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
    if (photos.length > photoLimit) { setError(`Server aktuálně podporuje nejvýše ${photoLimit} fotografie. Před odesláním některé odeber.`); return; }
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

  const categoryChoices = editing && form.category && !CATEGORIES.some(item => item.tag === form.category)
    ? [...CATEGORIES, { tag: form.category, label: t(`spotTags.${form.category}`, form.category) }] : CATEGORIES;
  if (hidden) return null;
  if (result) return <NewPublishConfirmation spot={result} socialWarning={socialWarning} onBack={onClose} onView={onViewSpot} onUpdated={updated => { setResult(updated); onCreated(updated); }} />;
  return <section className="sf-new-quick-add" aria-label={editing ? L('Upravit místo', 'Edit spot') : L('Nové místo', 'New spot')} data-unsaved-work={editing && editDirty ? 'true' : undefined}>
    <header className="sf-new-quick-header"><button type="button" onClick={goodToKnow ? () => setGoodToKnow(false) : close} aria-label={goodToKnow ? L('Zpět', 'Back') : editing ? L('Zavřít úpravy', 'Close editor') : L('Uložit a zavřít', 'Save and close')}>{goodToKnow ? <ChevronLeft /> : <X />}</button><h1>{goodToKnow ? L('Dobré vědět', 'Good to know') : editing ? L('Upravit místo', 'Edit spot') : L('Nové místo', 'New spot')}</h1><span /></header>
    {goodToKnow ? <div className="sf-new-quick-body sf-new-quick-good">
      <h2>{L('Co pomůže ostatním?', 'What helps others?')}</h2><p>{L('Volitelné detaily usnadní plánování návštěvy.', 'Optional details make a visit easier to plan.')}</p>
      {[[COST, L('Cena', 'Cost'), 'cost', 'cost'], [EFFORT, L('Náročnost', 'Getting there'), 'difficulty', 'access'], [PARKING, L('Parkování', 'Parking'), 'parking', 'parking']].map(([options, label, key, translation]) => <div className="sf-new-quick-field" key={key}><strong>{label}</strong><div className="sf-new-quick-chips">{options.map(([value, text]) => <button type="button" className={form[key] === value ? 'selected' : ''} key={value} onClick={() => update(key, form[key] === value ? '' : value)}>{cs ? text : t(`addSpot.${translation}${optionSuffix(value)}`)}</button>)}</div></div>)}
      <div className="sf-new-quick-field"><strong>{L('Nejlepší čas', 'Best time to visit')}</strong><div className="sf-new-quick-chips">{TIMES.map(([value, text]) => <button type="button" className={form.bestTime.includes(value) ? 'selected' : ''} key={value} onClick={() => update('bestTime', value === 'anytime' ? (form.bestTime.includes(value) ? [] : [value]) : form.bestTime.includes(value) ? form.bestTime.filter(item => item !== value) : [...form.bestTime.filter(item => item !== 'anytime'), value])}>{cs ? text : t(`addSpot.bestTime${optionSuffix(value)}`)}</button>)}</div></div>
      {editing && <div className="sf-new-quick-field"><strong>{L('Vibe a další štítky', 'Vibe and additional tags')}</strong><div className="sf-new-quick-chips">{[...new Set([...VIBE_TAGS, ...extraTags])].filter(tag => tag !== form.category).map(tag => <button type="button" key={tag} className={extraTags.includes(tag) ? 'selected' : ''} aria-pressed={extraTags.includes(tag)} onClick={() => setExtraTags(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag])}>{tag === 'Other' ? L('Jiné', 'Other') : t(`spotTags.${tag}`, tag)}</button>)}</div></div>}
      <label className="sf-new-quick-field"><strong>{L('Krátký popis', 'Description')}</strong><span className="sf-new-quick-textarea"><textarea maxLength={2000} value={form.description} onChange={event => update('description', event.target.value)} placeholder={L('Co je na místě zajímavé?', 'What makes this place worth visiting?')} /><NewVoiceButton voice={voice} field="description" label={L('Nadiktovat popis', 'Dictate description')} /></span><NewVoiceStatus voice={voice} field="description" /></label>
      {editing && <label className="sf-new-quick-field"><strong>{L('Jak se tam dostat', 'Getting there')}</strong><span className="sf-new-quick-textarea"><textarea maxLength={1000} value={directions} onChange={event => setDirections(event.target.value)} placeholder={L('Popiš cestu k místu.', 'Describe how to reach the spot.')} /></span></label>}
    </div> : <div className="sf-new-quick-body">
      <div className="sf-new-quick-photo-area"><span className="sf-new-quick-photo-count" aria-live="polite">{photos.length + pendingPhotos.length} / {photoLimit}</span>{photos.length ? <><img className="sf-new-quick-hero" src={photos[activePhoto]?.url || photos[0].url} alt={L(`Fotografie ${activePhoto + 1}`, `Photo ${activePhoto + 1}`)} /><div className="sf-new-quick-thumbs">{photos.map((photo, index) => <div key={photo.id}><button type="button" className={activePhoto === index ? 'selected' : ''} onClick={() => setActivePhoto(index)}><img src={photo.url} alt={L(`Vybrat fotografii ${index + 1}`, `Select photo ${index + 1}`)} /></button><button type="button" aria-label={L(`Odebrat fotografii ${index + 1}`, `Remove photo ${index + 1}`)} onClick={() => removePhoto(index)}><X size={14} /></button><label className="sf-new-quick-replace"><Camera size={14} aria-hidden="true" /><input type="file" aria-label={L(`Nahradit fotografii ${index + 1}`, `Replace photo ${index + 1}`)} accept={IMAGE_ACCEPT} onChange={event => replacePhoto(index, event)} disabled={preparing || !!busy} /></label><button type="button" aria-label={L(`Posunout fotografii ${index + 1} doleva`, `Move photo ${index + 1} left`)} disabled={index === 0} onClick={() => movePhoto(index, index - 1)}>←</button><button type="button" aria-label={L(`Posunout fotografii ${index + 1} doprava`, `Move photo ${index + 1} right`)} disabled={index === photos.length - 1} onClick={() => movePhoto(index, index + 1)}>→</button></div>)}</div></> : <div className="sf-new-quick-photo-empty"><ImagePlus size={31} /><strong>{L('Přidej fotky místa', 'Add photos of the spot')}</strong><span>{L(`Volitelné · maximálně ${photoLimit} fotografií`, `Optional · up to ${photoLimit} photos`)}</span></div>}
        {photos.length + pendingPhotos.length < photoLimit && <div className="sf-new-quick-photo-actions"><label><Camera size={17} /> {L('Fotoaparát', 'Camera')}<input type="file" accept={IMAGE_ACCEPT} capture="environment" onChange={selectPhotos} disabled={preparing || !!busy} /></label><label><ImagePlus size={17} /> {L('Galerie', 'Gallery')}<input type="file" accept={IMAGE_ACCEPT} multiple onChange={selectPhotos} disabled={preparing || !!busy} /></label></div>}
      </div>
      {photos.length > photoLimit && <p className="sf-new-quick-error" role="alert">{L(`Server aktuálně podporuje nejvýše ${photoLimit} fotografie. Před uložením některé odeber.`, `The current limit is ${photoLimit} photos. Remove some before saving.`)}</p>}
      {pendingPhotos.map(pending => <div className="sf-new-quick-pending" key={pending.id}><span>{pending.file.name || L('Nepřipravená fotografie', 'Unprepared photo')}</span><button type="button" onClick={() => retryPendingPhoto(pending)} disabled={preparing || !!busy}>{L('Zkusit znovu', 'Retry')}</button><button type="button" onClick={() => setPendingPhotos(current => current.filter(item => item.id !== pending.id))}>{L('Odebrat', 'Remove')}</button></div>)}
      {photos.some(photo => !editing || !photo.existing) && <label className="sf-new-quick-check"><input type="checkbox" checked={rights} onChange={event => setRights(event.target.checked)} /> {L('Mám právo tyto fotografie sdílet.', 'I have the right to share these photos.')}</label>}
      <label className="sf-new-quick-field"><strong>{L('Název místa *', 'Spot name *')}</strong><span className="sf-new-quick-input"><input maxLength={100} value={form.title} onChange={event => update('title', event.target.value)} placeholder={L('Jak se místo jmenuje?', 'What is this place called?')} /><NewVoiceButton voice={voice} field="title" label={L('Nadiktovat název', 'Dictate name')} /></span><NewVoiceStatus voice={voice} field="title" /></label>
      <div className="sf-new-quick-field"><strong>{L('O jaké místo jde? *', 'What kind of place is it? *')}</strong><div className="sf-new-quick-chips">{categoryChoices.map(item => <button type="button" className={form.category === item.tag ? 'selected' : ''} key={item.tag} onClick={() => update('category', item.tag)}>{cs ? item.label : item.tag === 'Other' ? 'Other' : t(`spotTags.${item.tag}`, item.label)}</button>)}</div></div>
      <div className="sf-new-quick-location"><MapPin size={21} /><div><strong>{L('Poloha', 'Location')}</strong><small>{validCoords(coords) ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : L('Poloha není dostupná', 'Location unavailable')}</small></div>{!editing && <button type="button" onClick={onMove}>{L('Upravit', 'Change')}</button>}</div>
      <button type="button" className="sf-new-quick-more" onClick={() => setGoodToKnow(true)}><span><strong>{L('Dobré vědět', 'Good to know')}</strong><small>{L('Cena, cesta, parkování a krátký popis · volitelné', 'Cost, access, parking and description · optional')}</small></span><ChevronRight size={20} /></button>
      {!editing && <><label className="sf-new-quick-field"><strong>{L('Instagram nebo TikTok · volitelné', 'Instagram or TikTok · optional')}</strong><input type="url" value={form.socialUrl} onChange={event => update('socialUrl', event.target.value)} placeholder="https://www.instagram.com/p/…" autoCapitalize="off" /></label>
      <p className="sf-new-quick-note">{L('Když nepřidáš popis, odešle se stručný popis podle názvu a kategorie. Zveřejnění podléhá kontrole.', 'If you leave the description empty, a short one will be created from the name and category. Publication is reviewed.')}</p>
      <label className="sf-new-quick-check"><input type="checkbox" checked={attested} onChange={event => setAttested(event.target.checked)} /> <span>{L('Souhlasím s', 'I agree to the')} <NewLegalLink document="/TermsAndConditions" target="_blank" rel="noopener noreferrer">{L('podmínkami přidávání míst', 'spot contribution terms')}</NewLegalLink>.</span></label></>}
      {duplicateCheck && <div className="sf-new-quick-duplicates"><strong>Podobná místa poblíž</strong><p>Podívej se, jestli už místo na mapě není. Pokud jde o jiné místo, pokračuj.</p>{duplicateCheck.map(spot => <button type="button" key={spot.id} onClick={() => viewDuplicate(spot)}>{getSpotDisplayName(spot, 'cs')} <span>Zobrazit</span></button>)}<button type="button" className="sf-new-quick-primary" onClick={() => publish(form.socialUrl.trim() ? validateSocialPostUrl(form.socialUrl.trim()) : null)}>Přesto odeslat</button></div>}
      {error && <p className="sf-new-quick-error" role="alert">{error} <button type="button" onClick={() => { setError(''); if (!ready) setPhotoReload(value => value + 1); }}>{!ready ? L('Zkusit znovu', 'Retry') : L('Zavřít', 'Dismiss')}</button></p>}
    </div>}
    <footer className="sf-new-quick-footer">{goodToKnow ? <button className="sf-new-quick-primary" type="button" onClick={() => setGoodToKnow(false)}>{L('Hotovo', 'Done')}</button> : editing ? <><p className="sf-new-quick-save-status" role="status">{preparing ? L('Připravuji fotografie…', 'Preparing photos…') : busy === 'saving' ? L('Ukládám změny…', 'Saving changes…') : editDirty ? L('Neuložené změny', 'Unsaved changes') : ''}</p><div className="sf-new-quick-buttons"><button type="button" onClick={close} disabled={!!busy || preparing}>{L('Zrušit', 'Cancel')}</button><button type="button" className="sf-new-quick-primary" onClick={saveEdit} disabled={!!busy || preparing || !!pendingPhotos.length || !form.title.trim() || !form.category}>{L('Uložit změny', 'Save changes')}</button></div></> : <><p className="sf-new-quick-save-status" role="status">{preparing ? 'Připravuji fotografie…' : busy === 'publishing' ? `Odesílám místo… ${progress ? `${progress} %` : ''}` : busy === 'checking' ? 'Hledám podobná místa…' : busy === 'draft' ? `Ukládám… ${progress ? `${progress} %` : ''}` : saveState}</p><div className="sf-new-quick-buttons"><button type="button" onClick={close} disabled={!!busy || preparing || !ready}>Uložit návrh</button><button type="button" className="sf-new-quick-primary" onClick={beginPublish} disabled={!!busy || preparing || !ready || !!pendingPhotos.length || !form.title.trim() || !form.category || !validCoords(coords)}>Odeslat místo</button></div></>}</footer>
    {editing && <DraftConfirmationDialog open={confirmDiscard} onOpenChange={setConfirmDiscard} title={L('Zahodit neuložené změny?', 'Discard unsaved changes?')} description={L('Úpravy tohoto místa nebyly uloženy.', 'Your edits to this spot have not been saved.')} cancelLabel={L('Pokračovat v úpravách', 'Keep editing')} confirmLabel={L('Zahodit změny', 'Discard changes')} onConfirm={onClose} destructive />}
  </section>;
}
