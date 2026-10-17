import React, { useState, useEffect, useRef } from 'react';
import { X, Navigation, MapPin, Edit2, Trash2, Share2, Check, Flag, Heart, Bookmark } from 'lucide-react';
import StarRating from './StarRating';
import LabeledRatingScale from './LabeledRatingScale';
import { submitCategoryRatings, getSpotSocialState, toggleSpotLike, toggleSpotSave } from '@/api/firebaseClient';
import { useLanguage } from '@/lib/LanguageContext';
import ReportDialog from '@/components/moderation/ReportDialog';
import { canonicalSpotUrl, shareSpotLink } from '@/lib/spotLinks';
import { getPublicSpotPhotos, getSpotDisplayName, getSpotLocationLabel, normalizeSpotPhotos } from '@/lib/spotPresentation';
import CommunityPhotoGallery from './CommunityPhotoGallery';
import { setSpotRelationState } from '@/lib/spotSocialState';
import { toast } from 'sonner';
import { getSpotRating } from '@/lib/spotDiscovery';
import DraftConfirmationDialog from '@/components/ui/DraftConfirmationDialog';
import { safeWebsite } from '@/lib/poiPresentation';

const SocialPostsSection = React.lazy(() => import('@/components/social/SocialPostsSection'));

const RATED_KEY = (spotId, userId) => `sf_rated_${spotId}_${userId || 'guest'}`;

