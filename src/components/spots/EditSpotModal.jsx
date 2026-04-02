import React, { useState } from 'react';
import { X, Camera, MapPin } from 'lucide-react';
import StarRating from './StarRating';
import { useLanguage } from '@/lib/LanguageContext';

export default function EditSpotModal({ spot, onClose, onSave }) {
  const { t } = useLanguage();
  const [description, setDescription] = useState(spot.description || '');
  const [parkingRating, setParkingRating] = useState(spot.parking_rating || 0);
  const [beautyRating, setBeautyRating] = useState(spot.beauty_rating || 0);
  const [privacyRating, setPrivacyRating] = useState(spot.privacy_rating || 0);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(spot.image_url || null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    // Calculate overall rating as average of the three ratings
    const ratingsProvided = [parkingRating, beautyRating, privacyRating].filter(r => r > 0);
    const overallRating = ratingsProvided.length > 0 
      ? ratingsProvided.reduce((sum, r) => sum + r, 0) / ratingsProvided.length 
      : 0;

    setLoading(true);
    let image_url = spot.image_url;
    if (imageFile) {
      try {
        const { uploadSpotImage } = await import('@/api/firebaseClient');
        image_url = await uploadSpotImage(imageFile);
      } catch (e) {
        image_url = imagePreview;
      }
    }
    
    await onSave({
      ...spot,
      description,
      rating: overallRating,
      parking_rating: parkingRating,
      beauty_rating: beautyRating,
      privacy_rating: privacyRating,
      spot_type: spot.spot_type || 'general',
      image_url,
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-card w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-card px-6 pt-5 pb-3 border-b border-gray-100 dark:border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-foreground">{t('common.edit')} Spot</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-accent">
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

          {/* Parking Quality Rating */}
          <div>
            <label className="text-sm font-semibold text-gray-600 dark:text-foreground mb-1 block">{t('addSpot.parkingRating')}</label>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mb-2">{t('addSpot.parkingHint')}</p>
            <StarRating value={parkingRating} onChange={setParkingRating} size="lg" />
          </div>

          {/* Beauty/Scenery Rating */}
          <div>
            <label className="text-sm font-semibold text-gray-600 dark:text-foreground mb-1 block">{t('addSpot.beautyRating')}</label>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mb-2">{t('addSpot.beautyHint')}</p>
            <StarRating value={beautyRating} onChange={setBeautyRating} size="lg" />
          </div>

          {/* Privacy Rating */}
          <div>
            <label className="text-sm font-semibold text-gray-600 dark:text-foreground mb-1 block">{t('addSpot.privacyRating')}</label>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mb-2">{t('addSpot.privacyHint')}</p>
            <StarRating value={privacyRating} onChange={setPrivacyRating} size="lg" />
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
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-border rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-accent transition-colors">
                <Camera className="w-8 h-8 text-gray-400 dark:text-muted-foreground mb-1" />
                <span className="text-sm text-gray-500 dark:text-muted-foreground">{t('addSpot.photoHint')}</span>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
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
