import React, { useState, useEffect, useCallback } from 'react';
import { X, Navigation, MapPin, Edit2, Trash2, Share2, Check, Image, Globe, ExternalLink, Loader2 } from 'lucide-react';
import StarRating from './StarRating';
import { submitCategoryRatings } from '@/api/firebaseClient';
import { useLanguage } from '@/lib/LanguageContext';
import { searchPlacesWithDetails } from '@/api/mapyPOIService';

const MAPY_API_KEY = 'aZQcHL3uznHNI_dIUHIMrc9Oes4EhkbMBS6muOSNUNk';

const RATED_KEY = (spotId, userId) => `sf_rated_${spotId}_${userId || 'guest'}`;

export default function SpotDetailModal({ spot, user, onClose, onNavigate, onEdit, onDelete, onSpotUpdate }) {
  const { t, language } = useLanguage();
  const [localSpot, setLocalSpot] = useState(spot);
  const [shareTooltip, setShareTooltip] = useState(false);
  const [mapyDetails, setMapyDetails] = useState(null);
  const [loadingMapy, setLoadingMapy] = useState(false);
  const [mapyError, setMapyError] = useState(null);

  const [pendingParking, setPendingParking] = useState(0);
  const [pendingBeauty,  setPendingBeauty]  = useState(0);
  const [pendingPrivacy, setPendingPrivacy] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isOwner      = user && spot.created_by === user.email;
  const isSuperAdmin = user && user.email === 'superadmin@spotfinder.cz';

  useEffect(() => {
    try {
      if (localStorage.getItem(RATED_KEY(spot.id, user?.uid || user?.email))) setRatingSubmitted(true);
    } catch (_) {}
  }, [spot.id]);

  // Fetch additional details from Mapy.cz if no image/description
  const fetchMapyDetails = useCallback(async () => {
    // Skip if we already have an image and description
    if (localSpot.image_url && localSpot.description) {
      return;
    }

    setLoadingMapy(true);
    setMapyError(null);

    try {
      // Search for the place by name or coordinates
      const searchQuery = localSpot.title || localSpot.name || `${localSpot.lat}, ${localSpot.lng}`;
      const center = { lat: localSpot.lat, lng: localSpot.lng };
      
      const results = await searchPlacesWithDetails(searchQuery, center, language, 5);
      
      // Find the closest match
      if (results && results.length > 0) {
        // Sort by distance if coordinates available
        const withDistance = results.map(r => {
          if (r.lat && r.lon) {
            const dist = Math.sqrt(
              Math.pow(r.lat - localSpot.lat, 2) + 
              Math.pow(r.lon - localSpot.lng, 2)
            );
            return { ...r, distance: dist };
          }
          return { ...r, distance: Infinity };
        });
        
        // Sort by distance and name match
        withDistance.sort((a, b) => {
          // Prefer name matches
          const aNameMatch = a.name?.toLowerCase() === searchQuery?.toLowerCase() ? 0 : 1;
          const bNameMatch = b.name?.toLowerCase() === searchQuery?.toLowerCase() ? 0 : 1;
          if (aNameMatch !== bNameMatch) return aNameMatch - bNameMatch;
          return a.distance - b.distance;
        });
        
        const bestMatch = withDistance[0];
        
        if (bestMatch && (bestMatch.photo || bestMatch.description)) {
          setMapyDetails(bestMatch);
        }
      }
    } catch (error) {
      console.warn('Could not fetch Mapy.cz details:', error);
      setMapyError('Could not load additional details');
    } finally {
      setLoadingMapy(false);
    }
  }, [localSpot, language]);

  useEffect(() => {
    fetchMapyDetails();
  }, [fetchMapyDetails]);

  const overallRating = localSpot.rating || 0;
  const overallCount  = localSpot.rating_count || 0;

  const catRows = [
    { key: 'parking', label: t('spotDetail.parkingQuality'), val: localSpot.parking_rating || 0, count: localSpot.parking_rating_count || 0 },
    { key: 'beauty',  label: t('spotDetail.beauty'),         val: localSpot.beauty_rating  || 0, count: localSpot.beauty_rating_count  || 0 },
    { key: 'privacy', label: t('spotDetail.privacy'),        val: localSpot.privacy_rating || 0, count: localSpot.privacy_rating_count || 0 },
  ];

  const hasCategoryRatings = catRows.some(r => r.val > 0);

  // Get the best available image
  const displayImage = localSpot.image_url || mapyDetails?.photo || null;
  const displayDescription = localSpot.description || mapyDetails?.description || null;

  // Fractional star display for overall
  const renderOverallStars = (value) =>
    [1, 2, 3, 4, 5].map(star => {
      const fill = Math.min(Math.max(value - (star - 1), 0), 1);
      return (
        <span key={star} className="relative inline-block text-2xl leading-none">
          <span className="text-gray-200 dark:text-gray-600">★</span>
          <span className="absolute inset-0 overflow-hidden text-yellow-400" style={{ width: `${fill * 100}%` }}>★</span>
        </span>
      );
    });

  const canSubmit = (pendingParking > 0 || pendingBeauty > 0 || pendingPrivacy > 0) && !submitting;

  const handleSubmitRatings = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const updated = await submitCategoryRatings(spot.id, localSpot, {
        parking: pendingParking,
        beauty:  pendingBeauty,
        privacy: pendingPrivacy,
      });
      setLocalSpot(updated);
      onSpotUpdate?.(updated);
      try { localStorage.setItem(RATED_KEY(spot.id, user?.uid || user?.email), '1'); } catch (_) {}
      setRatingSubmitted(true);
    } catch (err) {
      console.error('Rating submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?spot=${spot.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: spot.title || 'Spot', text: displayDescription || 'Check out this spot!', url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareTooltip(true);
        setTimeout(() => setShareTooltip(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(url).catch(() => {});
      setShareTooltip(true);
      setTimeout(() => setShareTooltip(false), 2000);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '';

  // Open in Mapy.cz
  const openInMapy = () => {
    const url = `https://mapy.cz/zakladni?x=${localSpot.lng}&y=${localSpot.lat}&z=16&source=coor&id=${localSpot.lng}%2C${localSpot.lat}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-card w-full max-w-lg rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-card px-6 pt-5 pb-3 border-b border-gray-100 dark:border-border z-10">
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
          {displayImage && (
            <img 
              src={displayImage} 
              alt={localSpot.title || 'spot'} 
              className="w-full h-48 object-cover rounded-2xl"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          )}
          
          {/* Loading Mapy.cz details */}
          {loadingMapy && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500 dark:text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading details from Mapy.cz...
            </div>
          )}

          {/* No image placeholder */}
          {!displayImage && !loadingMapy && (
            <div className="w-full h-32 bg-gray-100 dark:bg-accent rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-muted-foreground">
              <Image className="w-8 h-8" />
              <span className="text-xs">No image available</span>
            </div>
          )}

          {/* Description */}
          {displayDescription && (
            <p className="text-gray-600 dark:text-muted-foreground text-sm leading-relaxed">{displayDescription}</p>
          )}
          
          {/* Mapy.cz rating if available */}
          {mapyDetails?.rating && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-yellow-500">★</span>
              <span className="font-medium text-gray-700 dark:text-foreground">{mapyDetails.rating.toFixed(1)}</span>
              <span className="text-gray-400 dark:text-muted-foreground text-xs">(Mapy.cz)</span>
            </div>
          )}

          {/* Overall Rating — read-only, derived from category reviews */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-accent rounded-2xl">
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1">{t('spotDetail.overallRating')}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-0.5">{renderOverallStars(overallRating)}</div>
                <span className="text-gray-700 dark:text-foreground font-semibold">
                  {overallRating ? overallRating.toFixed(1) : '–'}
                </span>
                <span className="text-gray-400 dark:text-muted-foreground text-xs">
                  ({overallCount} {t('spotDetail.ratings')})
                </span>
              </div>
              {overallCount > 0 && (
                <p className="text-xs text-gray-400 dark:text-muted-foreground mt-0.5 italic">
                  {t('spotDetail.calculatedFromCategories') || 'Calculated from category ratings'}
                </p>
              )}
            </div>
          </div>

          {/* Category averages display */}
          {hasCategoryRatings && (
            <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-3">
                {t('spotDetail.detailedRatings')}
              </p>
              {catRows.filter(r => r.val > 0).map(row => (
                <div key={row.key} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 dark:text-foreground w-28 flex-shrink-0">{row.label}</span>
                  <div className="flex items-center gap-1.5 flex-1 justify-end">
                    {/* Fractional stars for category averages too */}
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(star => {
                        const fill = Math.min(Math.max(row.val - (star - 1), 0), 1);
                        return (
                          <span key={star} className="relative inline-block text-lg leading-none">
                            <span className="text-gray-200 dark:text-gray-600">★</span>
                            <span className="absolute inset-0 overflow-hidden text-yellow-400" style={{ width: `${fill * 100}%` }}>★</span>
                          </span>
                        );
                      })}
                    </div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-foreground w-8 text-right">
                      {row.val.toFixed(1)}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-muted-foreground w-16 text-right">
                      ({row.count} {t('spotDetail.ratings')})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rate by categories — account required */}
          {!user && !ratingSubmitted && (
            <div className="p-4 bg-gray-50 dark:bg-accent/40 rounded-2xl border border-gray-200 dark:border-border text-center space-y-1">
              <p className="text-sm font-semibold text-gray-700 dark:text-foreground">
                {t('spotDetail.rateCategories')}
              </p>
              <p className="text-xs text-gray-500 dark:text-muted-foreground">
                {t('spotDetail.loginToRate') || 'Sign in to leave a rating'}
              </p>
            </div>
          )}
          {user && !isOwner && !ratingSubmitted && (
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-200 dark:border-purple-800 space-y-3">
              <div className="mb-1">
                <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">
                  {t('spotDetail.rateCategories')}
                </p>
                <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5">
                  {t('spotDetail.overallAutoCalc') || 'Overall score is automatically calculated from your ratings'}
                </p>
              </div>

              {[
                { label: t('spotDetail.parkingQuality'), val: pendingParking, set: setPendingParking },
                { label: t('spotDetail.beauty'),         val: pendingBeauty,  set: setPendingBeauty  },
                { label: t('spotDetail.privacy'),        val: pendingPrivacy, set: setPendingPrivacy },
              ].map(({ label, val, set }) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-700 dark:text-foreground w-28 flex-shrink-0">{label}</span>
                  <div className="flex items-center gap-2">
                    <StarRating value={val} onChange={set} size="md" />
                    {val > 0 && (
                      <span className="text-sm font-bold text-purple-700 dark:text-purple-300 w-4">{val}</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Live preview of this review's overall */}
              {(pendingParking > 0 || pendingBeauty > 0 || pendingPrivacy > 0) && (() => {
                const vals = [pendingParking, pendingBeauty, pendingPrivacy].filter(x => x > 0);
                const preview = vals.reduce((s, x) => s + x, 0) / vals.length;
                return (
                  <div className="flex items-center justify-between pt-2 border-t border-purple-200 dark:border-purple-700 mt-1">
                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                      {t('spotDetail.yourOverall') || 'Your overall'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[1,2,3,4,5].map(star => {
                        const fill = Math.min(Math.max(preview - (star - 1), 0), 1);
                        return (
                          <span key={star} className="relative inline-block text-lg leading-none">
                            <span className="text-gray-200 dark:text-gray-600">★</span>
                            <span className="absolute inset-0 overflow-hidden text-yellow-400" style={{ width: `${fill * 100}%` }}>★</span>
                          </span>
                        );
                      })}
                      <span className="text-sm font-bold text-purple-700 dark:text-purple-300 ml-1">
                        {preview.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={handleSubmitRatings}
                disabled={!canSubmit}
                className="w-full py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm disabled:opacity-40 hover:bg-purple-700 active:scale-95 transition-all flex items-center justify-center gap-2 mt-1"
              >
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                  : t('spotDetail.submitRatings')
                }
              </button>
            </div>
          )}

          {ratingSubmitted && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl text-center text-green-700 dark:text-green-400 text-sm font-semibold">
              ✓ {t('spotDetail.thanksCategoryRating') || t('spotDetail.thanksRating')}
            </div>
          )}

          {/* Coordinates */}
          <div className="flex items-center gap-2 text-gray-400 dark:text-muted-foreground text-xs">
            <MapPin className="w-3 h-3" />
            <span>{localSpot.lat?.toFixed(5)}, {localSpot.lng?.toFixed(5)}</span>
          </div>
        </div>

        {/* Footer */}
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
