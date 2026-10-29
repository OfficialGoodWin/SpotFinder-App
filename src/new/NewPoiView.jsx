import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, Flag, Globe, Mail, MapPin, Navigation, Phone, Share2, Star, X } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { normalizePoiPhotos, safeWebsite } from '@/lib/poiPresentation';
import { iconGlyphSVG } from '@/lib/mapIcons';
import { recoverableLazy } from '@/components/ChunkLoadRecovery';
import { toast } from 'sonner';
import { newPoiText } from './newPoiPresentation';
import NewPoiHours from './NewPoiHours';
import './new-poi.css';

const SocialPostsSection = recoverableLazy(() => import('@/components/social/SocialPostsSection'));

function Photo({ photo, title, category, onOpen, compact = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo?.url]);
  if (photo?.url && !failed) return <button type="button" className={`sf-new-poi-photo${compact ? ' is-compact' : ''}`} onClick={onOpen} aria-label={title}><img src={photo.thumbnail_url || photo.url} alt={title} onError={() => setFailed(true)} /></button>;
  return <span className={`sf-new-poi-icon${compact ? ' is-compact' : ''}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconGlyphSVG(category?.key || 'default', compact ? 25 : 32, '#194b30') }} />;
}

function Rating({ rating, loading, language, t }) {
  if (loading) return <span className="sf-new-poi-rating-loading" aria-label={t('newSkeleton.loading')} />;
  if (!rating?.count || !Number.isFinite(rating.avg)) return <span className="sf-new-poi-unrated">{t('poiDetail.noRatings')}</span>;
  return <span className="sf-new-poi-rating"><Star size={15} fill="currentColor" /> {new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating.avg)} <small>({rating.count})</small></span>;
}

function photoCredit(credit, language) {
  if (!language?.startsWith('cs')) return credit;
  return credit?.replace(/^Photo:/, 'Fotografie:').replace('Unknown author', 'Neznámý autor');
}

export default function NewPoiView({ poi, category, visibleText, sfRating, ratingsLoading, ratingsError, sfPhotos, photos, expanded, onExpand, onClose, onNavigate, onShare, onAddPhoto, onEditOfficial, onSubmitRating, onOpenLightbox, onReportPOI, onReportPhoto, socialTargetId, user, poiIdentity, identityChecked, linkedSpotId, linkCandidates, linkBusy, onLoadLinkCandidates, onLinkSpot }) {
  const { t, language } = useLanguage();
  const { title, categoryLabel, address } = newPoiText(poi, category, language, visibleText);
  const allPhotos = normalizePoiPhotos(photos, sfPhotos);
  const leadPhoto = allPhotos[0];
  const [ratingVal, setRatingVal] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  const ownRating = sfRating?.ratings?.find(row => row.created_by_uid === (user?.uid || user?.id));
  useEffect(() => {
    if (ratingDone) return;
    setRatingVal(ownRating?.rating || 0);
    setRatingComment(ownRating?.comment || '');
  }, [ownRating?.id, ratingDone]);
  const [socialOpen, setSocialOpen] = useState(false);
  const [selectedLinkSpot, setSelectedLinkSpot] = useState('');
  const closeRef = useRef(null);
  useEffect(() => { if (expanded) closeRef.current?.focus(); }, [expanded]);
  const published = poi.enrichment || {};
  const tags = { ...(poi.tags || {}), ...(published.attributes || {}), ...(published.phone ? { phone: published.phone } : {}), ...(published.website ? { website: published.website } : {}), ...(Object.prototype.hasOwnProperty.call(published, 'openingHours') ? { opening_hours: published.openingHours } : {}) };
  const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'];
  const email = tags.email || tags['contact:email'];
  const website = safeWebsite(tags.website || tags['contact:website'] || tags.url);
  const hoursSource = Object.prototype.hasOwnProperty.call(published, 'openingHours') || Object.prototype.hasOwnProperty.call(published.attributes || {}, 'opening_hours') ? 'SpotFinder' : 'OpenStreetMap';
  const coordinate = Number.isFinite(poi.lat) && Number.isFinite(poi.lon) ? `${poi.lat.toFixed(6)}, ${poi.lon.toFixed(6)}` : '';
  const submitRating = async () => {
    if (!ratingVal || submitting) return;
    setSubmitting(true);
    try { if (await onSubmitRating(ratingVal, ratingComment) !== false) setRatingDone(true); }
    catch (error) { toast.error(error?.message || (language?.startsWith('cs') ? 'Hodnocení se nepodařilo odeslat.' : 'Could not submit rating.')); }
    finally { setSubmitting(false); }
  };

  if (!expanded) return <section className="sf-new-poi-preview" aria-label={title}>
    <div className="sf-new-poi-preview-main"><Photo photo={leadPhoto} title={title} category={category} compact onOpen={() => onOpenLightbox(0)} /><div className="sf-new-poi-preview-copy"><span className="sf-new-poi-category">{categoryLabel}</span><h2>{title}</h2>{address && <p><MapPin size={13} />{address}</p>}{ratingsError ? <span className="sf-new-poi-unrated">{language?.startsWith('cs') ? 'Hodnocení není dostupné' : 'Ratings unavailable'}</span> : <Rating rating={sfRating} loading={ratingsLoading} language={language} t={t} />}</div><button type="button" className="sf-new-poi-close" aria-label={t('common.close')} onClick={onClose}><X size={19} /></button></div>
    <div className="sf-new-poi-preview-actions"><button type="button" onClick={onNavigate}><Navigation size={17} />{t('poiDetail.navigate')}</button><button type="button" onClick={onExpand}>{t('poiDetailUi.expand')}</button></div>
    {leadPhoto?.credit && <small className="sf-new-poi-preview-credit">{photoCredit(leadPhoto.credit, language)}</small>}
    <a className="sf-new-poi-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© {language?.startsWith('cs') ? 'Přispěvatelé OpenStreetMap' : 'OpenStreetMap contributors'}</a>
  </section>;

  return <div className="sf-new-poi-backdrop" onClick={onClose}><section className="sf-new-poi-detail" role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <header className="sf-new-poi-header"><button ref={closeRef} type="button" onClick={onClose} aria-label={t('poiDetailUi.closeDetails')}><ChevronLeft size={22} /></button><span>SpotFinder</span><button type="button" onClick={onShare} aria-label={t('poiDetail.share')}><Share2 size={19} /></button></header>
    <div className="sf-new-poi-scroll">
      {leadPhoto ? <div className="sf-new-poi-cover"><Photo photo={leadPhoto} title={title} category={category} onOpen={() => onOpenLightbox(0)} />{leadPhoto.credit && <p>{photoCredit(leadPhoto.credit, language)}{safeWebsite(leadPhoto.source) && <> · <a href={safeWebsite(leadPhoto.source)} target="_blank" rel="noopener noreferrer">{t('poiDetailUi.source')}</a></>}{safeWebsite(leadPhoto.license_url) && <> · <a href={safeWebsite(leadPhoto.license_url)} target="_blank" rel="noopener noreferrer">{t('poiDetailUi.license')}</a></>}</p>}</div> : <div className="sf-new-poi-fallback"><Photo title={title} category={category} /></div>}
      <div className="sf-new-poi-content"><span className="sf-new-poi-category">{categoryLabel}</span><h1>{title}</h1>{address && <p className="sf-new-poi-address"><MapPin size={17} />{address}</p>}<div className="sf-new-poi-meta">{ratingsError ? <span className="sf-new-poi-unrated">{language?.startsWith('cs') ? 'Hodnocení není dostupné' : 'Ratings unavailable'}</span> : <Rating rating={sfRating} loading={ratingsLoading} language={language} t={t} />}</div>
      <NewPoiHours raw={tags.opening_hours} lat={poi.lat} lon={poi.lon} language={language} source={tags.opening_hours ? hoursSource : null} />
      <div className="sf-new-poi-actions"><button type="button" onClick={onShare}><Share2 size={17} />{t('poiDetail.share')}</button><button type="button" onClick={onAddPhoto} disabled={!user || !poiIdentity}><Camera size={17} />{t('poiDetail.addPhoto')}</button>{onEditOfficial && <button type="button" onClick={onEditOfficial}>{t('officialEditor.editThisPoi')}</button>}</div>
      {identityChecked && !poiIdentity && <p className="sf-new-poi-identity-note">{language?.startsWith('cs') ? 'K tomuto bodu chybí ověřený odkaz na OpenStreetMap; přidávání fotografií a propojení zatím není dostupné.' : 'This place has no verified OpenStreetMap reference; photo contributions and linking are unavailable.'}</p>}
      {poiIdentity && <section className="sf-new-poi-section sf-new-poi-link"><h2>{language?.startsWith('cs') ? 'Komunitní místo' : 'Community spot'}</h2>{linkedSpotId ? <p>{language?.startsWith('cs') ? 'Tento bod je propojený s komunitním místem.' : 'This POI is linked to a community spot.'}</p> : user ? <><p>{language?.startsWith('cs') ? 'Jde o stejné skutečné místo jako některé z tvých publikovaných míst? Propoj je pouze po osobním ověření.' : 'Is this the same real place as one of your published spots? Link only after checking.'}</p>{linkCandidates === null ? <button type="button" onClick={onLoadLinkCandidates} disabled={linkBusy}>{language?.startsWith('cs') ? 'Vybrat moje místo' : 'Choose my spot'}</button> : linkCandidates.length ? <div className="sf-new-poi-link-choice"><select aria-label={language?.startsWith('cs') ? 'Komunitní místo k propojení' : 'Community spot to link'} value={selectedLinkSpot} onChange={event => setSelectedLinkSpot(event.target.value)}><option value="">{language?.startsWith('cs') ? 'Vyber místo' : 'Choose a spot'}</option>{linkCandidates.map(spot => <option key={spot.id} value={spot.id}>{spot.title || spot.name}</option>)}</select><button type="button" disabled={!selectedLinkSpot || linkBusy} onClick={() => onLinkSpot(selectedLinkSpot)}>{language?.startsWith('cs') ? 'Potvrdit propojení' : 'Confirm link'}</button></div> : <p>{language?.startsWith('cs') ? 'Nemáš žádné dostupné publikované místo.' : 'No eligible published spot is available.'}</p>}</> : null}</section>}
      {visibleText.description && <section className="sf-new-poi-section"><h2>{language?.startsWith('cs') ? 'O místě' : 'About this place'}</h2><p>{visibleText.description}</p></section>}
      <section className="sf-new-poi-section"><h2>{language?.startsWith('cs') ? 'Hodnocení a zkušenosti' : t('poiDetail.spotfinderReviews')}</h2><div className="sf-new-poi-rating-summary">{ratingsError ? <span className="sf-new-poi-unrated">{language?.startsWith('cs') ? 'Hodnocení se nepodařilo načíst.' : 'Could not load ratings.'}</span> : <Rating rating={sfRating} loading={ratingsLoading} language={language} t={t} />}{!ratingsError && sfRating?.count > 0 && <span>{sfRating.count} {sfRating.count === 1 ? t('poiDetail.review') : t('poiDetail.reviews')}</span>}</div>
        {ratingDone ? <p>{t('poiDetail.thanksRating')}</p> : user ? <div className="sf-new-poi-rate"><strong>{t('poiDetail.rateThisPlace')}</strong><div role="group" aria-label={t('poiDetail.rateThisPlace')}>{[1, 2, 3, 4, 5].map(value => <button type="button" key={value} aria-label={`${value} / 5`} aria-pressed={ratingVal === value} onClick={() => setRatingVal(value)}><Star size={28} fill={ratingVal >= value ? 'currentColor' : 'none'} /></button>)}</div>{ratingVal > 0 && <><textarea value={ratingComment} onChange={event => setRatingComment(event.target.value)} placeholder={t('poiDetail.addComment')} rows={3} maxLength={1000} /><button type="button" className="sf-new-poi-submit" disabled={submitting} onClick={submitRating}>{submitting ? t('poiDetail.submitting') : t('poiDetail.submitRating')}</button></>}</div> : <p>{t('poiDetail.signInToRate')}</p>}
        {sfRating?.ratings?.length > 0 && <div className="sf-new-poi-reviews">{sfRating.ratings.slice(0, 5).map((review, index) => <article key={review.id || index}><span><Star size={14} fill="currentColor" /> {review.rating} / 5</span>{review.comment && <p>{review.comment}</p>}</article>)}</div>}
      </section>
      <section className="sf-new-poi-section"><h2>{t('poiDetail.photos')} ({allPhotos.length})</h2><div className="sf-new-poi-gallery">{allPhotos.slice(1).map((photo, index) => <div key={photo.url}><button type="button" onClick={() => onOpenLightbox(index + 1)} aria-label={t('poiDetailUi.photoPosition', { number: index + 2, total: allPhotos.length })}><img src={photo.thumbnail_url || photo.url} alt="" loading="lazy" /></button>{photo.kind === 'sf' && <button type="button" className="sf-new-poi-photo-report" onClick={() => onReportPhoto(photo)} aria-label={t('poiDetailUi.reportPhoto')}><Flag size={14} /></button>}</div>)}<button type="button" className="sf-new-poi-photo-add" onClick={onAddPhoto} disabled={!user || !poiIdentity}><Camera size={21} />{allPhotos.length ? t('poiDetail.addPhoto') : t('poiDetail.beFirstPhoto')}</button></div>{allPhotos.slice(1).some(photo => photo.credit) && <small className="sf-new-poi-credit">{[...new Set(allPhotos.slice(1).map(photo => photo.credit).filter(Boolean))].map(credit => photoCredit(credit, language)).join(' · ')}</small>}</section>
      {(phone || email || website || coordinate) && <details className="sf-new-poi-section sf-new-poi-disclosure"><summary>{t('poiDetail.contactInfo')}</summary><div>{phone && <a href={`tel:${phone}`}><Phone size={17} />{phone}</a>}{email && <a href={`mailto:${email}`}><Mail size={17} />{email}</a>}{website && <a href={website} target="_blank" rel="noopener noreferrer"><Globe size={17} />{website}</a>}{coordinate && <a href={`https://maps.google.com/?q=${poi.lat},${poi.lon}`} target="_blank" rel="noopener noreferrer"><MapPin size={17} />{coordinate}</a>}</div></details>}
      {(visibleText.shortSummary || published.wikipedia?.text) && <details className="sf-new-poi-section sf-new-poi-disclosure"><summary>{language?.startsWith('cs') ? 'Další informace' : 'More information'}</summary>{visibleText.shortSummary && <p>{visibleText.shortSummary}</p>}{published.wikipedia?.text && <><p>{published.wikipedia.text}</p><small>{published.wikipedia.attribution} <a href={published.wikipedia.url} target="_blank" rel="noopener noreferrer">{t('poiDetailUi.source')}</a></small></>}</details>}
      <details className="sf-new-poi-section sf-new-poi-disclosure" onToggle={event => setSocialOpen(event.currentTarget.open)}><summary>{language?.startsWith('cs') ? 'Příspěvky Instagram / TikTok' : 'Instagram / TikTok posts'}</summary>{socialOpen && <Suspense fallback={<div className="sf-new-poi-loading" aria-label={t('newSkeleton.loading')} />}><SocialPostsSection targetType="poi" targetId={socialTargetId} targetName={title} user={user} /></Suspense>}</details>
      <button type="button" className="sf-new-poi-report" onClick={onReportPOI}><Flag size={15} />{t('poiDetailUi.reportPlace')}</button>
      <a className="sf-new-poi-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© {language?.startsWith('cs') ? 'Přispěvatelé OpenStreetMap' : 'OpenStreetMap contributors'}</a>
      </div>
    </div><footer className="sf-new-poi-footer"><button type="button" onClick={onNavigate}><Navigation size={19} />{t('poiDetail.navigate')}</button></footer>
  </section></div>;
}
