import React, { useState } from 'react';
import { X, Navigation, MapPin, Edit2, Trash2 } from 'lucide-react';
import StarRating from './StarRating';
import { rateSpot, updateSpotRating } from '@/api/firebaseClient';
import { useLanguage } from '@/lib/LanguageContext';

export default function SpotDetailModal({ spot, user, onClose, onNavigate, onEdit, onDelete }) {
  const { t } = useLanguage();
  const [userRating, setUserRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const isOwner = user && spot.created_by === user.email;
  const isSuperAdmin = user && user.email === 'superadmin@spotfinder.cz';

  const handleRate = async (val) => {
    setUserRating(val);
    await rateSpot(spot.id, val);
    const newCount = (spot.rating_count || 0) + 1;
    const newRating = (((spot.rating || 0) * (spot.rating_count || 0)) + val) / newCount;
    await updateSpotRating(spot.id, Math.round(newRating * 10) / 10, newCount);
    setRatingSubmitted(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-card w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-card px-6 pt-5 pb-3 border-b border-gray-100 dark:border-border">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-foreground">{spot.title || 'Spot'}</h2>
                <p className="text-xs text-gray-500 dark:text-muted-foreground">
                  {t('spotDetail.addedBy')} {spot.created_by_name || spot.created_by || 'Unknown'} {spot.created_date && `${t('spotDetail.addedOn')} ${formatDate(spot.created_date)}`}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-accent">
              <X className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {spot.image_url && (
            <img src={spot.image_url} alt="spot" className="w-full h-48 object-cover rounded-2xl" />
          )}

          {spot.description && (
            <p className="text-gray-600 dark:text-muted-foreground text-sm leading-relaxed">{spot.description}</p>
          )}

          {/* Overall Rating */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-accent rounded-2xl">
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1">{t('spotDetail.overallRating')}</p>
              <div className="flex items-center gap-2">
                <StarRating value={Math.round(spot.rating || 0)} readOnly size="md" />
                <span className="text-gray-700 dark:text-foreground font-semibold">{spot.rating ? spot.rating.toFixed(1) : '–'}</span>
                <span className="text-gray-400 dark:text-muted-foreground text-sm">({spot.rating_count || 0} {t('spotDetail.ratings')})</span>
              </div>
            </div>
          </div>

          {/* Individual Ratings */}
          {(spot.parking_rating || spot.beauty_rating || spot.privacy_rating) && (
            <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Detailed Ratings</p>
              
              {spot.parking_rating > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-foreground">{t('spotDetail.parkingQuality')}</span>
                  <div className="flex items-center gap-2">
                    <StarRating value={spot.parking_rating} readOnly size="sm" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-foreground w-8">{spot.parking_rating.toFixed(1)}</span>
                  </div>
                </div>
              )}
              
              {spot.beauty_rating > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-foreground">{t('spotDetail.beauty')}</span>
                  <div className="flex items-center gap-2">
                    <StarRating value={spot.beauty_rating} readOnly size="sm" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-foreground w-8">{spot.beauty_rating.toFixed(1)}</span>
                  </div>
                </div>
              )}
              
              {spot.privacy_rating > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-foreground">{t('spotDetail.privacy')}</span>
                  <div className="flex items-center gap-2">
                    <StarRating value={spot.privacy_rating} readOnly size="sm" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-foreground w-8">{spot.privacy_rating.toFixed(1)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {user && !ratingSubmitted && !isOwner && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">Rate this spot</p>
              <StarRating value={userRating} onChange={handleRate} size="lg" />
            </div>
          )}
          {!user && !ratingSubmitted && (
            <div className="p-4 bg-gray-50 dark:bg-accent rounded-xl text-center border border-gray-200 dark:border-border">
              <p className="text-sm text-gray-500 dark:text-muted-foreground">
                {t('spotDetail.signInToRate')}
              </p>
            </div>
          )}
          {ratingSubmitted && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl text-center text-green-700 dark:text-green-400 text-sm font-semibold">
              ✓ {t('spotDetail.thanksRating')}
            </div>
          )}

          <div className="flex items-center gap-2 text-gray-400 dark:text-muted-foreground text-xs">
            <MapPin className="w-3 h-3" />
            <span>{spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}</span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-border flex gap-3">
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
          <button
            onClick={() => onNavigate(spot)}
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
