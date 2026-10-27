import React, { Suspense, useState } from 'react';
import { Bookmark, Check, Edit2, Flag, Heart, MapPin, Navigation, Share2, Star, Trash2, X } from 'lucide-react';
import CommunityPhotoGallery from '@/components/spots/CommunityPhotoGallery';
import StarRating from '@/components/spots/StarRating';
import LabeledRatingScale from '@/components/spots/LabeledRatingScale';
import { recoverableLazy } from '@/components/ChunkLoadRecovery';
import { getSpotLocationLabel, getVerifiedSpotCategory } from '@/lib/spotPresentation';
import { safeWebsite } from '@/lib/poiPresentation';
import NewSkeleton from './NewSkeleton';

const SocialPostsSection = recoverableLazy(() => import('@/components/social/SocialPostsSection'));

export default function NewSpotDetailView({ spot, photos, name, creatorName, user, isOwner, isAdmin, social, socialBusy, onSave, onLike, onShare, shareTooltip, manualShareUrl, onClose, closeButtonRef, onNavigate, onEdit, onDelete, onReport, onShowAuth, rating, ratingCount, catRows, legacyRows, ratingSubmitted, pending, onPending, submitting, onSubmit, t, language }) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [ratingsOpen, setRatingsOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const category = spot.tags?.[0] ? t(`spotTags.${spot.tags[0]}`, getVerifiedSpotCategory(spot) || 'Místo') : getVerifiedSpotCategory(spot) || 'Místo';
  const poi = spot.poi_match?.name ? spot.poi_match : null;
  const website = safeWebsite(poi?.tags?.website || poi?.tags?.['contact:website']);
  const ratedRows = [...catRows, ...legacyRows].filter(row => row.count > 0 && Number.isFinite(row.val) && row.val >= 1 && row.val <= 5);
  const practical = [
    spot.cost && t(`addSpot.cost${spot.cost[0].toUpperCase()}${spot.cost.slice(1)}`),
    spot.access_difficulty && t(`addSpot.access${spot.access_difficulty[0].toUpperCase()}${spot.access_difficulty.slice(1)}`),
    spot.parking && t(`addSpot.parking${spot.parking[0].toUpperCase()}${spot.parking.slice(1)}`),
    ...(spot.best_time || []).map(value => t(`addSpot.bestTime${value.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join('')}`)),
  ].filter(Boolean);

  const location = getSpotLocationLabel(spot, 5);
  // The shared chooser can only label community spots through `title`/`label`,
  // so hand it the same display name the sheet uses instead of the raw record.
  const navigationLabel = t('poiDetail.navigate');
  const openNavigation = event => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!spot || typeof onNavigate !== 'function') return;
    const destinationName = name || spot.name || spot.title;
    onNavigate({ ...spot, ...(destinationName ? { name: destinationName, title: destinationName } : {}) });
  };
  return <div className="sf-new-detail-view">
    <div className="sf-new-detail-scroll">
      <div className="sf-new-detail-cover">
        <CommunityPhotoGallery key={spot.id} spot={spot} photos={photos} name={name} czech />
        <button ref={closeButtonRef} type="button" className="sf-new-detail-close" onClick={onClose} aria-label="Zavřít detail"><X size={20} /></button>
        <button type="button" className={`sf-new-detail-bookmark${social.saved ? ' is-saved' : ''}`} onClick={onSave} disabled={!!socialBusy} aria-pressed={social.saved} aria-label={social.saved ? 'Odebrat z uložených' : 'Uložit místo'}><Bookmark size={20} fill={social.saved ? 'currentColor' : 'none'} /></button>
      </div>
      <div className="sf-new-detail-content">
        <span className="sf-new-detail-eyebrow">{category}</span>
        <h2 id="spot-detail-title">{name}</h2>
        <p className="sf-new-detail-location"><MapPin size={15} />{location === 'Location unavailable' ? 'Poloha neuvedena' : location}</p>
        <div className="sf-new-detail-chips"><span>{category}</span>{ratingCount > 0 && <span><Star size={13} fill="currentColor" /> {rating.toFixed(1).replace('.', ',')} · {ratingCount}</span>}{practical.slice(0, 3).map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
        <section className="sf-new-detail-description"><h3>O místě</h3>{spot.description ? <><p className={descriptionOpen ? '' : 'is-short'}>{spot.description}</p>{spot.description.length > 160 && <button type="button" onClick={() => setDescriptionOpen(value => !value)}>{descriptionOpen ? 'Zobrazit méně' : 'Číst více'}</button>}</> : <p>Popis místa zatím chybí.</p>}</section>
        <section className="sf-new-detail-rating-invite"><div><Star size={21} /><span><strong>{ratingCount ? `${rating.toFixed(1).replace('.', ',')} z 5` : 'Zatím bez hodnocení'}</strong><small>{ratingCount ? `${ratingCount} hodnocení od komunity` : 'Poděl se o svou zkušenost'}</small></span></div><button type="button" onClick={() => setRatingsOpen(true)}>{isOwner || ratingSubmitted ? 'Zobrazit hodnocení' : 'Ohodnotit místo'}</button></section>
        <div className="sf-new-detail-small-actions"><button type="button" onClick={onLike} disabled={!!socialBusy} aria-pressed={social.liked}><Heart size={17} fill={social.liked ? 'currentColor' : 'none'} /> {social.likesCount}</button><button type="button" onClick={onShare}><Share2 size={17} /> Sdílet{shareTooltip === 'linkCopied' && <Check size={14} />}</button><button type="button" onClick={() => setSocialOpen(true)}>Instagram / TikTok</button></div>
        {shareTooltip && <p className="sf-new-detail-feedback" role="status">{t(`spotDetailUi.${shareTooltip}`)}</p>}
        {manualShareUrl && <label className="sf-new-detail-share-link">Odkaz na místo<input readOnly value={manualShareUrl} onFocus={event => event.target.select()} onClick={event => event.target.select()} /></label>}
        <details className="sf-new-detail-section" open={ratingsOpen} onToggle={event => setRatingsOpen(event.currentTarget.open)}><summary>Hodnocení a zkušenosti</summary><div className="sf-new-detail-section-content">
          <p>{ratingCount ? `Celkové hodnocení ${rating.toFixed(1).replace('.', ',')} z 5 · ${ratingCount} hodnocení` : 'Zatím bez hodnocení.'}</p>
          {ratedRows.length > 0 && <div className="sf-new-detail-ratings-list"><strong>Podrobná hodnocení</strong>{ratedRows.map(row => <div key={row.key}><span>{row.label}</span><b>{row.val.toFixed(1).replace('.', ',')} <small>({row.count})</small></b></div>)}</div>}
          {!ratingSubmitted && !isOwner && !user && <button className="sf-new-detail-action" type="button" onClick={onShowAuth}>Přihlásit se a ohodnotit</button>}
          {!ratingSubmitted && !isOwner && user && !user.emailVerified && <p>Pro hodnocení nejprve ověř svůj e-mail.</p>}
          {!ratingSubmitted && !isOwner && user?.emailVerified && <div className="sf-new-detail-rate-form"><strong>Ohodnoť místo</strong><label>Celkový dojem *</label><StarRating value={pending.overall} onChange={onPending.overall} size="lg" />{catRows.map(row => <div key={row.key}><label>{row.label}</label><LabeledRatingScale value={pending[row.key]} onChange={onPending[row.key]} labels={row.labels} /></div>)}<button type="button" className="sf-new-detail-action" disabled={!pending.overall || submitting} onClick={onSubmit}>{submitting ? 'Ukládám…' : 'Odeslat hodnocení'}</button></div>}
          {ratingSubmitted && <p>Děkujeme za hodnocení.</p>}
        </div></details>
        {(practical.length > 3 || spot.directions || poi || spot.tags?.length > 1) && <details className="sf-new-detail-section"><summary>Další informace</summary><div className="sf-new-detail-section-content">{practical.length > 0 && <div className="sf-new-detail-chips">{practical.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>}{spot.directions && <p>{spot.directions}</p>}{spot.tags?.length > 1 && <p>{spot.tags.slice(1).map(tag => t(`spotTags.${tag}`, tag)).join(' · ')}</p>}{poi && <p>{t('spotDetailUi.alsoKnownAs', { name: poi.name })}{poi.address ? ` · ${poi.address}` : ''}</p>}{website && <a href={website} target="_blank" rel="noopener noreferrer">Web místa</a>}</div></details>}
        <details className="sf-new-detail-section" open={socialOpen} onToggle={event => setSocialOpen(event.currentTarget.open)}><summary>Příspěvky Instagram / TikTok</summary>{socialOpen && <div className="sf-new-detail-section-content"><Suspense fallback={<NewSkeleton kind="detailSection" />}><SocialPostsSection targetType="spot" targetId={String(spot.id)} targetName={name} user={user} /></Suspense></div>}</details>
        <p className="sf-new-detail-credit">Přidal(a) {creatorName}</p>
      </div>
    </div>
    <footer className="sf-new-detail-bottom">{(isOwner || isAdmin) && <>{isOwner && <button type="button" onClick={onEdit} aria-label="Upravit místo"><Edit2 size={19} aria-hidden="true" /></button>}<button type="button" onClick={onDelete} aria-label="Smazat místo"><Trash2 size={19} aria-hidden="true" /></button></>}{!isOwner && <button type="button" onClick={onReport} aria-label="Nahlásit místo"><Flag size={19} aria-hidden="true" /></button>}<button type="button" className="sf-new-detail-go" onClick={openNavigation} aria-label={navigationLabel}><Navigation size={19} aria-hidden="true" /><span>{navigationLabel}</span></button></footer>
  </div>;
}
