import React, { useEffect, useState, useRef } from 'react';
import { X, Camera, MapPin, Mic, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import StarRating from './StarRating';
import LabeledRatingScale from './LabeledRatingScale';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { deleteCloudSpotDraft, loadDraftImageFile, saveCloudSpotDraft, uploadDraftImage, uploadSpotImage } from '@/api/firebaseClient';
import { INVALID_SOCIAL_URL_MESSAGE, validateSocialPostUrl } from '@/lib/socialUrlPolicy';
import { moderateSubmission } from '@/lib/moderation';
import { findNearbyPoi } from '@/lib/nearbyPoi';
import { toast } from 'sonner';
import LiquidSegmentedControl from '../ui/LiquidSegmentedControl';
import DraftConfirmationDialog from '../ui/DraftConfirmationDialog';
import { draftToast } from '../ui/draftToast';
import { IMAGE_ACCEPT, validateImageFileMetadata } from '@/lib/imageUploadValidation';
import { hasMeaningfulAddSpotDraft, validateRequiredSpotFields, voiceErrorMessage } from '@/lib/contributionFlow';
import { createDraftId, deleteGuestDraft, getGuestDraftOwnerKey, normalizeSpotDraft, saveGuestDraft } from '@/lib/spotDrafts';
import { deleteGuestDraftPhotos, loadGuestDraftPhoto, persistGuestDraftPhotos, pruneGuestDraftPhotos } from '@/lib/guestDraftPhotos';

// Category tags per spec — separate from the existing rating-group `spotType`.
// A spot can carry several of these. Display uses an emoji + translated label
// where one exists (addSpot.tag<Name>); falls back to the raw tag name.
const AVAILABLE_TAGS = [
  { id: 'Viewpoint', emoji: '🏞️' },
  { id: 'SecretCafe', emoji: '☕' },
  { id: 'Sunset', emoji: '🌇' },
  { id: 'Sunrise', emoji: '🌅' },
  { id: 'PhotoSpot', emoji: '📸' },
  { id: 'Waterfall', emoji: '💦' },
  { id: 'Hike', emoji: '🥾' },
  { id: 'SwimSpot', emoji: '🏊' },
  { id: 'Ruin', emoji: '🏛️' },
  { id: 'UrbanExplore', emoji: '🏙️' },
  { id: 'Mountain', emoji: '⛰️' },
];
// Each option maps to an addSpot.<prefix><CapitalizedOption> translation key.
const COST_OPTIONS = ['free', 'paid', 'donation'];
const ACCESS_OPTIONS = ['easy', 'moderate', 'hard'];
const PARKING_OPTIONS = ['yes', 'no', 'street', 'paid'];
const BEST_TIME_OPTIONS = ['sunrise', 'sunset', 'golden_hour', 'night', 'anytime'];

// snake_case option -> CamelCase suffix for translation key lookup, e.g. 'golden_hour' -> 'GoldenHour'
const toKeySuffix = (opt) => opt.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join('');

// Language code → BCP-47 for Web Speech API
const LANG_TO_BCP47 = {
  en: 'en-US', cs: 'cs-CZ', pl: 'pl-PL', de: 'de-DE', sk: 'sk-SK',
  it: 'it-IT', fr: 'fr-FR', ru: 'ru-RU', uk: 'uk-UA', hu: 'hu-HU',
  ro: 'ro-RO', es: 'es-ES', bg: 'bg-BG',
};

export default function AddSpotModal({ latlng, draft = null, onClose, onSave, user }) {
  const { authUid } = useAuth();
  const { t, language } = useLanguage();
  const spotType = 'general';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [overallRating, setOverallRating] = useState(0);
  const [accessRating, setAccessRating] = useState(0);
  const [conditionRating, setConditionRating] = useState(0);
  const [safetyRating, setSafetyRating] = useState(0);
  const [crowdednessRating, setCrowdednessRating] = useState(0);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [micError, setMicError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [socialUrl, setSocialUrl] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [attested, setAttested] = useState(false);
  const [showCloseChoices, setShowCloseChoices] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [draftPhotoRefs, setDraftPhotoRefs] = useState([]);
  const [draftPhotosReady, setDraftPhotosReady] = useState(true);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoReloadKey, setPhotoReloadKey] = useState(0);

  // ── New fields per submission spec ──────────────────────────────────────────
  const [tags, setTags] = useState([]);
  const [cost, setCost] = useState('');
  const [accessDifficulty, setAccessDifficulty] = useState('');
  const [parking, setParking] = useState('');
  const [bestTime, setBestTime] = useState([]);
  const [directions, setDirections] = useState('');

  // Duplicate detection disabled for now (requires findNearbySpots in firebaseClient.js)

  const toggleTag = (tag) => setTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag]);
  const toggleBestTime = (val) => setBestTime(times => val === 'anytime'
    ? (times.includes('anytime') ? [] : ['anytime'])
    : (times.includes(val) ? times.filter(item => item !== val) : [...times.filter(item => item !== 'anytime'), val]));

  const recognitionRef = useRef(null);
  const submitLockRef = useRef(false);
  const committedRef = useRef(''); // tracks already-committed final transcript
  const titleRef = useRef(null);
  const descriptionRef = useRef(null);
  const errorSummaryRef = useRef(null);
  const draftIdRef = useRef(draft?.id || createDraftId());
  const currentDraft = normalizeSpotDraft({ id: draftIdRef.current, lat: latlng?.lat, lng: latlng?.lng, title, description, tags, cost, accessDifficulty, parking, bestTime, directions, socialUrl, overallRating, accessRating, conditionRating, safetyRating, crowdednessRating, photo_refs: draftPhotoRefs, created_at: draft?.created_at });

  useEffect(() => {
    let active = true;
    let restoredUrls = [];
    if (!draft) return undefined;
    const restore = async () => {
      const restored = normalizeSpotDraft(draft);
      setTitle(restored.title);
      setDescription(restored.description);
      setTags(restored.tags);
      setCost(restored.cost);
      setAccessDifficulty(restored.accessDifficulty);
      setParking(restored.parking);
      setBestTime(restored.bestTime);
      setDirections(restored.directions);
      setSocialUrl(restored.socialUrl);
      setOverallRating(restored.overallRating);
      setAccessRating(restored.accessRating);
      setConditionRating(restored.conditionRating);
      setSafetyRating(restored.safetyRating);
      setCrowdednessRating(restored.crowdednessRating);
      setDraftPhotoRefs(restored.photo_refs);
      if (restored.photo_refs.length) {
        setDraftPhotosReady(false);
        setDraftError('');
        try {
          const ownerKey = user ? '' : getGuestDraftOwnerKey(localStorage);
          const files = await Promise.all(restored.photo_refs.map(ref => user ? loadDraftImageFile(ref) : loadGuestDraftPhoto(ref, ownerKey)));
          if (!active) return;
          setImageFiles(files);
          restoredUrls = files.map(file => URL.createObjectURL(file));
          setImagePreviews(restoredUrls);
          setDraftPhotosReady(true);
        } catch (error) {
          if (active) setDraftError(error?.message || 'The draft was restored, but one or more private photos could not be loaded.');
        }
      }
    };
    restore();
    return () => { active = false; restoredUrls.forEach(url => URL.revokeObjectURL(url)); };
  }, [draft?.id, user?.id, photoReloadKey]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const requestClose = () => {
    if (loading || savingDraft) return;
    if (hasMeaningfulAddSpotDraft(currentDraft) || imageFiles.length) {
      setShowCloseChoices(true);
      return;
    }
    onClose();
  };

  const handleSaveDraft = async () => {
    if (savingDraft) return;
    setSavingDraft(true);
    setDraftError('');
    try {
      if (!draftPhotosReady) throw new Error('Private draft photos are not available yet. Check your connection and try again.');
      let refs = draftPhotoRefs;
      if (user) {
        const uploaded = [];
        for (let index = 0; index < imageFiles.length; index += 1) {
          if (refs[index]?.path) { uploaded.push(refs[index]); continue; }
          let lastError;
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              uploaded.push(await uploadDraftImage(imageFiles[index], draftIdRef.current, fraction => setPhotoProgress(Math.round(((index + fraction) / imageFiles.length) * 100))));
              lastError = null;
              break;
            } catch (error) { lastError = error; }
          }
          if (lastError) throw lastError;
        }
        refs = uploaded;
        setDraftPhotoRefs(uploaded);
        await saveCloudSpotDraft({ ...currentDraft, photo_refs: uploaded });
      } else {
        const ownerKey = getGuestDraftOwnerKey(localStorage);
        const localRefs = imageFiles.length ? await persistGuestDraftPhotos(ownerKey, draftIdRef.current, imageFiles) : [];
        saveGuestDraft(localStorage, ownerKey, { ...currentDraft, photo_refs: localRefs });
        await pruneGuestDraftPhotos(ownerKey, draftIdRef.current, localRefs).catch(error => console.warn('Old guest draft photo cleanup failed:', error));
        setDraftPhotoRefs(localRefs);
      }
      draftToast.saved();
      window.dispatchEvent(new CustomEvent('spotfinder:drafts-changed'));
      onClose();
    } catch (error) {
      console.error('Draft save failed:', error);
      setDraftError(error?.message || 'The draft could not be saved. Your form is still open.');
      draftToast.saveFailed();
      setShowCloseChoices(false);
      focusError(errorSummaryRef);
    } finally {
      setSavingDraft(false);
      setPhotoProgress(0);
    }
  };

  const focusError = (fieldRef = errorSummaryRef) => {
    requestAnimationFrame(() => {
      fieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fieldRef.current?.focus({ preventScroll: true });
    });
  };

  const handleImageChange = (e) => {
    const remaining = 3 - imageFiles.length;
    const selected = Array.from(e.target.files || []).filter(file => {
      try { validateImageFileMetadata(file); return true; }
      catch (error) { toast.error(error.message); return false; }
    });
    if (!remaining || !selected.length) return;
    const accepted = selected.slice(0, remaining);
    setImageFiles(current => [...current, ...accepted]);
    setImagePreviews(current => [...current, ...accepted.map(file => URL.createObjectURL(file))]);
    setDraftPhotoRefs(current => [...current, ...accepted.map(() => null)]);
    if (selected.length > remaining) toast.info('You can add up to 3 photos per spot.');
    e.target.value = '';
  };

  const removeImage = (index) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles(current => current.filter((_, itemIndex) => itemIndex !== index));
    setImagePreviews(current => current.filter((_, itemIndex) => itemIndex !== index));
    setDraftPhotoRefs(current => current.filter((_, itemIndex) => itemIndex !== index));
  };

  // Voice dictation
  const toggleVoice = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError(voiceErrorMessage('unsupported'));
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    // Check microphone availability before starting
    setMicError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
        setMicError(voiceErrorMessage('unsupported'));
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some(d => d.kind === 'audioinput');
      if (!hasMic) {
        setMicError(voiceErrorMessage('no-device'));
        return;
      }
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setMicError(voiceErrorMessage(err));
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = LANG_TO_BCP47[language] || 'en-US';
    rec.continuous = true;
    rec.interimResults = true;

    committedRef.current = description; // snapshot current text

    rec.onresult = (event) => {
      // KEY FIX: start from event.resultIndex, not 0 — prevents replaying old results
      let newFinal = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinal += t;
        } else {
          interim += t;
        }
      }

      // Append only newly finalized text to the committed snapshot
      if (newFinal) {
        const sep = committedRef.current && !committedRef.current.endsWith(' ') ? ' ' : '';
        committedRef.current = committedRef.current + sep + newFinal.trim();
        setDescription(committedRef.current);
      }

      // Show live interim preview (doesn't modify committed text)
      setInterimText(interim);
    };
    rec.onerror = (e) => {
      setListening(false);
      setInterimText('');
      setMicError(voiceErrorMessage(e));
    };
    rec.onend = () => { setListening(false); setInterimText(''); };
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  const handleSave = async () => {
    if (loading || submitLockRef.current) return;
    setSubmitError('');
    if (!draftPhotosReady && !(draft && user && draftPhotoRefs.length)) {
      setSubmitError('Private draft photos could not be loaded. Reconnect and resume the draft before publishing.');
      focusError(errorSummaryRef);
      return;
    }
    const requiredErrors = validateRequiredSpotFields({ title, description, attested });
    if (Object.keys(requiredErrors).length) {
      setFieldErrors(requiredErrors);
      const firstError = requiredErrors.title || requiredErrors.description || requiredErrors.attested;
      setSubmitError(firstError);
      focusError(requiredErrors.title ? titleRef : requiredErrors.description ? descriptionRef : errorSummaryRef);
      return;
    }
    setFieldErrors({});

    const socialValidation = socialUrl ? validateSocialPostUrl(socialUrl) : null;
    if (socialUrl && !socialValidation?.ok) {
      toast.error(INVALID_SOCIAL_URL_MESSAGE);
      return;
    }
    if (socialUrl && (!user || user.isAnonymous || user.emailVerified !== true)) {
      toast.error('A verified account is required to add a social post.');
      return;
    }
    // Anti-spam / moderation pre-check (client-side UX only — the
    // authoritative check runs server-side in the Cloud Functions trigger
    // on `spots` creation; see functions/index.js).
    const modCheck = moderateSubmission({
      text: description,
      rateLimitKey: `rate:add_spot:${user?.email || 'anon'}`,
      maxPerWindow: 5,
      windowMs: 10 * 60 * 1000, // 5 new spots / 10 minutes / device
    });
    if (!modCheck.allowed) {
      // Note: 'moderation.*' keys don't exist in locales/translations.js —
      // t() falls back to returning the raw key string (not null/undefined)
      // for missing keys, so using `t(key) || fallback` here would silently
      // show the ugly key text to users instead of the fallback. Using
      // plain English directly until these are added to every language file.
      toast.error(
        modCheck.reasonKey === 'moderation.tooManySubmissions'
          ? 'You are adding spots too quickly. Please wait a few minutes and try again.'
          : 'This description looks like spam. Please rewrite it and try again.'
      );
      return;
    }

    // Overall is an explicit opinion; the practical scales describe the place
    // and are intentionally not averaged together into a fake star score.

    submitLockRef.current = true;
    setLoading(true);
    let image_urls = [];
    let failedImageUploads = 0;

    const nearbyPoiPromise = findNearbyPoi(Number(latlng.lat), Number(latlng.lng), language)
      .catch(error => {
        console.warn('Nearby POI matching skipped:', error);
        return null;
      });

    // A resumed account draft is published from its verified private Storage
    // objects by the server. Persist any photos added during this edit first.
    if (draft && user && imageFiles.length && draftPhotosReady) {
      try {
        setUploadingImage(true);
        const refs = [];
        for (let index = 0; index < imageFiles.length; index += 1) {
          if (draftPhotoRefs[index]?.path) { refs.push(draftPhotoRefs[index]); continue; }
          let uploaded;
          let lastError;
          for (let attempt = 0; attempt < 2 && !uploaded; attempt += 1) {
            try {
              uploaded = await uploadDraftImage(imageFiles[index], draftIdRef.current, fraction => setPhotoProgress(Math.round(((index + fraction) / imageFiles.length) * 100)));
            } catch (error) { lastError = error; }
          }
          if (!uploaded) throw lastError;
          refs.push(uploaded);
        }
        setDraftPhotoRefs(refs);
        await saveCloudSpotDraft({ ...currentDraft, photo_refs: refs });
      } catch (error) {
        setSubmitError(error?.message || 'The private photos could not be persisted. Your draft and form are still available.');
        submitLockRef.current = false;
        setLoading(false);
        setUploadingImage(false);
        setPhotoProgress(0);
        focusError(errorSummaryRef);
        return;
      }
    }

    if (imageFiles.length && !(draft && user)) {
      try {
        setUploadingImage(true);
        const uploads = await Promise.allSettled(imageFiles.map(file => uploadSpotImage(file)));
        image_urls = uploads.filter(result => result.status === 'fulfilled').map(result => result.value);
        failedImageUploads = uploads.length - image_urls.length;
        if (failedImageUploads) toast.error(`${failedImageUploads} photo${failedImageUploads === 1 ? '' : 's'} could not be uploaded.`);
      } catch (err) {
        console.error('Image uploads failed:', err);
      } finally {
        setUploadingImage(false);
      }
    }

    if (draft && failedImageUploads) {
      setSubmitError('The draft was not published because one or more saved photos could not be uploaded. Your draft is still available; check your connection and try again.');
      submitLockRef.current = false;
      setLoading(false);
      focusError(errorSummaryRef);
      return;
    }

    const poi_match = await nearbyPoiPromise;

    const baseData = {
      lat: latlng.lat,
      lng: latlng.lng,
      spot_type: spotType,
      title: title.trim(),
      description,
      rating: overallRating,
      rating_count: overallRating > 0 ? 1 : 0,
      image_url: image_urls[0] || null,
      image_urls,
      is_public: true,
      created_by: user?.email || 'anonymous',
      created_by_name: user?.displayName || user?.email?.split('@')[0] || 'Anonymous',
      created_by_uid: authUid || null,
      tags,
      cost,
      access_difficulty: accessDifficulty,
      parking,
      best_time: bestTime,
      directions,
      poi_match,
      submission_attestation: {
        accepted: true,
        photo_rights_confirmed: image_urls.length > 0,
      },
      _draft_id: draftIdRef.current,
    };

    Object.assign(baseData, {
      access_rating: accessRating, access_rating_count: accessRating > 0 ? 1 : 0,
      condition_rating: conditionRating, condition_rating_count: conditionRating > 0 ? 1 : 0,
      safety_rating: safetyRating, safety_rating_count: safetyRating > 0 ? 1 : 0,
      crowdedness_rating: crowdednessRating, crowdedness_rating_count: crowdednessRating > 0 ? 1 : 0,
      rating_schema: 2,
    });

    try {
      await onSave(baseData, socialValidation?.canonicalUrl || '');
      if (draft) {
        try {
          if (user) await deleteCloudSpotDraft(draftIdRef.current);
          else {
            const ownerKey = getGuestDraftOwnerKey(localStorage);
            deleteGuestDraft(localStorage, ownerKey, draftIdRef.current);
            await deleteGuestDraftPhotos(ownerKey, draftIdRef.current);
          }
        } catch (cleanupError) {
          console.warn('Published draft cleanup will be retried later:', cleanupError);
        }
        window.dispatchEvent(new CustomEvent('spotfinder:drafts-changed'));
      }
      draftToast.published();
      onClose();
    } catch (err) {
      console.error('Save failed:', err);
      const rawMessage = String(err?.message || '');
      const isDescriptionError = /description is required/i.test(rawMessage);
      const message = isDescriptionError
        ? t('addSpot.descriptionRequired')
        : rawMessage.replace(/^Firebase:\s*/i, '').replace(/\s*\[\d{3}\]\s*$/, '') || t('addSpot.saveErrorMessage');
      setSubmitError(message);
      if (isDescriptionError) {
        setFieldErrors(current => ({ ...current, description: message }));
        focusError(descriptionRef);
      } else {
        focusError(errorSummaryRef);
      }
    } finally {
      submitLockRef.current = false;
      setLoading(false);
      setUploadingImage(false);
      setPhotoProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="add-spot-title" onKeyDown={event => { if (event.key === 'Escape') requestClose(); }}>
      <div className="sf-sheet isolate w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl max-h-[100dvh] sm:max-h-[90dvh] sm:rounded-3xl">
        <div className="sticky top-0 z-30 bg-white/90 dark:bg-card/90 px-6 pt-5 pb-3 border-b border-gray-100/80 dark:border-border flex items-center justify-between backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-600" />
            <h2 id="add-spot-title" className="text-lg font-bold text-gray-900 dark:text-foreground">{draft ? 'Resume draft' : t('addSpot.title')}</h2>
          </div>
          <button type="button" onClick={requestClose} aria-label={t('common.close')} className="min-h-11 min-w-11 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-accent">
            <X className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {submitError && (
            <div
              ref={errorSummaryRef}
              role="alert"
              aria-live="assertive"
              tabIndex={-1}
              className="relative flex gap-3 rounded-2xl border border-red-200 bg-red-50/95 p-4 pr-11 text-red-950 shadow-[0_10px_30px_rgba(185,28,28,.10)] outline-none backdrop-blur-xl focus:ring-2 focus:ring-red-400 dark:border-red-900/70 dark:bg-red-950/45 dark:text-red-100"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/70 dark:text-red-300">
                <AlertCircle className="h-5 w-5" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-bold">{t('addSpot.saveErrorTitle')}</p>
                <p className="mt-1 text-xs leading-5 text-red-700 dark:text-red-200">{submitError}</p>
              </div>
              <button type="button" onClick={() => setSubmitError('')} aria-label={t('common.close')} className="absolute right-2.5 top-2.5 rounded-full p-1.5 text-red-500 transition hover:bg-red-100 dark:hover:bg-red-900/60">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {draftError && (
            <div ref={errorSummaryRef} role="alert" tabIndex={-1} className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 outline-none focus:ring-2 focus:ring-red-400 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div><p>{draftError}</p>{draftPhotoRefs.length > 0 && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setPhotoReloadKey(value => value + 1)} className="min-h-10 rounded-xl border border-red-300 px-3 font-semibold">Retry photos</button><button type="button" onClick={() => { setDraftPhotoRefs([]); setImageFiles([]); setImagePreviews([]); setDraftPhotosReady(true); setDraftError(''); }} className="min-h-10 rounded-xl border border-red-300 px-3 font-semibold">Remove missing photos</button></div>}</div>
            </div>
          )}

          <section aria-labelledby="essential-information-title" className="space-y-4">
            <div>
              <p id="essential-information-title" className="text-sm font-bold text-gray-900 dark:text-foreground">Essential information</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-muted-foreground">Name the place clearly and tell people what makes it worth finding.</p>
            </div>
            <div>
              <label htmlFor="new-spot-name" className="mb-1 block text-sm font-semibold text-gray-700 dark:text-foreground">Spot name <span className="text-red-500" aria-hidden="true">*</span></label>
              <input
                ref={titleRef}
                id="new-spot-name"
                value={title}
                maxLength={100}
                autoComplete="off"
                enterKeyHint="next"
                onChange={event => {
                  setTitle(event.target.value);
                  if (fieldErrors.title) setFieldErrors(current => ({ ...current, title: '' }));
                }}
                aria-invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? 'new-spot-name-error' : 'new-spot-name-help'}
                placeholder="e.g. Old Quarry Viewpoint"
                className={`w-full rounded-xl border bg-white px-4 py-3 text-base text-gray-900 outline-none focus:ring-2 dark:bg-background dark:text-foreground ${fieldErrors.title ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-green-500 dark:border-border'}`}
              />
              <p id="new-spot-name-help" className="mt-1.5 text-xs text-gray-500 dark:text-muted-foreground">Use the real local or commonly known name when one exists.</p>
              {fieldErrors.title && <p id="new-spot-name-error" className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.title}</p>}
            </div>

          {/* Description + voice */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="new-spot-description" className="text-sm font-semibold text-gray-600 dark:text-foreground">{t('addSpot.description')} <span className="text-red-500" aria-hidden="true">*</span></label>
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={listening ? 'Stop voice description' : 'Describe this spot by voice'}
                aria-pressed={listening}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  listening
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse'
                    : 'bg-gray-100 dark:bg-accent text-gray-600 dark:text-foreground hover:bg-gray-200'
                }`}
                title={listening ? t('addSpot.stopListening') : t('addSpot.startListening')}
              >
                {listening ? <Mic className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                {listening ? t('addSpot.listening') : t('addSpot.voice')}
              </button>
            </div>
            {micError && (
              <p role="status" className="mb-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{micError}</p>
            )}
            <textarea
              ref={descriptionRef}
              id="new-spot-description"
              value={description}
              onChange={e => {
                setDescription(e.target.value);
                if (fieldErrors.description && e.target.value.trim()) {
                  setFieldErrors(current => ({ ...current, description: '' }));
                  setSubmitError('');
                }
              }}
              onBlur={() => {
                if (!description.trim()) setFieldErrors(current => ({ ...current, description: t('addSpot.descriptionRequired') }));
              }}
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldErrors.description ? 'new-spot-description-error' : undefined}
              placeholder={t('addSpot.descPlaceholder')}
              inputMode="text"
              rows={3}
              className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-background text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm resize-none transition-colors ${
                fieldErrors.description
                  ? 'border-red-400 bg-red-50/40 focus:ring-red-300 dark:border-red-700 dark:bg-red-950/20'
                  : listening ? 'border-red-300 dark:border-red-600' : 'border-gray-200 focus:ring-green-500 dark:border-border'
              }`}
            />
            {fieldErrors.description && (
              <p id="new-spot-description-error" className="mt-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold text-red-600 dark:text-red-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {fieldErrors.description}
              </p>
            )}
            {interimText && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400 italic px-1">
                {interimText}…
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-accent/50 dark:text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
            <span>Map position: {Number(latlng.lat).toFixed(5)}, {Number(latlng.lng).toFixed(5)}</span>
          </div>
          </section>

          <details className="group rounded-2xl border border-gray-200 dark:border-border">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold marker:content-none">
              <span><span className="block">Optional enrichment</span><span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-muted-foreground">Ratings, practical details, photos and social links</span></span>
              <ChevronDown className="h-5 w-5 text-gray-400 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="space-y-5 border-t border-gray-200 p-4 dark:border-border">

          {/* Experience rating + descriptive scales (rating schema v2) */}
          <div className="rounded-2xl border border-gray-200 dark:border-border p-4 space-y-5">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-foreground mb-1 block">Overall experience</label>
              <p className="text-xs text-gray-500 dark:text-muted-foreground mb-2">How would you rate this spot overall?</p>
              <StarRating value={overallRating} onChange={setOverallRating} size="lg" />
            </div>
            <div><label className="text-sm font-semibold block mb-2">Ease of access</label><LabeledRatingScale value={accessRating} onChange={setAccessRating} labels={['Very difficult','Difficult','Moderate','Easy','Very easy']} /></div>
            <div><label className="text-sm font-semibold block mb-2">Condition & cleanliness</label><LabeledRatingScale value={conditionRating} onChange={setConditionRating} labels={['Very poor','Poor','Okay','Good','Excellent']} /></div>
            <div><label className="text-sm font-semibold block mb-2">Safety & comfort</label><LabeledRatingScale value={safetyRating} onChange={setSafetyRating} labels={['Very uncomfortable','Uncomfortable','Okay','Comfortable','Very safe']} /></div>
            <div><label className="text-sm font-semibold block mb-2">Crowdedness</label><LabeledRatingScale value={crowdednessRating} onChange={setCrowdednessRating} labels={['Very quiet','Quiet','Moderate','Busy','Very busy']} /></div>
          </div>

          {/* Category tags */}
          <div>
            <label className="text-sm font-semibold text-gray-600 dark:text-foreground mb-2 block">{t('addSpot.tags')}</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map(({ id, emoji }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleTag(id)}
                  className={`sf-glass-pill ${
                    tags.includes(id)
                      ? 'sf-glass-pill--selected sf-glass-pill--green'
                      : ''
                  }`}
                >
                  {emoji} #{id}
                </button>
              ))}
            </div>
          </div>

          {/* Practical details — pill selectors instead of plain dropdowns */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-foreground mb-1.5 block">{t('addSpot.cost')}</label>
              <LiquidSegmentedControl ariaLabel={t('addSpot.cost')} tone="green" value={cost} onChange={setCost} options={COST_OPTIONS.map(o => ({ value: o, label: t(`addSpot.cost${toKeySuffix(o)}`) }))} />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-foreground mb-1.5 block">{t('addSpot.accessDifficulty')}</label>
              <LiquidSegmentedControl ariaLabel={t('addSpot.accessDifficulty')} tone="orange" value={accessDifficulty} onChange={setAccessDifficulty} options={ACCESS_OPTIONS.map(o => ({ value: o, label: t(`addSpot.access${toKeySuffix(o)}`) }))} />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-foreground mb-1.5 block">{t('addSpot.parkingAvailability')}</label>
              <LiquidSegmentedControl ariaLabel={t('addSpot.parkingAvailability')} tone="blue" value={parking} onChange={setParking} options={PARKING_OPTIONS.map(o => ({ value: o, label: t(`addSpot.parking${toKeySuffix(o)}`) }))} />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 dark:text-foreground mb-1.5 block">{t('addSpot.bestTime')}</label>
              <div className="flex flex-wrap gap-1.5">
                {BEST_TIME_OPTIONS.map(o => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => toggleBestTime(o)}
                    className={`sf-glass-pill ${
                      bestTime.includes(o)
                        ? 'sf-glass-pill--selected sf-glass-pill--green'
                        : ''
                    }`}
                  >
                    {t(`addSpot.bestTime${toKeySuffix(o)}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Directions */}
          <div>
            <label className="text-sm font-semibold text-gray-600 dark:text-foreground mb-1 block">{t('addSpot.directions')}</label>
            <textarea
              value={directions}
              onChange={e => setDirections(e.target.value)}
              placeholder={t('addSpot.directionsPlaceholder')}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm resize-none"
            />
          </div>

          {/* Photos */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-600 dark:text-foreground">Photos</label>
              <span className="text-xs text-gray-400 dark:text-muted-foreground">{imageFiles.length}/3</span>
            </div>
            {imagePreviews.length > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-2">
                {imagePreviews.map((preview, index) => (
                  <div key={preview} className="relative aspect-square overflow-hidden rounded-2xl">
                    <img src={preview} alt={`Spot preview ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      aria-label={`Remove photo ${index + 1}`}
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {index === 0 && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">Cover</span>}
                  </div>
                ))}
              </div>
            )}
            {imageFiles.length < 3 && (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-border rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-accent transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-400">
                <Camera className="w-8 h-8 text-gray-400 dark:text-muted-foreground mb-1" />
                <span className="text-sm text-gray-500 dark:text-muted-foreground">Add up to {3 - imageFiles.length} more photo{3 - imageFiles.length === 1 ? '' : 's'}</span>
                <span className="mt-1 text-xs text-gray-400">Choose several at once or add them one by one</span>
                <input type="file" accept={IMAGE_ACCEPT} multiple onChange={handleImageChange} disabled={!draftPhotosReady} className="sr-only" />
              </label>
            )}
            {(savingDraft || uploadingImage) && photoProgress > 0 && <p className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-300" role="status">Saving photos… {photoProgress}%</p>}
            {!user && imageFiles.length > 0 && <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300">Guest draft photos are stored privately in this browser when IndexedDB is available. They do not sync to another device and may be removed if browser site data is cleared.</p>}
          </div>

          {/* Optional social post. The callable backend attaches this only
              after the spot exists and independently validates it again. */}
          <div className="rounded-2xl border border-gray-200 p-4 dark:border-border">
            <label htmlFor="new-spot-social-url" className="text-sm font-semibold text-gray-700 dark:text-foreground">Instagram or TikTok post</label>
            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-muted-foreground">Optional. Useful when you do not have a photo. Supported: Instagram posts/reels and TikTok videos.</p>
            <input id="new-spot-social-url" type="url" inputMode="url" enterKeyHint="done" value={socialUrl} onChange={event => setSocialUrl(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck="false" placeholder="Paste a supported post link" className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-green-500 dark:border-border dark:bg-background" />
            {socialUrl && validateSocialPostUrl(socialUrl).ok && <p className="mt-2 text-xs font-medium text-green-700 dark:text-green-400">✓ {validateSocialPostUrl(socialUrl).provider === 'instagram' ? 'Instagram post' : 'TikTok video'} recognized</p>}
            {socialUrl && !validateSocialPostUrl(socialUrl).ok && <p className="mt-2 text-xs text-red-600">{INVALID_SOCIAL_URL_MESSAGE}</p>}
            {socialUrl && (!user || user.isAnonymous || user.emailVerified !== true) && <p className="mt-2 text-xs text-amber-600">Sign in with a verified account to attach social content.</p>}
          </div>
            </div>
          </details>

        </div>

        <div className="px-6 pt-3">
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs leading-relaxed ${fieldErrors.attested ? 'border-red-400 bg-red-50 dark:bg-red-950/20' : 'border-gray-200 dark:border-border'}`}>
            <input type="checkbox" checked={attested} onChange={event => { setAttested(event.target.checked); if (event.target.checked) setFieldErrors(current => ({ ...current, attested: '' })); }} className="mt-0.5 h-4 w-4 shrink-0 accent-green-600" />
            <span>I confirm the information is accurate to the best of my knowledge, and that I own or have permission to share any photos. The contribution will be public under the <a href="/TermsAndConditions" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Terms</a>.</span>
          </label>
          {fieldErrors.attested && <p className="mt-1.5 text-xs font-semibold text-red-600">{fieldErrors.attested}</p>}
        </div>

        <div className="sticky bottom-0 z-30 flex gap-3 border-t border-gray-100 bg-white/95 px-6 pt-3 backdrop-blur-xl dark:border-border dark:bg-card/95" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={requestClose} disabled={loading} className="min-h-12 flex-1 py-3 rounded-2xl border-2 border-gray-200 dark:border-border text-gray-600 dark:text-foreground font-semibold text-sm hover:bg-gray-50 dark:hover:bg-accent disabled:opacity-50">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="flex-2 px-8 py-3 rounded-2xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {(loading || uploadingImage) && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? t('addSpot.saving') : t('addSpot.saveSpot')}
          </button>
        </div>
      </div>
      <DraftConfirmationDialog
        open={showCloseChoices}
        onOpenChange={setShowCloseChoices}
        title="Keep your progress?"
        description="Save this as an unpublished draft, discard the changes, or return to editing."
        confirmLabel={savingDraft ? 'Saving…' : 'Save Draft'}
        onConfirm={handleSaveDraft}
        secondaryLabel="Discard"
        onSecondary={onClose}
        busy={savingDraft}
      >
        {!user && imageFiles.length > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">The {imageFiles.length === 1 ? 'photo' : 'photos'} will be stored in this browser only. Clearing site data, private-browsing cleanup, or storage limits can remove guest photos.</p>}
      </DraftConfirmationDialog>
    </div>
  );
}
