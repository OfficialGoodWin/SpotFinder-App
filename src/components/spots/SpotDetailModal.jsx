import React, { useState, useEffect } from 'react';
import { X, Navigation, MapPin, Edit2, Trash2, Share2, Check } from 'lucide-react';
import StarRating from './StarRating';
import { rateSpot, updateSpotRating, updateSpotDetailRating } from '@/api/firebaseClient';
import { useLanguage } from '@/lib/LanguageContext';

const RATED_KEY = (spotId) => `sf_rated_${spotId}`;

export default function SpotDetailModal({ spot, user, onClose, onNavigate, onEdit, onDelete, onSpotUpdate }) {
  const { t } = useLanguage();
  const [userRating, setUserRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [localSpot, setLocalSpot] = useState(spot);
  const [shareTooltip, setShareTooltip] = useState(false);

  // Detailed category ratings
  const [pendingParking, setPendingParking] = useState(0);
  const [pendingBeauty, setPendingBeauty] = useState(0);
  const [pendingPrivacy, setPendingPrivacy] = useState(0);
  const [detailRatingSubmitted, setDetailRatingSubmitted] = useState(false);

  const isOwner = user && spot.created_by === user.email;
  const isSuperAdmin = user && user.email === 'superadmin@spotfinder.cz';

  useEffect(() => {
    // Check localStorage if already rated this spot
    try {
      const stored = localStorage.getItem(RATED_KEY(spot.id));
      if (stored) setRatingSubmitted(true);
    } catch (_) {}
  }, [spot.id]);

  const handleRate = async (val) => {
    if (ratingSubmitted || isOwner) return;
    setUserRating(val);
    const newCount = (localSpot.rating_count || 0) + 1;
    const newRating = (((localSpot.rating || 0) * (localSpot.rating_count || 0)) + val) / newCount;
    const rounded = Math.round(newRating * 10) / 10;
    await rateSpot(spot.id, val);
    await updateSpotRating(spot.id, rounded, newCount);
    const updated = { ...localSpot, rating: rounded, rating_count: newCount };
    setLocalSpot(updated);
    onSpotUpdate?.(updated);
    try { localStorage.setItem(RATED_KEY(spot.id), '1'); } catch (_) {}
    setRatingSubmitted(true);
  };

  const handleDetailRatings = async () => {
    if (!pendingParking && !pendingBeauty && !pendingPrivacy) return;
    
    const updates = {};
    
    if (pendingParking > 0) {
      const cnt = (localSpot.parking_rating_count || 0) + 1;
      const avg = (((localSpot.parking_rating || 0) * (localSpot.parking_rating_count || 0)) + pendingParking) / cnt;
      updates.parking_rating = Math.round(avg * 10) / 10;
      updates.parking_rating_count = cnt;
      await updateSpotDetailRating(spot.id, 'parking_rating', updates.parking_rating, cnt);
    }
    if (pendingBeauty > 0) {
      const cnt = (localSpot.beauty_rating_count || 0) + 1;
      const avg = (((localSpot.beauty_rating || 0) * (localSpot.beauty_rating_count || 0)) + pendingBeauty) / cnt;
      updates.beauty_rating = Math.round(avg * 10) / 10;
      updates.beauty_rating_count = cnt;
      await updateSpotDetailRating(spot.id, 'beauty_rating', updates.beauty_rating, cnt);
    }
    if (pendingPrivacy > 0) {
      const cnt = (localSpot.privacy_rating_count || 0) + 1;
      const avg = (((localSpot.privacy_rating || 0) * (localSpot.privacy_rating_count || 0)) + pendingPrivacy) / cnt;
      updates.privacy_rating = Math.round(avg * 10) / 10;
      updates.privacy_rating_count = cnt;
      await updateSpotDetailRating(spot.id, 'privacy_rating', updates.privacy_rating, cnt);
    }
    
    const updated = { ...localSpot, ...updates };
    setLocalSpot(updated);
    onSpotUpdate?.(updated);
    setDetailRatingSubmitted(true);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?spot=${spot.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: spot.title || 'Spot', text: spot.description || 'Check out this spot!', url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareTooltip(true);
        setTimeout(() => setShareTooltip(false), 2000);
      }
    } catch (err) {
      await navigator.clipboard.writeText(url).catch(() => {});
      setShareTooltip(true);
      setTimeout(() => setShareTooltip(false), 2000);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-card w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-card px-6 pt-5 pb-3 border-b border-gray-100 dark:border-border">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-foreground">{localSpot.title || 'Spot'}</h2>
                <p className="text-xs text-gray-500 dark:text-muted-foreground">
                  {t('spotDetail.addedBy')} {localSpot.created_by_name || localSpot.created_by || 'Anonymous'}
                  {localSpot.created_date && ` ${t('spotDetail.addedOn')} ${formatDate(localSpot.created_date)}`}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-accent">
              <X className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Image */}
          {localSpot.image_url && (
            <img src={localSpot.image_url} alt="spot" className="w-full h-48 object-cover rounded-2xl" />
          )}

          {/* Description */}
          {localSpot.description && (
            <p className="text-gray-600 dark:text-muted-foreground text-sm leading-relaxed">{localSpot.description}</p>
          )}

          {/* Overall Rating */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-accent rounded-2xl">
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1">{t('spotDetail.overallRating')}</p>
              <div className="flex items-center gap-2">
                <StarRating value={Math.round(localSpot.rating || 0)} readOnly size="md" />
                <span className="text-gray-700 dark:text-foreground font-semibold">
                  {localSpot.rating ? localSpot.rating.toFixed(1) : '–'}
                </span>
                <span className="text-gray-400 dark:text-muted-foreground text-sm">
                  ({localSpot.rating_count || 0} {t('spotDetail.ratings')})
                </span>
              </div>
            </div>
          </div>

          {/* Displayed Category Ratings */}
          {(localSpot.parking_rating > 0 || localSpot.beauty_rating > 0 || localSpot.privacy_rating > 0) && (
            <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">{t('spotDetail.detailedRatings')}</p>
              {localSpot.parking_rating > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-foreground">{t('spotDetail.parkingQuality')}</span>
                  <div className="flex items-center gap-2">
                    <StarRating value={Math.round(localSpot.parking_rating)} readOnly size="sm" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-foreground w-8">{localSpot.parking_rating.toFixed(1)}</span>
                  </div>
                </div>
              )}
              {localSpot.beauty_rating > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-foreground">{t('spotDetail.beauty')}</span>
                  <div className="flex items-center gap-2">
                    <StarRating value={Math.round(localSpot.beauty_rating)} readOnly size="sm" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-foreground w-8">{localSpot.beauty_rating.toFixed(1)}</span>
                  </div>
                </div>
              )}
              {localSpot.privacy_rating > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-foreground">{t('spotDetail.privacy')}</span>
                  <div className="flex items-center gap-2">
                    <StarRating value={Math.round(localSpot.privacy_rating)} readOnly size="sm" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-foreground w-8">{localSpot.privacy_rating.toFixed(1)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rate this spot – overall (anyone can rate) */}
          {!ratingSubmitted && !isOwner && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">{t('spotDetail.rateOverall')}</p>
              <StarRating value={userRating} onChange={handleRate} size="lg" />
            </div>
          )}
          {ratingSubmitted && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl text-center text-green-700 dark:text-green-400 text-sm font-semibold">
              ✓ {t('spotDetail.thanksRating')}
            </div>
          )}

          {/* Rate category details – available to all */}
          {!detailRatingSubmitted && !isOwner && (
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-200 dark:border-purple-800 space-y-3">
              <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">{t('spotDetail.rateCategories')}</p>
              <div>
                <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1">{t('spotDetail.parkingQuality')}</p>
                <StarRating value={pendingParking} onChange={setPendingParking} size="md" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1">{t('spotDetail.beauty')}</p>
                <StarRating value={pendingBeauty} onChange={setPendingBeauty} size="md" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1">{t('spotDetail.privacy')}</p>
                <StarRating value={pendingPrivacy} onChange={setPendingPrivacy} size="md" />
              </div>
              <button
                onClick={handleDetailRatings}
                disabled={!pendingParking && !pendingBeauty && !pendingPrivacy}
                className="w-full py-2 rounded-xl bg-purple-600 text-white font-semibold text-sm disabled:opacity-40 hover:bg-purple-700 transition-colors"
              >
                {t('spotDetail.submitRatings')}
              </button>
            </div>
          )}
          {detailRatingSubmitted && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl text-center text-green-700 dark:text-green-400 text-sm font-semibold">
              ✓ {t('spotDetail.thanksCategoryRating')}
            </div>
          )}

          {/* Coordinates */}
          <div className="flex items-center gap-2 text-gray-400 dark:text-muted-foreground text-xs">
            <MapPin className="w-3 h-3" />
            <span>{localSpot.lat?.toFixed(5)}, {localSpot.lng?.toFixed(5)}</span>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-border flex gap-3 flex-wrap">
          {(isOwner || isSuperAdmin) && (
            <>
              {isOwner && (
                <button onClick={onEdit} className="p-3 rounded-2xl border-2 border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-accent transition-colors">
                  <Edit2 className="w-5 h-5 text-gray-600 dark:text-foreground" />
                </button>
              )}
              <button onClick={onDelete} className="p-3 rounded-2xl border-2 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <Trash2 className="w-5 h-5 text-red-500" />
              </button>
            </>
          )}

          {/* Share button */}
          <div className="relative">
            <button
              onClick={handleShare}
              className="p-3 rounded-2xl border-2 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title={t('spotDetail.share')}
            >
              {shareTooltip ? <Check className="w-5 h-5 text-green-500" /> : <Share2 className="w-5 h-5 text-blue-500" />}
            </button>
            {shareTooltip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap">
                {t('spotDetail.linkCopied')}
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate(localSpot)}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-colors"
          >
            <Navigation className="w-5 h-5" />
            {t('spotDetail.navigateHere')}
          </button>
        </div>
      </div>
    </div>
  );
}
