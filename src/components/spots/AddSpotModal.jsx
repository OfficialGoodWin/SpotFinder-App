import React, { useState, useRef } from 'react';
import { X, Camera, MapPin, Mic, Loader2, AlertCircle } from 'lucide-react';
import StarRating from './StarRating';
import LabeledRatingScale from './LabeledRatingScale';
import AdBanner from '../AdBanner';
import { useLanguage } from '@/lib/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { uploadSpotImage } from '@/api/firebaseClient';
import { INVALID_SOCIAL_URL_MESSAGE, validateSocialPostUrl } from '@/lib/socialUrlPolicy';
import { moderateSubmission } from '@/lib/moderation';
import { findNearbyPoi } from '@/lib/nearbyPoi';
import { toast } from 'sonner';
import LiquidSegmentedControl from '../ui/LiquidSegmentedControl';
import { IMAGE_ACCEPT, validateImageFileMetadata } from '@/lib/imageUploadValidation';

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

export default function AddSpotModal({ latlng, onClose, onSave, user }) {
  const { authUid } = useAuth();
  const { t, language } = useLanguage();
  const spotType = 'general';
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

  // ── New fields per submission spec ──────────────────────────────────────────
  const [tags, setTags] = useState([]);
  const [cost, setCost] = useState('free');
  const [accessDifficulty, setAccessDifficulty] = useState('easy');
  const [parking, setParking] = useState('yes');
  const [bestTime, setBestTime] = useState([]);
  const [directions, setDirections] = useState('');

  // Duplicate detection disabled for now (requires findNearbySpots in firebaseClient.js)

  const toggleTag = (tag) => setTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag]);
  const toggleBestTime = (val) => setBestTime(t => t.includes(val) ? t.filter(x => x !== val) : [...t, val]);

  const recognitionRef = useRef(null);
  const committedRef = useRef(''); // tracks already-committed final transcript
  const descriptionRef = useRef(null);
  const errorSummaryRef = useRef(null);

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
    if (selected.length > remaining) toast.info('You can add up to 3 photos per spot.');
    e.target.value = '';
  };

  const removeImage = (index) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles(current => current.filter((_, itemIndex) => itemIndex !== index));
    setImagePreviews(current => current.filter((_, itemIndex) => itemIndex !== index));
  };

  // Voice dictation
  const toggleVoice = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t('addSpot.voiceNotSupported'));
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
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some(d => d.kind === 'audioinput');
      if (!hasMic) {
        setMicError('Error: no microphone detected');
        return;
      }
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMicError('Error: no microphone detected');
      } else {
        setMicError('Error: microphone permission was not allowed');
      }
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
      if (e.error === 'no-speech') return;
      if (e.error === 'audio-capture' || e.error === 'not-allowed') {
        setMicError(e.error === 'not-allowed'
          ? 'Error: microphone permission was not allowed'
          : 'Error: no microphone detected');
      }
    };
    rec.onend = () => { setListening(false); setInterimText(''); };
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  const handleSave = async () => {
    setSubmitError('');
    if (!description.trim()) {
      const message = t('addSpot.descriptionRequired');
      setFieldErrors(current => ({ ...current, description: message }));
      setSubmitError(message);
      focusError(descriptionRef);
      return;
    }
    setFieldErrors(current => ({ ...current, description: '' }));

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

    setLoading(true);
    let image_urls = [];

    const nearbyPoiPromise = findNearbyPoi(Number(latlng.lat), Number(latlng.lng), language)
      .catch(error => {
        console.warn('Nearby POI matching skipped:', error);
        return null;
      });

    if (imageFiles.length) {
      try {
        setUploadingImage(true);
        const uploads = await Promise.allSettled(imageFiles.map(file => uploadSpotImage(file)));
        image_urls = uploads.filter(result => result.status === 'fulfilled').map(result => result.value);
        const failedCount = uploads.length - image_urls.length;
        if (failedCount) toast.error(`${failedCount} photo${failedCount === 1 ? '' : 's'} could not be uploaded.`);
      } catch (err) {
        console.error('Image uploads failed:', err);
      } finally {
        setUploadingImage(false);
      }
    }

    const poi_match = await nearbyPoiPromise;

    const baseData = {
      lat: latlng.lat,
      lng: latlng.lng,
      spot_type: spotType,
      title: 'Spot',
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
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="isolate bg-white dark:bg-card w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain">
        <div className="sticky top-0 z-30 bg-white/90 dark:bg-card/90 px-6 pt-5 pb-3 border-b border-gray-100/80 dark:border-border flex items-center justify-between backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-foreground">{t('addSpot.title')}</h2>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-accent">
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

          {/* Description + voice */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="new-spot-description" className="text-sm font-semibold text-gray-600 dark:text-foreground">{t('addSpot.description')} <span className="text-red-500" aria-hidden="true">*</span></label>
              <button
                type="button"
                onClick={toggleVoice}
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
              <p className="text-xs text-red-500 dark:text-red-400 mb-1 px-1">{micError}</p>
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
              rows={3}
              className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-background text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm resize-none transition-colors ${
                fieldErrors.description
                  ? 'border-red-400 bg-red-50/40 focus:ring-red-300 dark:border-red-700 dark:bg-red-950/20'
                  : listening ? 'border-red-300 dark:border-red-600' : 'border-gray-200 dark:border-border'
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
                      ? 'sf-glass-pill--selected sf-glass-pill--blue'
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
                        ? 'sf-glass-pill--selected sf-glass-pill--purple'
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
                <input type="file" accept={IMAGE_ACCEPT} multiple onChange={handleImageChange} className="sr-only" />
              </label>
            )}
          </div>

          {/* Optional social post. The callable backend attaches this only
              after the spot exists and independently validates it again. */}
          <div className="rounded-2xl border border-gray-200 p-4 dark:border-border">
            <label htmlFor="new-spot-social-url" className="text-sm font-semibold text-gray-700 dark:text-foreground">Instagram or TikTok post</label>
            <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-muted-foreground">Optional. Useful when you do not have a photo. Supported: Instagram posts/reels and TikTok videos.</p>
            <input id="new-spot-social-url" type="url" value={socialUrl} onChange={event => setSocialUrl(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck="false" placeholder="Paste a supported post link" className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-500 dark:border-border dark:bg-background" />
            {socialUrl && validateSocialPostUrl(socialUrl).ok && <p className="mt-2 text-xs font-medium text-green-700 dark:text-green-400">✓ {validateSocialPostUrl(socialUrl).provider === 'instagram' ? 'Instagram post' : 'TikTok video'} recognized</p>}
            {socialUrl && !validateSocialPostUrl(socialUrl).ok && <p className="mt-2 text-xs text-red-600">{INVALID_SOCIAL_URL_MESSAGE}</p>}
            {socialUrl && (!user || user.isAnonymous || user.emailVerified !== true) && <p className="mt-2 text-xs text-amber-600">Sign in with a verified account to attach social content.</p>}
          </div>

          {/* Ad Banners */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div style={{ minHeight: 90 }}>
              <AdBanner />
            </div>
            <div className="hidden md:block" style={{ minHeight: 90 }}>
              <AdBanner />
            </div>
          </div>
        </div>

        <p className="px-6 pt-3 text-[11px] leading-relaxed text-gray-500 dark:text-muted-foreground">
          By saving, you confirm this description and these photos are your own (or you have the right to
          share them) and agree they'll be shown publicly on the map to other SpotFinder users. See our{' '}
          <a href="/TermsAndConditions" target="_blank" rel="noopener noreferrer" className="underline">Terms</a>.
        </p>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-border flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl border-2 border-gray-200 dark:border-border text-gray-600 dark:text-foreground font-semibold text-sm hover:bg-gray-50 dark:hover:bg-accent">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-2 px-8 py-3 rounded-2xl bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {(loading || uploadingImage) && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? t('addSpot.saving') : t('addSpot.saveSpot')}
          </button>
        </div>
      </div>
    </div>
  );
}
