import React from 'react';
import SpotMarkerIcon from './SpotMarkerIcon';
import SpotMarkerThumbnail from './SpotMarkerThumbnail';

const PREVIEWS = [
  { id: 'sunset', title: 'Golden Hour Ridge', tags: ['Sunset'], rating: 4.9, rating_count: 142, access_difficulty: 'moderate', has_social: true },
  { id: 'waterfall', title: 'Hidden Cascade', tags: ['Waterfall'], rating: 4.8, rating_count: 89, access_difficulty: 'hard', has_social: true },
  { id: 'cafe', title: 'Backstreet Brew', tags: ['SecretCafe'], rating: 4.7, rating_count: 64, access_difficulty: 'easy', has_social: true },
];

export default function SpotMarkerPreviewGrid({ thumbnails = {} }) {
  return (
    <section className="rounded-[32px] border border-white/60 bg-gradient-to-br from-emerald-50 via-sky-50 to-stone-100 p-6 shadow-xl">
      <div className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-600">SpotFinder marker system</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Discover your next main-character spot</h2>
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        {PREVIEWS.map((spot, index) => (
          <article key={spot.id} className="relative grid min-h-52 place-items-center overflow-hidden rounded-[26px] border border-white/70 bg-white/45 p-7 shadow-sm backdrop-blur-xl">
            <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_30%_30%,white_0,transparent_38%),linear-gradient(135deg,#d9f99d_0%,#bae6fd_55%,#e7e5e4_100%)]" />
            <div className="relative pb-8">
              {index === 1
                ? <SpotMarkerThumbnail spot={spot} imageUrl={thumbnails[spot.id]} />
                : <SpotMarkerIcon spot={spot} />}
            </div>
            <span className="relative mt-2 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm backdrop-blur">#{spot.tags[0]}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

