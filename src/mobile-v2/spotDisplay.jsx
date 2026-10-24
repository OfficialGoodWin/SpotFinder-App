import React, { useEffect, useState } from 'react';
import { Castle, Coffee, Mountain, Trees } from 'lucide-react';
import { getPublicSpotPhotos, getVerifiedSpotCategory } from '../lib/spotPresentation.js';

export function categoryOf(spot) {
  const value = String(getVerifiedSpotCategory(spot) || '').toLowerCase();
  if (/viewpoint|sunset|sunrise|photo/.test(value)) return 'Vyhlídky';
  if (/castle/.test(value)) return 'Hrady';
  if (/ruin|historic/.test(value)) return 'Zříceniny';
  if (/mountain|waterfall|hiking/.test(value)) return 'Příroda';
  if (/caf|food/.test(value)) return 'Kavárny';
  return 'Ostatní';
}

export function SpotPhoto({ spot, className = '' }) {
  const [failed, setFailed] = useState(false);
  const photo = getPublicSpotPhotos(spot)[0]?.url || spot?.image_url;
  useEffect(() => setFailed(false), [photo]);
  const category = categoryOf(spot);
  const Icon = category === 'Hrady' || category === 'Zříceniny' ? Castle : category === 'Kavárny' ? Coffee : category === 'Příroda' ? Trees : Mountain;
  return photo && !failed
    ? <img className={className} src={photo} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
    : <span className={`v2-photo-fallback ${className}`} role="img" aria-label={`Fotografie není dostupná: ${category}`}><Icon size={25} strokeWidth={1.5} /></span>;
}
