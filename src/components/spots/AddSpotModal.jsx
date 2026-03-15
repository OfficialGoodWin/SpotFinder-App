import React, { useState, useRef } from 'react';
import { X, Camera, MapPin, Mic, MicOff, Loader2 } from 'lucide-react';
import StarRating from './StarRating';
import AdBanner from '../AdBanner';
import { useLanguage } from '@/lib/LanguageContext';
import { uploadSpotImage } from '@/api/firebaseClient';

// Language code → BCP-47 for Web Speech API
const LANG_TO_BCP47 = {
  en: 'en-US', cs: 'cs-CZ', pl: 'pl-PL', de: 'de-DE', sk: 'sk-SK',
  it: 'it-IT', fr: 'fr-FR', ru: 'ru-RU', uk: 'uk-UA', hu: 'hu-HU',
  ro: 'ro-RO', es: 'es-ES', bg: 'bg-BG',
};

export default function AddSpotModal({ latlng, onClose, onSave, user }) {
  const { t, language } = useLanguage();
  const [description, setDescription] = useState('');
  const [parkingRating, setParkingRating] = useState(0);
  const [beautyRating, setBeautyRating] = useState(0);
  const [privacyRating, setPrivacyRating] = useState(0);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const recognitionRef = useRef(null);
  const committedRef = useRef(''); // tracks already-committed final transcript

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Voice dictation
  const toggleVoice = () => {
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
    rec.onerror = () => { setListening(false); setInterimText(''); };
    rec.onend = () => { setListening(false); setInterimText(''); };
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  const handleSave = async () => {
    const ratingsProvided = [parkingRating, beautyRating, privacyRating].filter(r => r > 0);
    const overallRating = ratingsProvided.length > 0
      ? ratingsProvided.reduce((sum, r) => sum + r, 0) / ratingsProvided.length
      : 0;

    setLoading(true);
    let image_url = null;

    if (imageFile) {
      try {
        setUploadingImage(true);
        image_url = await uploadSpotImage(imageFile);
      } catch (err) {
        console.error('Image upload failed:', err);
        // Fallback: skip image rather than crash
        image_url = null;
      } finally {
        setUploadingImage(false);
      }
    }

    await onSave({
      lat: latlng.lat,
      lng: latlng.lng,
      spot_type: 'general',
      title: 'Spot',
      description,
      rating: Math.round(overallRating * 10) / 10,
      rating_count: overallRating > 0 ? 1 : 0,
      parking_rating: parkingRating,
      parking_rating_count: parkingRating > 0 ? 1 : 0,
      beauty_rating: beautyRating,
      beauty_rating_count: beautyRating > 0 ? 1 : 0,
      privacy_rating: privacyRating,
      privacy_rating_count: privacyRating > 0 ? 1 : 0,
      image_url,
      is_public: true,
      created_by: user?.email || 'anonymous',
      created_by_name: user?.displayName || user?.email?.split('@')[0] || 'Anonymous',
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-card w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-card px-6 pt-5 pb-3 border-b border-gray-100 dark:border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-foreground">{t('addSpot.title')}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-accent">
            <X className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Description + voice */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-gray-600 dark:text-foreground">{t('addSpot.description')}</label>
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
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('addSpot.descPlaceholder')}
              rows={3}
              className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-background text-gray-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm resize-none transition-colors ${
                listening ? 'border-red-300 dark:border-red-600' : 'border-gray-200 dark:border-border'
              }`}
            />
            {interimText && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400 italic px-1">
                {interimText}…
              </p>
            )}
          </div>

          {/* Ratings */}
          <div>
            <label className="text-sm font-semibold text-gray-600 dark:text-foreground mb-1 block">{t('addSpot.parkingRating')}</label>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mb-2">{t('addSpot.parkingHint')}</p>
            <StarRating value={parkingRating} onChange={setParkingRating} size="lg" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600 dark:text-foreground mb-1 block">{t('addSpot.beautyRating')}</label>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mb-2">{t('addSpot.beautyHint')}</p>
            <StarRating value={beautyRating} onChange={setBeautyRating} size="lg" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600 dark:text-foreground mb-1 block">{t('addSpot.privacyRating')}</label>
            <p className="text-xs text-gray-500 dark:text-muted-foreground mb-2">{t('addSpot.privacyHint')}</p>
            <StarRating value={privacyRating} onChange={setPrivacyRating} size="lg" />
          </div>

          {/* Photo */}
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