import React, { useState, useEffect } from 'react';
import { X, Navigation, MapPin, Edit2, Trash2, Share2, Check, Flag, Heart, Bookmark } from 'lucide-react';
import StarRating from './StarRating';
import LabeledRatingScale from './LabeledRatingScale';
import { submitCategoryRatings, getSpotSocialState, toggleSpotLike, toggleSpotSave } from '@/api/firebaseClient';
import { useLanguage } from '@/lib/LanguageContext';
import ReportDialog from '@/components/moderation/ReportDialog';
import NavigationProviderSheet from '@/components/navigation/NavigationProviderSheet';

const RATED_KEY = (spotId, userId) => `sf_rated_${spotId}_${userId || 'guest'}`;

export default function SpotDetailModal({ spot, user, isAdmin = false, onClose, onNavigate, onEdit, onDelete, onSpotUpdate, onShowAuth }) {
  const { t } = useLanguage();
  const [localSpot, setLocalSpot] = useState(spot);
  const [shareTooltip, setShareTooltip] = useState(false);
  const [social, setSocial] = useState({ liked: false, saved: false, likesCount: spot.likes_count || 0, savesCount: spot.saves_count || 0 });
  const [socialBusy, setSocialBusy] = useState('');
  const [showNavigationProviders, setShowNavigationProviders] = useState(false);

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
    if (!user.emailVerified) { alert('Please verify your email before liking or saving spots.'); return false; }
    return true;
  };
  const handleLike = async () => {
    if (!requireVerified() || socialBusy) return;
    const old = social.liked; setSocialBusy('like');
    setSocial(v => ({ ...v, liked: !old, likesCount: Math.max(0, v.likesCount + (old ? -1 : 1)) }));
    try { await toggleSpotLike(spot.id, user, old); }
    catch (e) { setSocial(v => ({ ...v, liked: old, likesCount: Math.max(0, v.likesCount + (old ? 1 : -1)) })); alert(e.message || 'Could not update like'); }
    finally { setSocialBusy(''); }
  };
  const handleSave = async () => {
    if (!requireVerified() || socialBusy) return;
    const old = social.saved; setSocialBusy('save');
    setSocial(v => ({ ...v, saved: !old, savesCount: Math.max(0, v.savesCount + (old ? -1 : 1)) }));
    try { await toggleSpotSave(spot.id, user, old); }
    catch (e) { setSocial(v => ({ ...v, saved: old, savesCount: Math.max(0, v.savesCount + (old ? 1 : -1)) })); alert(e.message || 'Could not update save'); }
    finally { setSocialBusy(''); }
  };

  const [pendingOverall, setPendingOverall] = useState(0);
  const [pendingAccess, setPendingAccess] = useState(0);
  const [pendingCondition, setPendingCondition] = useState(0);
  const [pendingSafety, setPendingSafety] = useState(0);
  const [pendingCrowdedness, setPendingCrowdedness] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isOwner      = user && spot.created_by === user.email;

  useEffect(() => {
    try {
      if (localStorage.getItem(RATED_KEY(spot.id, user?.uid || user?.email))) setRatingSubmitted(true);
    } catch (_) {}
  }, [spot.id]);

  const overallRating = localSpot.rating || 0;
  const overallCount  = localSpot.rating_count || 0;

  const catRows = [
    { key: 'access', label: 'Ease of access', val: localSpot.access_rating || 0, count: localSpot.access_rating_count || 0, labels: ['Very difficult','Difficult','Moderate','Easy','Very easy'] },
    { key: 'condition', label: 'Condition & cleanliness', val: localSpot.condition_rating || 0, count: localSpot.condition_rating_count || 0, labels: ['Very poor','Poor','Okay','Good','Excellent'] },
    { key: 'safety', label: 'Safety & comfort', val: localSpot.safety_rating || 0, count: localSpot.safety_rating_count || 0, labels: ['Very uncomfortable','Uncomfortable','Okay','Comfortable','Very safe'] },
    { key: 'crowdedness', label: 'Crowdedness', val: localSpot.crowdedness_rating || 0, count: localSpot.crowdedness_rating_count || 0, labels: ['Very quiet','Quiet','Moderate','Busy','Very busy'] },
  ];
  const legacyRows = localSpot.rating_schema === 2 ? [] : [
    { key: 'parking', label: 'Parking quality (legacy)', val: localSpot.parking_rating || 0, count: localSpot.parking_rating_count || 0 },
    { key: 'beauty', label: 'Scenery (legacy)', val: localSpot.beauty_rating || 0, count: localSpot.beauty_rating_count || 0 },
    { key: 'privacy', label: 'Privacy (legacy)', val: localSpot.privacy_rating || 0, count: localSpot.privacy_rating_count || 0 },
  ];

  const hasCategoryRatings = catRows.some(r => r.val > 0) || legacyRows.some(r => r.val > 0);

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

  const canSubmit = pendingOverall > 0 && !submitting;

  const handleSubmitRatings = async () => {
    if (!canSubmit) return;
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
    const url = `${window.location.origin}${window.location.pathname}?spot=${spot.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: spot.title || 'Spot', text: spot.description || 'Check out this spot!', url });
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
  const uploadedPhotos = (Array.isArray(localSpot.image_urls) && localSpot.image_urls.length
    ? localSpot.image_urls
    : [localSpot.image_url]).filter(Boolean);
  const poiMatch = localSpot.poi_match?.name ? localSpot.poi_match : null;
  const detailPhotos = [
    ...uploadedPhotos.map(url => ({ url, source: 'community' })),
    ...(poiMatch?.image_url && !uploadedPhotos.includes(poiMatch.image_url)
      ? [{ url: poiMatch.image_url, source: 'poi', credit: poiMatch.image_credit }]
      : []),
  ];
  const poiWebsite = poiMatch?.tags?.website || poiMatch?.tags?.['contact:website'];

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
                {poiMatch && (
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Also known as {poiMatch.name}</p>
                )}
                <p className="text-xs text-gray-500 dark:text-muted-foreground">
                  {t('spotDetail.addedBy')} {localSpot.created_by_name || localSpot.created_by || 'Anonymous'}
                  {localSpot.created_date && ` ${t('spotDetail.addedOn')} ${formatDate(localSpot.created_date)}`}
                </p>
              </div>
            </div>
            <button onClick={onClose} aria-label={t('common.close')} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-accent">
              <X className="w-5 h-5 text-gray-500 dark:text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Community photos plus a safely attributed POI reference image, when available. */}
          {detailPhotos.length > 0 && (
            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-2xl">
                <img src={detailPhotos[0].url} alt={localSpot.title || 'Spot'} loading="lazy" decoding="async" className="h-52 w-full object-cover" />
                {detailPhotos[0].source === 'poi' && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">{detailPhotos[0].credit || 'POI reference photo'}</span>
                )}
              </div>
              {detailPhotos.length > 1 && (
                <div className="grid grid-cols-3 gap-2">
                  {detailPhotos.slice(1).map((photo, index) => (
                    <div key={`${photo.url}-${index}`} className="relative aspect-square overflow-hidden rounded-xl">
                      <img src={photo.url} alt={`${localSpot.title || 'Spot'} photo ${index + 2}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      {photo.source === 'poi' && <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[9px] text-white">POI</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {localSpot.description && (
            <p className="text-gray-600 dark:text-muted-foreground text-sm leading-relaxed">{localSpot.description}</p>
          )}

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
              {poiWebsite && /^https?:\/\//i.test(poiWebsite) && (
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
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleLike} disabled={!!socialBusy} aria-pressed={social.liked} aria-label={`${social.liked ? 'Unlike' : 'Like'} this spot; ${social.likesCount} likes`} className={`min-h-[48px] rounded-2xl border flex items-center justify-center gap-2 font-semibold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${social.liked ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/30 dark:border-rose-900' : 'border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-accent'}`}>
              <Heart className={`w-5 h-5 ${social.liked ? 'fill-current' : ''}`} />
              <span>{social.liked ? 'Liked' : 'Like'}</span><span className="tabular-nums text-xs opacity-70">{social.likesCount}</span>
            </button>
            <button onClick={handleSave} disabled={!!socialBusy} aria-pressed={social.saved} aria-label={`${social.saved ? 'Remove from saved' : 'Save'} this spot; ${social.savesCount} saves`} className={`min-h-[48px] rounded-2xl border flex items-center justify-center gap-2 font-semibold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${social.saved ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/30 dark:border-blue-900' : 'border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-accent'}`}>
              <Bookmark className={`w-5 h-5 ${social.saved ? 'fill-current' : ''}`} />
              <span>{social.saved ? 'Saved' : 'Save'}</span><span className="tabular-nums text-xs opacity-70">{social.savesCount}</span>
            </button>
          </div>

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
              {catRows.filter(r => r.val > 0).map(row => (
                <div key={row.key} className="flex items-center justify-between gap-3 py-1">
                  <span className="text-sm text-gray-700 dark:text-foreground">{row.label}</span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-foreground text-right">{row.labels[Math.max(0, Math.round(row.val)-1)]} · {row.val.toFixed(1)} <span className="text-xs font-normal text-gray-400">({row.count})</span></span>
                </div>
              ))}
              {legacyRows.filter(r => r.val > 0).map(row => <div key={row.key} className="flex justify-between text-xs text-gray-400"><span>{row.label}</span><span>{row.val.toFixed(1)} ({row.count})</span></div>)}
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

          {/* Coordinates */}
          <div className="flex items-center gap-2 text-gray-400 dark:text-muted-foreground text-xs">
            <MapPin className="w-3 h-3" />
            <span>{localSpot.lat?.toFixed(5)}, {localSpot.lng?.toFixed(5)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-border flex gap-3 flex-wrap" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {(isOwner || isAdmin) && (
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

          {!isOwner && (
            <button onClick={() => { if (!user) { onShowAuth?.(); return; } setShowReport(true); }} className="p-3 rounded-2xl border-2 border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-accent transition-colors" title="Report spot">
              <Flag className="w-5 h-5 text-gray-500" />
            </button>
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
            onClick={() => setShowNavigationProviders(true)}
            className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-colors"
          >
            <Navigation className="w-5 h-5" />
            {t('spotDetail.navigateHere')}
          </button>
        </div>
      </div>
      <ReportDialog open={showReport} onClose={() => setShowReport(false)} user={user} targetType="spot" targetId={String(spot.id)} targetLabel={localSpot.title || 'Spot'} targetSnapshot={{ title: localSpot.title || '', lat: localSpot.lat || '', lon: localSpot.lng || localSpot.lon || '', created_by: localSpot.created_by || '' }} />
      <NavigationProviderSheet
        open={showNavigationProviders}
        destination={localSpot}
        onClose={() => setShowNavigationProviders(false)}
        onInternalNavigate={onNavigate}
      />
    </div>
  );
}
