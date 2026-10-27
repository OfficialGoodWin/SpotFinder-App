import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, MapPin, Star, Mountain, Coffee, Sunrise, Sunset, Image, Waves, Footprints, Landmark, Building2, Droplets } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import LiquidSegmentedControl from '../ui/LiquidSegmentedControl';
import StarRating from './StarRating';
import LabeledRatingScale from './LabeledRatingScale';
import { submitCategoryRatings } from '@/api/firebaseClient';
import { toast } from 'sonner';
import { IMAGE_ACCEPT, validateImageFileMetadata } from '@/lib/imageUploadValidation';
import ImagePreparationDialog from './ImagePreparationDialog';
import { getSpotDisplayName, isMeaningfulSpotTitle } from '@/lib/spotPresentation';
import DraftConfirmationDialog from '../ui/DraftConfirmationDialog';
import '@/new/new-edit-spot.css';

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
];
const COST_OPTIONS = ['free', 'paid', 'donation'];
const ACCESS_OPTIONS = ['easy', 'moderate', 'hard'];
const PARKING_OPTIONS = ['yes', 'no', 'street', 'paid'];
const BEST_TIME_OPTIONS = ['sunrise', 'sunset', 'golden_hour', 'night', 'anytime'];
const toKeySuffix = (opt) => opt.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join('');
const TAG_ICONS = { Viewpoint: Mountain, SecretCafe: Coffee, Sunset, Sunrise, PhotoSpot: Image, Waterfall: Droplets, Hike: Footprints, SwimSpot: Waves, Ruin: Landmark, UrbanExplore: Building2, Mountain };

function ChoiceField({ legend, options, value, onChange, multiple = false }) {
  return <fieldset className="sf-new-edit-choice"><legend>{legend}</legend><div>{options.map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={multiple ? value.includes(id) : value === id} className={(multiple ? value.includes(id) : value === id) ? 'is-selected' : ''} onClick={() => onChange(id)}>{Icon && <Icon size={16} aria-hidden="true" />}{label}</button>)}</div></fieldset>;
}

