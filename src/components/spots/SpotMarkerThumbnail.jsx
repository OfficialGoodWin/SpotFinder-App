import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Image as ImageIcon, Play, Star } from 'lucide-react';
import { getSpotMarkerTheme, getSpotRating } from './spotMarkerTheme';

export default function SpotMarkerThumbnail({
  spot,
  category = spot?.tags?.[0],
  label = spot?.title || 'Secret spot',
  imageUrl = spot?.image_url,
  hasVideo = Boolean(spot?.has_social || spot?.video_url),
  className = '',
}) {
  const theme = getSpotMarkerTheme(category);
  const rating = getSpotRating(spot);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={`sf-premium-marker group relative h-[102px] w-[116px] select-none ${className}`}
      initial={reduceMotion ? false : { opacity: 0, y: 7, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={reduceMotion ? undefined : { y: -5, scale: 1.08 }}
      whileTap={reduceMotion ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 430, damping: 24, mass: 0.7 }}
      style={{ '--marker-accent': theme.accent, '--marker-glow': theme.glow }}
    >
      <div
        className="sf-premium-marker__card absolute left-1/2 top-0 h-[82px] w-[108px] -translate-x-1/2 overflow-hidden rounded-[22px] border-2 bg-slate-200/80 backdrop-blur-xl"
        style={{ borderColor: `${theme.accent}bb`, boxShadow: `0 12px 34px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,.65)` }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
        ) : (
          <div className="grid h-full w-full place-items-center" style={{ background: theme.gradient }}>
            <ImageIcon className="h-7 w-7" style={{ color: theme.accentStrong }} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-white/10" />
        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1.5">
          <span className="max-w-[70px] truncate rounded-full border border-white/25 bg-black/35 px-2 py-1 text-[9px] font-extrabold leading-none text-white shadow-sm backdrop-blur-lg">
            #{theme.label.replace(/\s/g, '')}
          </span>
          <span className="flex items-center gap-0.5 rounded-full border border-white/25 bg-black/40 px-1.5 py-1 text-[9px] font-extrabold leading-none text-white backdrop-blur-lg">
            {rating !== 'New' && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />}
            {rating}
          </span>
        </div>
        {hasVideo && (
          <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border border-white/50 bg-black/45 text-white shadow-[0_0_18px_var(--marker-glow)] backdrop-blur-xl" aria-label="Play video">
            <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
          </span>
        )}
      </div>

      <div
        className="absolute left-1/2 top-[74px] h-[17px] w-[17px] -translate-x-1/2 rotate-45 rounded-[4px] border-b-2 border-r-2 border-white/80"
        style={{ background: theme.accent, borderColor: `${theme.accent}cc`, boxShadow: `5px 5px 14px ${theme.glow}` }}
      />
      <div className="sf-premium-marker__label absolute left-1/2 top-[94px] max-w-[170px] -translate-x-1/2 truncate rounded-full border border-white/25 bg-slate-950/86 px-2.5 py-1 font-sans text-[11px] font-bold leading-none tracking-[-0.01em] text-white shadow-[0_5px_16px_rgba(15,23,42,.34)] backdrop-blur-xl">
        {label}
      </div>
    </motion.div>
  );
}

