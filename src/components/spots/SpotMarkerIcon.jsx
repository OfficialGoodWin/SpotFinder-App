import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Footprints, Play, Star } from 'lucide-react';
import { getSpotMarkerTheme, getSpotRating } from './spotMarkerTheme';

const ACCESS_STYLE = {
  easy: { label: 'Easy walk', className: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-700' },
  moderate: { label: 'Short hike', className: 'border-orange-200/80 bg-orange-50/85 text-orange-700' },
  hard: { label: 'Challenging hike', className: 'border-rose-200/80 bg-rose-50/85 text-rose-700' },
};

export default function SpotMarkerIcon({
  spot,
  category = spot?.tags?.[0],
  hasVideo = Boolean(spot?.has_social || spot?.video_url),
  className = '',
}) {
  const theme = getSpotMarkerTheme(category);
  const rating = getSpotRating(spot);
  const reduceMotion = useReducedMotion();
  const Icon = theme.Icon;
  const access = ACCESS_STYLE[spot?.access_difficulty];

  return (
    <motion.div
      className={`sf-premium-marker group relative h-[88px] w-[96px] select-none ${className}`}
      initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.08 }}
      whileTap={reduceMotion ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 430, damping: 24, mass: 0.65 }}
      style={{ '--marker-accent': theme.accent, '--marker-glow': theme.glow }}
    >
      <div
        className="sf-premium-marker__card absolute left-1/2 top-0 flex h-[72px] w-[88px] -translate-x-1/2 flex-col items-center justify-center overflow-hidden rounded-[22px] border border-white/70 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,.92)] backdrop-blur-xl"
        style={{
          background: theme.gradient,
          borderColor: `${theme.accent}80`,
          boxShadow: `0 11px 30px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,.95)`,
        }}
      >
        <div className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-90" />
        <div
          className="grid h-10 w-10 place-items-center rounded-[15px] border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,.85),0_5px_14px_rgba(15,23,42,.15)]"
          style={{ background: `linear-gradient(145deg, white, ${theme.accent}24)`, color: theme.accentStrong }}
        >
          <Icon className="h-[23px] w-[23px] drop-shadow-[0_2px_2px_rgba(255,255,255,.9)]" strokeWidth={2.4} />
        </div>

        <div className="mt-1 flex items-center gap-1">
          <div className="flex items-center gap-1 rounded-full border border-white/70 bg-white/65 px-2 py-0.5 text-[10px] font-extrabold leading-none text-slate-800 shadow-sm backdrop-blur-md">
            {rating !== 'New' && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-500" />}
            <span>{rating}</span>
          </div>
          {access && (
            <span
              className={`grid h-[17px] w-[17px] place-items-center rounded-full border shadow-sm backdrop-blur-md ${access.className}`}
              title={access.label}
              aria-label={access.label}
            >
              <Footprints className="h-2.5 w-2.5" strokeWidth={2.5} />
            </span>
          )}
        </div>

        {hasVideo && (
          <span
            className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border border-white/80 bg-slate-950/75 text-white shadow-[0_0_15px_var(--marker-glow)] backdrop-blur-lg"
            aria-label="Video available"
          >
            <Play className="ml-0.5 h-3 w-3 fill-current" />
          </span>
        )}
      </div>

      <div
        className="absolute left-1/2 top-[64px] h-[17px] w-[17px] -translate-x-1/2 rotate-45 rounded-[4px] border-b border-r border-white/80"
        style={{ background: `linear-gradient(135deg, ${theme.accent}dd, ${theme.accentStrong})`, boxShadow: `5px 5px 14px ${theme.glow}` }}
      />

    </motion.div>
  );
}