export default function EditSpotModal({ spot, user, onClose, onSave, redesigned = false }) {
  const { t, language } = useLanguage();
  const [title, setTitle] = useState(isMeaningfulSpotTitle(spot.title) ? spot.title : (
    isMeaningfulSpotTitle(getSpotDisplayName(spot)) ? getSpotDisplayName(spot) : ''
  ));
  const [description, setDescription] = useState(spot.description || '');
  const [imageFile, setImageFile] = useState(null);
  const [pendingImage, setPendingImage] = useState(null);
  const existingImageUrls = Array.isArray(spot.image_urls) && spot.image_urls.length ? spot.image_urls : [spot.image_url].filter(Boolean);
  const [imagePreview, setImagePreview] = useState(existingImageUrls[0] || null);
  const [loading, setLoading] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const imageUrlRef = useRef('');
  const uploadedImageUrlRef = useRef(new Map());
  const photoAbortRef = useRef(new AbortController());

  const [tags, setTags] = useState(spot.tags || []);
  const tagChoices = [...AVAILABLE_TAGS.map(({ id }) => id), ...tags.filter(id => !AVAILABLE_TAGS.some(option => option.id === id))];
  const [cost, setCost] = useState(spot.cost || 'free');
  const [accessDifficulty, setAccessDifficulty] = useState(spot.access_difficulty || 'easy');
  const [parking, setParking] = useState(spot.parking || 'yes');
  const [bestTime, setBestTime] = useState(spot.best_time || []);
  const [directions, setDirections] = useState(spot.directions || '');
  const [rating, setRating] = useState({ overall: 0, access: 0, condition: 0, safety: 0, crowdedness: 0 });
  const isOwner = Boolean(user) && (
    (Boolean(spot.created_by_uid) && spot.created_by_uid === (user.id || user.uid)) ||
    (Boolean(spot.created_by) && spot.created_by === user.email)
  );
  const detailsDirty = title !== (isMeaningfulSpotTitle(spot.title) ? spot.title : (isMeaningfulSpotTitle(getSpotDisplayName(spot)) ? getSpotDisplayName(spot) : '')) ||
    description !== (spot.description || '') || Boolean(imageFile) || imagePreview !== (existingImageUrls[0] || null) ||
    JSON.stringify(tags) !== JSON.stringify(spot.tags || []) || cost !== (spot.cost || 'free') ||
    accessDifficulty !== (spot.access_difficulty || 'easy') || parking !== (spot.parking || 'yes') ||
    JSON.stringify(bestTime) !== JSON.stringify(spot.best_time || []) || directions !== (spot.directions || '');
  const isDirty = detailsDirty || rating.overall > 0;
  const requestClose = () => { if (!loading) isDirty ? setConfirmDiscard(true) : onClose(); };
  useEffect(() => () => { photoAbortRef.current.abort(); if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current); }, []);

  const toggleTag = (tag) => setTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag]);
  const toggleBestTime = (val) => setBestTime(times => val === 'anytime'
    ? (times.includes('anytime') ? [] : ['anytime'])
    : (times.includes(val) ? times.filter(item => item !== val) : [...times.filter(item => item !== 'anytime'), val]));

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      try { validateImageFileMetadata(file); }
      catch (error) { toast.error(error.message); e.target.value = ''; return; }
      setPendingImage(file);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (redesigned && !isDirty) { onClose(); return; }
    if (redesigned && !detailsDirty && rating.overall > 0) {
      if (!user?.emailVerified || isOwner) return;
      setLoading(true);
      try { await submitCategoryRatings(spot.id, spot, rating, user.id || user.uid); onClose(); }
      catch (error) { console.error('Spot rating failed:', error); toast.error(t('editSpotUi.ratingFailed')); }
      finally { setLoading(false); }
      return;
    }
    if (!isMeaningfulSpotTitle(title)) {
      toast.error(t('addSpotUi.validationTitle'));
      return;
    }
    setLoading(true);
    let image_url = spot.image_url;
    let image_urls = [...existingImageUrls];
    if (imageFile) {
      try {
        const { uploadSpotImage } = await import('@/api/firebaseClient');
        image_url = uploadedImageUrlRef.current.get(imageFile);
        if (!image_url) {
          image_url = await uploadSpotImage(imageFile, { signal: photoAbortRef.current.signal });
          uploadedImageUrlRef.current.set(imageFile, image_url);
        }
        image_urls = [image_url, ...image_urls.slice(1)];
      } catch (error) {
        toast.error(error?.message || t('editSpotUi.photoUploadFailed'));
        setLoading(false);
        return;
      }
    } else if (!imagePreview) {
      image_url = null;
      image_urls = [];
    }
    
    try {
    if (photoAbortRef.current.signal.aborted) throw new Error('Upload interrupted. Reopen this spot and try again.');
    await onSave({
      ...spot,
      title: redesigned ? title : title.trim(),
      description,
      image_url,
      image_urls,
      tags,
      cost,
      access_difficulty: accessDifficulty,
      parking,
      best_time: bestTime,
      directions,
    });
    if (rating.overall > 0 && user?.emailVerified && !isOwner) {
      try { await submitCategoryRatings(spot.id, spot, rating, user.id || user.uid); }
      catch (ratingError) {
        console.error('Spot rating failed:', ratingError);
        toast.error(t('editSpotUi.ratingFailed'));
      }
    }
    } catch (error) {
      console.error('Spot edit failed:', error);
      toast.error(t('editSpotUi.saveFailed'));
    } finally {
    setLoading(false);
    }
  };

  if (redesigned) return <div className="sf-new-edit-backdrop" data-unsaved-work={isDirty ? 'true' : undefined}>
    <form className="sf-new-edit-screen" role="dialog" aria-modal="true" aria-labelledby="sf-new-edit-title" onSubmit={event => { event.preventDefault(); handleSave(); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); requestClose(); } }}>
      <header className="sf-new-edit-header"><button type="button" className="sf-new-edit-close" onClick={requestClose} aria-label={t('common.close')} disabled={loading}><X size={21} /></button><div><span>SpotFinder</span><h2 id="sf-new-edit-title">{t('editSpotUi.title')}</h2></div><span className="sf-new-edit-header-spacer" aria-hidden="true" /></header>
      <div className="sf-new-edit-scroll">
        <section className="sf-new-edit-section"><h3>{t('addSpotUi.essential')}</h3><label htmlFor="sf-new-edit-name">{t('addSpotUi.spotName')}</label><input id="sf-new-edit-name" value={title} maxLength={100} onChange={event => setTitle(event.target.value)} placeholder={t('addSpotUi.namePlaceholder')} required /><label htmlFor="sf-new-edit-description">{t('addSpot.description')}</label><textarea id="sf-new-edit-description" value={description} onChange={event => setDescription(event.target.value)} placeholder={t('addSpot.descPlaceholder')} rows={5} /></section>
        <section className="sf-new-edit-section"><ChoiceField legend={t('addSpot.tags')} multiple options={tagChoices.map(id => ({ id, label: id === 'Other' ? language?.startsWith('cs') ? 'Jiné' : 'Other' : t(`spotTags.${id}`, id), Icon: TAG_ICONS[id] }))} value={tags} onChange={toggleTag} /></section>
        <section className="sf-new-edit-section"><h3>{t('addSpotUi.optional')}</h3><ChoiceField legend={t('addSpot.cost')} options={COST_OPTIONS.map(id => ({ id, label: t(`addSpot.cost${toKeySuffix(id)}`) }))} value={cost} onChange={setCost} /><ChoiceField legend={t('addSpot.accessDifficulty')} options={ACCESS_OPTIONS.map(id => ({ id, label: t(`addSpot.access${toKeySuffix(id)}`) }))} value={accessDifficulty} onChange={setAccessDifficulty} /><ChoiceField legend={t('addSpot.parkingAvailability')} options={PARKING_OPTIONS.map(id => ({ id, label: t(`addSpot.parking${toKeySuffix(id)}`) }))} value={parking} onChange={setParking} /><ChoiceField legend={t('addSpot.bestTime')} multiple options={BEST_TIME_OPTIONS.map(id => ({ id, label: t(`addSpot.bestTime${toKeySuffix(id)}`) }))} value={bestTime} onChange={toggleBestTime} /><label htmlFor="sf-new-edit-directions">{t('addSpot.directions')}</label><textarea id="sf-new-edit-directions" value={directions} onChange={event => setDirections(event.target.value)} placeholder={t('addSpot.directionsPlaceholder')} rows={3} /></section>
        <section className="sf-new-edit-section"><h3>{t('addSpot.photo')}</h3>{imagePreview ? <div className="sf-new-edit-photo"><img src={imagePreview} alt={t('addSpotUi.photoPreview', { number: 1 })} /><button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} aria-label={t('addSpotUi.removePhoto', { number: 1 })}><X size={19} /></button></div> : <label className="sf-new-edit-upload"><Camera size={22} aria-hidden="true" /><span>{t('addSpot.photoHint')}</span><input type="file" accept={IMAGE_ACCEPT} onChange={handleImageChange} /></label>}</section>
        {!isOwner && <section className="sf-new-edit-section"><h3>{t('editSpotUi.yourRating')}</h3><p className="sf-new-edit-hint">{t('editSpotUi.ratingHint')}</p>{user?.emailVerified ? <><div className="sf-new-edit-stars" role="group" aria-label={t('editSpotUi.yourRating')}>{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" aria-label={`${value} / 5`} aria-pressed={rating.overall === value} onClick={() => setRating(current => ({ ...current, overall: value }))}><Star size={25} fill={rating.overall >= value ? 'currentColor' : 'none'} /></button>)}</div>{[
          ['access', t('spotDetailUi.access'), [t('spotDetailUi.access1'), '', '', '', t('spotDetailUi.access5')]],
          ['condition', t('spotDetailUi.condition'), [t('spotDetailUi.condition1'), '', '', '', t('spotDetailUi.condition5')]],
          ['safety', t('spotDetailUi.safety'), [t('spotDetailUi.safety2'), '', '', '', t('spotDetailUi.safety5')]],
          ['crowdedness', t('spotDetailUi.crowding'), [t('spotDetailUi.crowding1'), '', '', '', t('spotDetailUi.crowding5')]],
        ].map(([key, label, labels]) => <div className="sf-new-edit-scale" key={key}><strong>{label}</strong><div role="group" aria-label={label}>{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" aria-label={`${value} / 5`} aria-pressed={rating[key] === value} className={rating[key] === value ? 'is-selected' : ''} onClick={() => setRating(current => ({ ...current, [key]: value }))}>{value}</button>)}</div><small>{labels[0]} · {labels[4]}</small></div>)}</> : <p className="sf-new-edit-hint">{t('editSpotUi.ratingVerify')}</p>}</section>}
      </div>
      <footer className="sf-new-edit-footer"><button type="button" onClick={requestClose} disabled={loading}>{t('common.cancel')}</button><button type="submit" disabled={loading}>{loading ? t('addSpot.saving') : t('common.save')}</button></footer>
    </form>
    <DraftConfirmationDialog open={confirmDiscard} onOpenChange={setConfirmDiscard} title={t('editSpotUi.discardTitle')} description={t('editSpotUi.discardHint')} cancelLabel={t('editSpotUi.keepEditing')} confirmLabel={t('editSpotUi.discardChanges')} onConfirm={onClose} destructive />
    {pendingImage && <ImagePreparationDialog file={pendingImage} onConfirm={file => { uploadedImageUrlRef.current.clear(); setImageFile(file); if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current); imageUrlRef.current = URL.createObjectURL(file); setImagePreview(imageUrlRef.current); setPendingImage(null); }} onCancel={() => setPendingImage(null)} />}
  </div>;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm" data-unsaved-work={isDirty ? 'true' : undefined}>
      <div className="sf-sheet isolate w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl max-h-[90dvh] sm:rounded-3xl">
        <div className="sticky top-0 z-30 bg-white/90 dark:bg-card/90 px-6 pt-5 pb-3 border-b border-gray-100/80 dark:border-border flex items-center justify-between backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-foreground">{t('editSpotUi.title')}</h2>
          </div>
          <button onClick={requestClose} aria-label={t('common.close')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-accent">
            <X className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          <div>
            <label htmlFor="edit-spot-name" className="text-sm font-semibold text-gray-600 dark:text-foreground mb-1 block">{t('addSpotUi.spotName')}</label>
            <input id="edit-spot-name" value={title} maxLength={100} onChange={event => setTitle(event.target.value)} placeholder={t('addSpotUi.namePlaceholder')} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-green-500 text-base" />
          </div>
          {/* Description */}
          <div>
            <label className="text-sm font-semibold text-gray-600 dark:text-foreground mb-1 block">{t('addSpot.description')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('addSpot.descPlaceholder')}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm resize-none"
            />
          </div>

          {!isOwner && <div className="rounded-2xl border border-emerald-500/15 bg-emerald-50/60 p-4 dark:bg-emerald-950/15">
            <p className="text-sm font-bold text-foreground">{t('editSpotUi.yourRating')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('editSpotUi.ratingHint')}</p>
            {user?.emailVerified ? (
              <div className="mt-3 space-y-3">
                <StarRating value={rating.overall} onChange={overall => setRating(value => ({ ...value, overall }))} />
                {[
                  ['access', t('spotDetailUi.access'), [t('spotDetailUi.access1'), '', '', '', t('spotDetailUi.access5')]],
                  ['condition', t('spotDetailUi.condition'), [t('spotDetailUi.condition1'), '', '', '', t('spotDetailUi.condition5')]],
                  ['safety', t('spotDetailUi.safety'), [t('spotDetailUi.safety2'), '', '', '', t('spotDetailUi.safety5')]],
                  ['crowdedness', t('spotDetailUi.crowding'), [t('spotDetailUi.crowding1'), '', '', '', t('spotDetailUi.crowding5')]],
                ].map(([key, label, labels]) => (
                  <div key={key}><p className="mb-1 text-xs font-semibold text-muted-foreground">{label}</p><LabeledRatingScale value={rating[key]} labels={labels} onChange={value => setRating(current => ({ ...current, [key]: value }))} /></div>
                ))}
              </div>
            ) : <p className="mt-2 text-xs font-medium text-amber-600">{t('editSpotUi.ratingVerify')}</p>}
          </div>}

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
                  {emoji} {t(`spotTags.${id}`, id)}
                </button>
              ))}
            </div>
          </div>

          {/* Practical details */}
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

          {/* Image */}
          <div>
            <label className="text-sm font-semibold text-gray-600 dark:text-foreground mb-2 block">{t('addSpot.photo')}</label>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt={t('addSpotUi.photoPreview', { number: 1 })} className="w-full h-40 object-cover rounded-2xl" />
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-border rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-accent transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-400">
                <Camera className="w-8 h-8 text-gray-400 dark:text-muted-foreground mb-1" />
                <span className="text-sm text-gray-500 dark:text-muted-foreground">{t('addSpot.photoHint')}</span>
                <input type="file" accept={IMAGE_ACCEPT} onChange={handleImageChange} className="sr-only" />
              </label>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-border flex gap-3">
          <button onClick={requestClose} disabled={loading} className="flex-1 py-3 rounded-2xl border-2 border-gray-200 dark:border-border text-gray-600 dark:text-foreground font-semibold text-sm hover:bg-gray-50 dark:hover:bg-accent">
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-2 px-8 py-3 rounded-2xl bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {loading ? t('addSpot.saving') : t('common.save')}
          </button>
        </div>
      </div>
      <DraftConfirmationDialog open={confirmDiscard} onOpenChange={setConfirmDiscard} title={t('editSpotUi.discardTitle')} description={t('editSpotUi.discardHint')} cancelLabel={t('editSpotUi.keepEditing')} confirmLabel={t('editSpotUi.discardChanges')} onConfirm={onClose} destructive />
      {pendingImage && <ImagePreparationDialog file={pendingImage} onConfirm={file => {
        uploadedImageUrlRef.current.clear();
        setImageFile(file);
        if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = URL.createObjectURL(file);
        setImagePreview(imageUrlRef.current);
        setPendingImage(null);
      }} onCancel={() => setPendingImage(null)} />}
    </div>
  );
}
