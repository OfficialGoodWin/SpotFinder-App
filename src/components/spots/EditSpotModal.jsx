import React, { useState } from 'react';
import { X, Camera, MapPin } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import LiquidSegmentedControl from '../ui/LiquidSegmentedControl';
import StarRating from './StarRating';
import LabeledRatingScale from './LabeledRatingScale';
import { submitCategoryRatings } from '@/api/firebaseClient';

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

export default function EditSpotModal({ spot, user, onClose, onSave }) {
  const { t } = useLanguage();
  const [description, setDescription] = useState(spot.description || '');
  const [imageFile, setImageFile] = useState(null);
  const existingImageUrls = Array.isArray(spot.image_urls) && spot.image_urls.length ? spot.image_urls : [spot.image_url].filter(Boolean);
  const [imagePreview, setImagePreview] = useState(existingImageUrls[0] || null);
  const [loading, setLoading] = useState(false);

  const [tags, setTags] = useState(spot.tags || []);
  const [cost, setCost] = useState(spot.cost || 'free');
  const [accessDifficulty, setAccessDifficulty] = useState(spot.access_difficulty || 'easy');
  const [parking, setParking] = useState(spot.parking || 'yes');
  const [bestTime, setBestTime] = useState(spot.best_time || []);
  const [directions, setDirections] = useState(spot.directions || '');
  const [rating, setRating] = useState({ overall: 0, access: 0, condition: 0, safety: 0, crowdedness: 0 });

  const toggleTag = (tag) => setTags(t => t.includes(tag) ? t.filter(x => x !== tag) : [...t, tag]);
  const toggleBestTime = (val) => setBestTime(t => t.includes(val) ? t.filter(x => x !== val) : [...t, val]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    let image_url = spot.image_url;
    let image_urls = [...existingImageUrls];
    if (imageFile) {
      try {
        const { uploadSpotImage } = await import('@/api/firebaseClient');
        image_url = await uploadSpotImage(imageFile);
        image_urls = [image_url, ...image_urls.slice(1)];
      } catch (e) {
        image_url = imagePreview;
      }
    } else if (!imagePreview) {
      image_url = null;
      image_urls = [];
    }
    
    await onSave({
      ...spot,
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
    if (rating.overall > 0 && user?.emailVerified) {
      await submitCategoryRatings(spot.id, spot, rating, user.id || user.uid);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="isolate bg-white dark:bg-card w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain">
        <div className="sticky top-0 z-30 bg-white/90 dark:bg-card/90 px-6 pt-5 pb-3 border-b border-gray-100/80 dark:border-border flex items-center justify-between backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-foreground">{t('common.edit')} Spot</h2>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-accent">
            <X className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
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

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-50/60 p-4 dark:bg-emerald-950/15">
            <p className="text-sm font-bold text-foreground">Your rating</p>
            <p className="mt-1 text-xs text-muted-foreground">Your rating is stored separately from the spot details, so older spots can safely move to the current rating system.</p>
            {user?.emailVerified ? (
              <div className="mt-3 space-y-3">
                <StarRating value={rating.overall} onChange={overall => setRating(value => ({ ...value, overall }))} />
                {[
                  ['access', 'Ease of access', ['Very difficult', '', '', '', 'Very easy']],
                  ['condition', 'Condition & cleanliness', ['Very poor', '', '', '', 'Excellent']],
                  ['safety', 'Safety & comfort', ['Uncomfortable', '', '', '', 'Very safe']],
                  ['crowdedness', 'Crowdedness', ['Very quiet', '', '', '', 'Very busy']],
                ].map(([key, label, labels]) => (
                  <div key={key}><p className="mb-1 text-xs font-semibold text-muted-foreground">{label}</p><LabeledRatingScale value={rating[key]} labels={labels} onChange={value => setRating(current => ({ ...current, [key]: value }))} /></div>
                ))}
              </div>
            ) : <p className="mt-2 text-xs font-medium text-amber-600">Verify your email to submit a rating.</p>}
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
                <img src={imagePreview} alt="preview" className="w-full h-40 object-cover rounded-2xl" />
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
                <input type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
              </label>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-border flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl border-2 border-gray-200 dark:border-border text-gray-600 dark:text-foreground font-semibold text-sm hover:bg-gray-50 dark:hover:bg-accent">
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
    </div>
  );
}