export default function SpotDetailModal({ spot, user, isAdmin = false, onClose, onNavigate, onEdit, onDelete, onSpotUpdate, onShowAuth }) {
  const { t, language } = useLanguage();
  const [localSpot, setLocalSpot] = useState(spot);
  useEffect(() => setLocalSpot(spot), [spot]);
  const [shareTooltip, setShareTooltip] = useState('');
  const [manualShareUrl, setManualShareUrl] = useState('');
  const closeButtonRef = useRef(null);
  useEffect(() => {
    const prior = document.activeElement;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => { document.body.style.overflow = priorOverflow; if (prior?.isConnected && prior !== document.body) prior.focus(); };
  }, []);
  const [social, setSocial] = useState({ liked: false, saved: false, likesCount: spot.likes_count || 0, savesCount: spot.saves_count || 0 });
  const [socialBusy, setSocialBusy] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const displayName = getSpotDisplayName(localSpot, language);
  const creatorName = localSpot.created_by_name || (String(localSpot.created_by || '').includes('@') ? 'Community contributor' : localSpot.created_by) || 'Community contributor';

  useEffect(() => {
    let alive = true;
    setSocial(v => ({ ...v, likesCount: spot.likes_count || 0, savesCount: spot.saves_count || 0 }));
    getSpotSocialState(spot.id, user, {
      likesCount: spot.likes_count,
      savesCount: spot.saves_count,
    }).then(v => alive && setSocial(v)).catch(() => {});
    return () => { alive = false; };
  }, [spot.id, user?.id]);

  const requireVerified = () => {
    if (!user) { onShowAuth?.(); return false; }
    if (!user.emailVerified) { toast.error('Please verify your email before liking or saving spots.'); return false; }
    return true;
  };
  const handleLike = async () => {
    if (!requireVerified() || socialBusy) return;
    const old = social.liked; setSocialBusy('like');
    setSocial(value => setSpotRelationState(value, 'like', !old));
    try {
      await toggleSpotLike(spot.id, user, old);
      window.dispatchEvent(new CustomEvent('spotfinder:collection-changed', { detail: { tabs: ['liked'] } }));
      toast.success(old ? 'Like removed' : 'Spot liked');
    }
    catch (e) { setSocial(value => setSpotRelationState(value, 'like', old)); toast.error(e.message || 'Could not update like'); }
    finally { setSocialBusy(''); }
  };
  const handleSave = async () => {
    if (!requireVerified() || socialBusy) return;
    const old = social.saved; setSocialBusy('save');
    setSocial(value => setSpotRelationState(value, 'save', !old));
    try {
      await toggleSpotSave(spot.id, user, old);
      window.dispatchEvent(new CustomEvent('spotfinder:collection-changed', { detail: { tabs: ['saved'] } }));
      toast.success(old ? 'Removed from favorites' : 'Added to favorites');
    }
    catch (e) { setSocial(value => setSpotRelationState(value, 'save', old)); toast.error(e.message || 'Could not update save'); }
    finally { setSocialBusy(''); }
  };

  const [pendingOverall, setPendingOverall] = useState(0);
  const [pendingAccess, setPendingAccess] = useState(0);
  const [pendingCondition, setPendingCondition] = useState(0);
  const [pendingSafety, setPendingSafety] = useState(0);
  const [pendingCrowdedness, setPendingCrowdedness] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isOwner = !!user && (spot.created_by === user.email || spot.created_by_uid === (user.id || user.uid));

  useEffect(() => {
    try {
      if (localStorage.getItem(RATED_KEY(spot.id, user?.uid || user?.email))) setRatingSubmitted(true);
    } catch (_) {}
  }, [spot.id]);

  const overallRating = getSpotRating(localSpot);
  const overallCount = overallRating === null ? 0 : Number(localSpot.rating_count);

  const catRows = [
    { key: 'access', label: 'Ease of access', val: Number(localSpot.access_rating), count: Number(localSpot.access_rating_count) || 0, labels: ['Very difficult','Difficult','Moderate','Easy','Very easy'] },
    { key: 'condition', label: 'Condition & cleanliness', val: Number(localSpot.condition_rating), count: Number(localSpot.condition_rating_count) || 0, labels: ['Very poor','Poor','Okay','Good','Excellent'] },
    { key: 'safety', label: 'Safety & comfort', val: Number(localSpot.safety_rating), count: Number(localSpot.safety_rating_count) || 0, labels: ['Very uncomfortable','Uncomfortable','Okay','Comfortable','Very safe'] },
    { key: 'crowdedness', label: 'Crowdedness', val: Number(localSpot.crowdedness_rating), count: Number(localSpot.crowdedness_rating_count) || 0, labels: ['Very quiet','Quiet','Moderate','Busy','Very busy'] },
  ];
  const legacyRows = localSpot.rating_schema === 2 ? [] : [
    { key: 'parking', label: 'Parking quality (legacy)', val: Number(localSpot.parking_rating), count: Number(localSpot.parking_rating_count) || 0 },
    { key: 'beauty', label: 'Scenery (legacy)', val: Number(localSpot.beauty_rating), count: Number(localSpot.beauty_rating_count) || 0 },
    { key: 'privacy', label: 'Privacy (legacy)', val: Number(localSpot.privacy_rating), count: Number(localSpot.privacy_rating_count) || 0 },
  ];

  const hasCategoryRatings = [...catRows, ...legacyRows].some(row => row.count > 0 && Number.isFinite(row.val) && row.val >= 1 && row.val <= 5);

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

  const canSubmit = pendingOverall > 0 && !submitting && !isOwner;

  const handleSubmitRatings = async () => {
    if (!canSubmit || !user?.emailVerified) return;
    if (!user) { onShowAuth?.(); return; }
    setSubmitting(true);
    try {
      const updated = await submitCategoryRatings(spot.id, localSpot, {
        overall: pendingOverall,
        access: pendingAccess,
        condition: pendingCondition,
        safety: pendingSafety,
        crowdedness: pendingCrowdedness,
      }, user.id);
      setLocalSpot(updated);
      onSpotUpdate?.(updated);
      try { localStorage.setItem(RATED_KEY(spot.id, user?.id || user?.email), '1'); } catch (_) {}
      setRatingSubmitted(true);
    } catch (err) {
      console.error('Rating submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const [showReport, setShowReport] = useState(false);

  const handleShare = async () => {
    if (!localSpot.is_public || !['published', 'pending_trust'].includes(localSpot.status)) {
      setShareTooltip('Sharing unavailable');
      setTimeout(() => setShareTooltip(''), 2000);
      return;
    }
    const result = await shareSpotLink({ id: String(spot.id), title: displayName });
    if (result === 'shared' || result === 'cancelled') return;
    setManualShareUrl(result === 'unavailable' ? canonicalSpotUrl(String(spot.id)) || '' : '');
    setShareTooltip(result === 'copied' ? 'Link copied' : 'Select and copy the link below');
    setTimeout(() => setShareTooltip(''), 2000);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '';
  const poiMatch = localSpot.poi_match?.name ? localSpot.poi_match : null;
  // Only community uploads are documentary spot photos here. A nearby POI
  // image is not promoted into the gallery unless its identity and full
  // licence metadata have been independently reviewed.
  const detailPhotos = localSpot.status === 'published' && localSpot.is_public
    ? getPublicSpotPhotos(localSpot) : normalizeSpotPhotos(localSpot, localSpot.is_public === true);
  const poiWebsite = safeWebsite(poiMatch?.tags?.website || poiMatch?.tags?.['contact:website']);

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="spot-detail-title" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
      <div className="sf-sheet w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-3xl max-h-[100dvh] sm:max-h-[90dvh] sm:rounded-3xl">

        {/* Header */}
        <div className="sticky top-0 z-30 bg-white dark:bg-card px-4 sm:px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3 border-b border-gray-100 dark:border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <h2 id="spot-detail-title" className="break-words text-lg font-bold leading-snug text-gray-900 dark:text-foreground">{displayName}</h2>
                {poiMatch && displayName !== poiMatch.name && (
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Also known as {poiMatch.name}</p>
                )}
                <p className="mt-0.5 text-xs font-medium text-gray-600 dark:text-muted-foreground">{getSpotLocationLabel(localSpot, 5)}</p>
                <p className="mt-0.5 text-[11px] text-gray-400 dark:text-muted-foreground">
                  {t('spotDetail.addedBy')} {creatorName}
                  {localSpot.created_date && ` ${t('spotDetail.addedOn')} ${formatDate(localSpot.created_date)}`}
                </p>
              </div>
            </div>
            <button ref={closeButtonRef} onClick={onClose} aria-label={t('common.close')} className="min-w-[44px] min-h-[44px] shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-accent">
              <X className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Community photos, or an honest category fallback when unavailable. */}
          <CommunityPhotoGallery key={localSpot.id} spot={localSpot} photos={detailPhotos} name={displayName} />

          {/* Description */}
          {localSpot.description && (
            <p className="text-gray-600 dark:text-muted-foreground text-sm leading-relaxed">{localSpot.description}</p>
          )}
          {!localSpot.description && <p className="text-sm italic text-gray-500 dark:text-muted-foreground">No description has been added yet.</p>}

          {/* Tags */}
          {localSpot.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {localSpot.tags.map(tag => (
                <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {poiMatch && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Nearby place match · {poiMatch.distance_m} m away</p>
              <p className="mt-1 font-semibold text-gray-900 dark:text-foreground">Also known as {poiMatch.name}</p>
              {poiMatch.address && <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-muted-foreground">{poiMatch.address}</p>}
              {poiMatch.categories?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {poiMatch.categories.slice(0, 5).map(category => (
                    <span key={category} className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                      {category.split('.').at(-1).replaceAll('_', ' ')}
                    </span>
                  ))}
                </div>
              )}
              {poiWebsite && (
                <a href={poiWebsite} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-xs font-semibold text-blue-600 underline underline-offset-2 dark:text-blue-400">Visit place website</a>
              )}
            </div>
          )}

          {/* Practical details */}
          {(localSpot.cost || localSpot.access_difficulty || localSpot.parking || localSpot.best_time?.length > 0) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {localSpot.cost && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-medium">
                  {t(`addSpot.cost${localSpot.cost[0].toUpperCase()}${localSpot.cost.slice(1)}`)}
                </span>
              )}
              {localSpot.access_difficulty && (
                <span className="px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-medium">
                  {t(`addSpot.access${localSpot.access_difficulty[0].toUpperCase()}${localSpot.access_difficulty.slice(1)}`)}
                </span>
              )}
              {localSpot.parking && (
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium">
                  {t(`addSpot.parking${localSpot.parking[0].toUpperCase()}${localSpot.parking.slice(1)}`)}
                </span>
              )}
              {localSpot.best_time?.map(bt => (
                <span key={bt} className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-medium">
                  {t(`addSpot.bestTime${bt.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join('')}`)}
                </span>
              ))}
            </div>
          )}

          {/* Directions */}
          {localSpot.directions && (
            <p className="text-xs text-gray-500 dark:text-muted-foreground bg-gray-50 dark:bg-accent/40 rounded-xl px-3 py-2 flex items-start gap-2">
              <Navigation className="w-4 h-4 shrink-0" aria-hidden="true" /> {localSpot.directions}
            </p>
          )}

          {/* Community actions — counts are server-maintained and update live */}
          <div className="grid grid-cols-3 gap-2" aria-label="Spot actions">
            <button onClick={handleLike} disabled={!!socialBusy} aria-pressed={social.liked} aria-label={`${social.liked ? 'Unlike' : 'Like'} this spot; ${social.likesCount} likes`} className={`min-h-[48px] rounded-2xl border flex items-center justify-center gap-2 font-semibold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${social.liked ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/30 dark:border-rose-900' : 'border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-accent'}`}>
              <Heart className={`w-5 h-5 ${social.liked ? 'fill-current' : ''}`} />
              <span className="sr-only">{social.liked ? 'Liked' : 'Like'} </span><span className="tabular-nums text-xs">{social.likesCount}</span>
            </button>
            <button onClick={handleSave} disabled={!!socialBusy} aria-pressed={social.saved} aria-label={`${social.saved ? 'Remove from saved' : 'Save'} this spot; ${social.savesCount} saves`} className={`min-h-[48px] rounded-2xl border flex items-center justify-center gap-2 font-semibold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${social.saved ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/30 dark:border-blue-900' : 'border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-accent'}`}>
              <Bookmark className={`w-5 h-5 ${social.saved ? 'fill-current' : ''}`} />
              <span className="sr-only">{social.saved ? 'Saved' : 'Save'} </span><span className="tabular-nums text-xs">{social.savesCount}</span>
            </button>
            <button onClick={handleShare} className="relative min-h-[48px] rounded-2xl border border-gray-200 dark:border-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-accent" aria-label="Share this spot">{shareTooltip === 'Link copied' ? <Check className="h-5 w-5 text-green-500" /> : <Share2 className="h-5 w-5 text-blue-500" />}{shareTooltip && <span role="status" className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-[10px] text-white">{shareTooltip}</span>}</button>
          </div>
          {manualShareUrl && <label className="block text-xs font-medium text-gray-600 dark:text-slate-300">Spot link
            <input readOnly value={manualShareUrl} onFocus={event => event.target.select()} onClick={event => event.target.select()} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-border dark:bg-slate-900 dark:text-white" />
          </label>}

          {/* Overall experience is rated directly and is never inferred from descriptive scales. */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-accent rounded-2xl">
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-muted-foreground mb-1">{t('spotDetail.overallRating')}</p>
              {overallCount > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex gap-0.5">{renderOverallStars(overallRating)}</div>
                  <span className="font-semibold text-gray-700 dark:text-foreground">{overallRating.toFixed(1)}</span>
                  <span className="text-xs text-gray-400 dark:text-muted-foreground">Based on {overallCount} community {overallCount === 1 ? 'rating' : 'ratings'}</span>
                </div>
              ) : <p className="text-sm font-semibold text-gray-600 dark:text-muted-foreground">Unrated · no community ratings yet</p>}
              {overallCount > 0 && (
                <p className="text-xs text-gray-400 dark:text-muted-foreground mt-0.5 italic">
                  Overall stars are rated directly; the scales describe what the place is like.
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
              {catRows.filter(r => r.count > 0 && Number.isFinite(r.val) && r.val >= 1 && r.val <= 5).map(row => (
                <div key={row.key} className="flex items-center justify-between gap-3 py-1">
                  <span className="text-sm text-gray-700 dark:text-foreground">{row.label}</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-foreground text-right">{row.labels[Math.min(4, Math.max(0, Math.round(row.val)-1))]} · {row.val.toFixed(1)} <span className="text-xs font-normal text-gray-400">({row.count})</span></span>
                </div>
              ))}
              {legacyRows.filter(row => row.count > 0 && Number.isFinite(row.val) && row.val >= 1 && row.val <= 5).map(row => <div key={row.key} className="flex justify-between text-xs text-gray-500 dark:text-gray-400"><span>{row.label}</span><span>{row.val.toFixed(1)} ({row.count})</span></div>)}
              {catRows.some(row => row.key === 'crowdedness' && row.count > 0) && <p className="pt-2 text-[11px] leading-4 text-blue-600 dark:text-blue-300">Crowdedness describes how busy the place feels. A lower score means quieter, not worse.</p>}
            </div>
          )}

          {/* Rate by categories — account required */}
          {!user && !ratingSubmitted && (
            <div className="p-4 bg-gray-50 dark:bg-accent/40 rounded-2xl border border-gray-200 dark:border-border text-center space-y-2">
              <p className="text-sm font-semibold text-gray-700 dark:text-foreground">
                {t('spotDetail.rateCategories')}
              </p>
              <button
                onClick={onShowAuth}
                className="min-h-[44px] px-5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors"
              >
                {t('spotDetail.loginToRate')}
              </button>
            </div>
          )}
          {user && !user.emailVerified && !isOwner && !ratingSubmitted && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">Verify your email to rate this spot.</div>
          )}
          {user && user.emailVerified && !isOwner && !ratingSubmitted && (
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-200 dark:border-purple-800 space-y-3">
              <div className="mb-1">
                <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">
                  {t('spotDetail.rateCategories')}
                </p>
                <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5">
                  Overall stars are rated directly; the scales describe what the place is like.
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-foreground mb-2 block">Overall experience <span className="text-red-500">*</span></label>
                <StarRating value={pendingOverall} onChange={setPendingOverall} size="lg" />
              </div>
              <div><label className="text-sm font-semibold block mb-2">Ease of access</label><LabeledRatingScale value={pendingAccess} onChange={setPendingAccess} labels={['Very difficult','Difficult','Moderate','Easy','Very easy']} /></div>
              <div><label className="text-sm font-semibold block mb-2">Condition & cleanliness</label><LabeledRatingScale value={pendingCondition} onChange={setPendingCondition} labels={['Very poor','Poor','Okay','Good','Excellent']} /></div>
              <div><label className="text-sm font-semibold block mb-2">Safety & comfort</label><LabeledRatingScale value={pendingSafety} onChange={setPendingSafety} labels={['Very uncomfortable','Uncomfortable','Okay','Comfortable','Very safe']} /></div>
              <div><label className="text-sm font-semibold block mb-2">Crowdedness</label><LabeledRatingScale value={pendingCrowdedness} onChange={setPendingCrowdedness} labels={['Very quiet','Quiet','Moderate','Busy','Very busy']} /></div>

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

          <React.Suspense fallback={<div className="h-16 animate-pulse rounded-2xl bg-gray-100 motion-reduce:animate-none dark:bg-accent" />}>
            <SocialPostsSection targetType="spot" targetId={String(spot.id)} targetName={displayName} user={user} />
          </React.Suspense>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-20 px-6 pt-3 border-t border-gray-100 dark:border-border bg-white/95 dark:bg-card/95 backdrop-blur-xl flex gap-3 flex-wrap" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {(isOwner || isAdmin) && (
            <>
              {isOwner && (
                <button onClick={onEdit} aria-label="Edit this spot" className="p-3 rounded-2xl border-2 border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-accent transition-colors">
                  <Edit2 className="w-5 h-5 text-gray-600 dark:text-foreground" />
                </button>
              )}
              <button onClick={() => setShowDeleteConfirm(true)} aria-label="Delete this spot" className="p-3 rounded-2xl border-2 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <Trash2 className="w-5 h-5 text-red-500" />
              </button>
            </>
          )}

          {!isOwner && (
            <button onClick={() => { if (!user) { onShowAuth?.(); return; } setShowReport(true); }} className="p-3 rounded-2xl border-2 border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-accent transition-colors" title="Report spot">
              <Flag className="w-5 h-5 text-gray-500" />
            </button>
          )}

          <button
            onClick={() => onNavigate?.(localSpot)}
            className="flex-1 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-2xl flex items-center justify-center gap-2 transition-colors"
          >
            <Navigation className="w-5 h-5" />
            {t('spotDetail.navigateHere')}
          </button>
        </div>
      </div>
      <ReportDialog open={showReport} onClose={() => setShowReport(false)} user={user} targetType="spot" targetId={String(spot.id)} targetLabel={displayName} targetSnapshot={{ title: displayName, lat: localSpot.lat || '', lon: localSpot.lng || localSpot.lon || '', created_by: localSpot.created_by || '' }} />
      <DraftConfirmationDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}
        title="Delete this spot?" description={`Permanently delete ${displayName}? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete spot'} cancelLabel="Keep spot" destructive busy={deleting}
        onConfirm={async () => {
          setDeleting(true);
          try { await onDelete?.(); setShowDeleteConfirm(false); }
          catch (error) { toast.error(error?.message || 'Could not delete this spot.'); }
          finally { setDeleting(false); }
        }} />
    </div>
  );
}
