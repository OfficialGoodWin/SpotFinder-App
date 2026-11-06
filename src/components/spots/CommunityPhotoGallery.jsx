import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import SpotImage from './SpotImage';
import { nextPhotoIndex, visiblePhotoIndex } from './photoGalleryState';

function safeLink(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}

function PhotoCredit({ metadata, czech = false }) {
  if (!metadata) return null;
  const credit = [metadata.attribution || metadata.creator, metadata.license].filter(Boolean).join(' · ');
  const source = safeLink(metadata.source_url);
  const license = safeLink(metadata.license_url);
  if (!credit && !source && !license) return null;
  return <p className="text-xs leading-relaxed text-muted-foreground">
    {credit && <>{czech ? 'Foto' : 'Photo'}: {credit} </>}
    {metadata.modified && <span>{czech ? 'Upraveno' : 'Modified'} · </span>}
    {source && <a href={source} target="_blank" rel="noopener noreferrer" className="underline">{czech ? 'Zdroj' : 'Source'}</a>}
    {source && license && ' · '}
    {license && <a href={license} target="_blank" rel="noopener noreferrer" className="underline">{czech ? 'Licence' : 'License'}</a>}
  </p>;
}

export default function CommunityPhotoGallery({ spot, photos, name, czech = false }) {
  const [selected, setSelected] = useState(0);
  const [failedUrls, setFailedUrls] = useState(() => new Set());
  const [lightbox, setLightbox] = useState(false);
  const closeRef = useRef(null);
  const viewerRef = useRef(null);
  const openerRef = useRef(null);
  const touchRef = useRef(null);
  const displayIndex = visiblePhotoIndex(photos, selected, failedUrls);
  const photo = photos[displayIndex];
  const failPhoto = url => {
    setFailedUrls(current => new Set([...current, url]));
    setSelected(current => {
      const next = photos.findIndex((item, index) => index !== current && item.url !== url && !failedUrls.has(item.url));
      return next < 0 ? current : next;
    });
  };
  useEffect(() => {
    if (!lightbox) return undefined;
    openerRef.current = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.body.style.overflow = overflow; openerRef.current?.focus?.(); };
  }, [lightbox]);
  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = event => {
      if (event.key === 'Escape') setLightbox(false);
      if (event.key === 'ArrowLeft') setSelected(value => nextPhotoIndex(photos, value, failedUrls, -1));
      if (event.key === 'ArrowRight') setSelected(value => nextPhotoIndex(photos, value, failedUrls, 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox, photos, failedUrls]);
  if (!photo) return <div className="h-44 overflow-hidden rounded-2xl"><SpotImage spot={{ ...spot, image_url: null, image_urls: [] }} /></div>;
  return <div className="space-y-2">
    <button type="button" onClick={() => setLightbox(true)} className="block w-full overflow-hidden rounded-2xl bg-muted text-left focus-visible:ring-2 focus-visible:ring-primary" aria-label={czech ? `Zobrazit fotografii místa ${name}` : `View ${name} photo full screen`}>
      <SpotImage key={photo.url} spot={spot} src={photo.url} alt={name} className="h-52 w-full object-cover" fallbackClassName="h-52" onImageError={failPhoto} />
    </button>
    <PhotoCredit metadata={photo.metadata} czech={czech} />
    {photos.length > 1 && <div className="flex gap-2 overflow-x-auto pb-1" aria-label={czech ? 'Další fotografie' : 'Additional distinct photographs'}>
      {photos.map((item, index) => <button key={item.url} type="button" onClick={() => setSelected(index)} disabled={failedUrls.has(item.url)} aria-label={czech ? `Vybrat fotografii ${index + 1} z ${photos.length}` : `Select photo ${index + 1} of ${photos.length}`} aria-current={item.url === photo.url ? 'true' : undefined}
        className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 ${item.url === photo.url ? 'border-primary' : 'border-transparent'}`}>
        <SpotImage spot={spot} src={item.metadata?.thumbnail_url || item.thumbnail_url || item.url} alt="" className="h-full w-full object-cover" />
      </button>)}
    </div>}
    {lightbox && createPortal(<div ref={viewerRef} onTouchStart={event => { touchRef.current = { x: event.touches[0]?.clientX, y: event.touches[0]?.clientY }; }} onTouchEnd={event => { if (!touchRef.current || photos.length < 2) return; const dx = event.changedTouches[0].clientX - touchRef.current.x; const dy = event.changedTouches[0].clientY - touchRef.current.y; touchRef.current = null; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) setSelected(value => nextPhotoIndex(photos, value, failedUrls, dx < 0 ? 1 : -1)); }} onKeyDown={event => {
      event.stopPropagation();
      if (event.key !== 'Tab') return;
      const focusable = [...viewerRef.current.querySelectorAll('button,a[href]')];
      const index = focusable.indexOf(document.activeElement);
      if (event.shiftKey && index === 0) { event.preventDefault(); focusable.at(-1)?.focus(); }
      else if (!event.shiftKey && index === focusable.length - 1) { event.preventDefault(); focusable[0]?.focus(); }
    }} className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-black p-3 text-white" role="dialog" aria-modal="true" aria-label={czech ? `Fotografie místa ${name}` : `${name} photo viewer`}>
      <button ref={closeRef} type="button" onClick={() => setLightbox(false)} className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 grid h-11 w-11 place-items-center rounded-full bg-black/70" aria-label={czech ? 'Zavřít fotografii' : 'Close photo viewer'}><X /></button>
      <SpotImage key={photo.url} spot={spot} src={photo.url} alt={czech ? `${name}, fotografie ${displayIndex + 1} z ${photos.length}` : `${name}, photo ${displayIndex + 1} of ${photos.length}`} className="max-h-[75dvh] max-w-full object-contain" fallbackClassName="h-52" onImageError={failPhoto} />
      <div className="mt-2 max-h-24 overflow-y-auto text-center"><PhotoCredit metadata={photo.metadata} czech={czech} /></div>
      {photos.length > 1 && <div className="mt-3 flex items-center gap-5">
        <button type="button" onClick={() => setSelected(value => nextPhotoIndex(photos, value, failedUrls, -1))} className="grid h-11 w-11 place-items-center rounded-full bg-white/15" aria-label={czech ? 'Předchozí fotografie' : 'Previous photo'}><ChevronLeft /></button>
        <span>{displayIndex + 1} / {photos.length}</span>
        <button type="button" onClick={() => setSelected(value => nextPhotoIndex(photos, value, failedUrls, 1))} className="grid h-11 w-11 place-items-center rounded-full bg-white/15" aria-label={czech ? 'Další fotografie' : 'Next photo'}><ChevronRight /></button>
      </div>}
    </div>, document.body)}
  </div>;
}
