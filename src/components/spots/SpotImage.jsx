import React, { useEffect, useState } from 'react';
import { Castle, ImageOff, Landmark, MapPin, Mountain } from 'lucide-react';
import { getSpotImagePresentation, getVerifiedSpotCategory } from '@/lib/spotPresentation';

function fallbackFor(spot) {
  const category = getVerifiedSpotCategory(spot);
  if (category === 'castle') return { Icon: Castle, label: 'Castle — photo unavailable' };
  if (category === 'viewpoint') return { Icon: Mountain, label: 'Viewpoint — photo unavailable' };
  if (category?.startsWith('historic')) return { Icon: Landmark, label: 'Historic place — photo unavailable' };
  return { Icon: MapPin, label: 'Photo unavailable' };
}

export default function SpotImage({ spot, src, alt = '', className = '', fallbackClassName = '' }) {
  const [failed, setFailed] = useState(false);
  const presentation = getSpotImagePresentation(spot, { src, loadFailed: failed });
  const image = presentation.kind === 'image' ? presentation.imageInfo : null;
  useEffect(() => setFailed(false), [src, spot?.image_url]);

  if (image?.url && !failed) {
    return <img src={image.url} alt={alt} loading="lazy" decoding="async" className={className} onError={() => setFailed(true)} />;
  }

  const { Icon, label } = fallbackFor(spot);
  return (
    <div className={`grid h-full w-full place-items-center bg-gradient-to-br from-emerald-50 to-slate-100 text-slate-500 dark:from-emerald-950/35 dark:to-slate-900 dark:text-slate-400 ${fallbackClassName}`} role="img" aria-label={label}>
      <div className="text-center">
        <span className="relative mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-white/75 shadow-sm dark:bg-white/10">
          <Icon className="h-6 w-6 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          {failed && <ImageOff className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-white p-0.5 text-slate-500 dark:bg-slate-900" aria-hidden="true" />}
        </span>
        <span className="mt-2 block px-2 text-[11px] font-medium">{label}</span>
      </div>
    </div>
  );
}
