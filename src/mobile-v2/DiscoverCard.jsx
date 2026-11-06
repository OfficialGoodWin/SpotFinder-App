import React from 'react';
import { Bookmark, MapPin } from 'lucide-react';
import { discoverRatingLabel } from './discoverSpots';
import { categoryOf, SpotPhoto } from './spotDisplay';
import { useLanguage } from '@/lib/LanguageContext';

export default function DiscoverCard({ spot, title, location, savingSpotId, savedIds, onSave, onOpen, onMap, categoryLabel, ratingLabel, landscape = false, compact = false }) {
  const { t } = useLanguage();
  return <article className="v2-discover-card">
    <button onClick={() => onOpen(spot)}>{landscape ? <span className="sf-new-discover-media"><SpotPhoto spot={spot} className="v2-discover-photo" /></span> : <SpotPhoto spot={spot} className="v2-discover-photo" />}<span className="v2-discover-copy"><small>{categoryLabel || categoryOf(spot)} · {location}</small><strong>{title}</strong><small className="v2-rating">{ratingLabel || discoverRatingLabel(spot)}</small></span></button>
    <div className="v2-discover-actions"><button type="button" aria-label={`${t(savedIds.has(spot.id) ? 'newDiscover.saved' : 'newDiscover.save')}: ${title}`} disabled={savingSpotId === spot.id || savedIds.has(spot.id)} onClick={() => onSave(spot)}><Bookmark size={16} fill={savedIds.has(spot.id) ? 'currentColor' : 'none'} /> {t(savedIds.has(spot.id) ? 'newDiscover.saved' : 'newDiscover.save')}</button>{!compact && <button type="button" onClick={() => onOpen(spot)}>{t('newDiscover.detail')}</button>}<button type="button" aria-label={t('newDiscover.onMapName', { name: title })} onClick={() => onMap(spot)}><MapPin size={16} /> {t('newDiscover.onMap')}</button></div>
  </article>;
}
