import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Navigation, Share2, Camera, Star, Phone, Mail, Globe, MapPin, ChevronUp, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { getPOIPhotos, getPOIRatings, addPOIPhoto, addPOIRating, uploadSpotImage, makePOIId } from '@/api/firebaseClient';


// ─── OSM tag helpers ──────────────────────────────────────────────────────────
function getPhone(tags = {}) { return tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null; }
function getWebsite(tags = {}) { return tags.website || tags['contact:website'] || tags.url || null; }
function getEmail(tags = {}) { return tags.email || tags['contact:email'] || null; }
function getHours(tags = {}) { return tags.opening_hours || null; }
function getDescription(tags = {}) { return tags.description || tags.note || null; }

function parseOpenStatus(ohString) {
  if (!ohString) return null;
  if (ohString.toLowerCase().includes('24/7')) return { isOpen: true, label: 'Open 24/7' };
  try {
    const now = new Date();
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const today = days[now.getDay()];
    const timeNow = now.getHours() * 60 + now.getMinutes();
    for (const rule of ohString.split(';').map(s => s.trim())) {
      const match = rule.match(/^([A-Za-z,\-\s]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
      if (!match) continue;
      const [, dayPart, open, close] = match;
      let todayMatches = false;
      for (const seg of dayPart.split(',').map(s => s.trim())) {
        const range = seg.match(/^([A-Z][a-z])-([A-Z][a-z])$/);
        if (range) {
          const s = days.indexOf(range[1]), e = days.indexOf(range[2]), c = days.indexOf(today);
          if (s !== -1 && e !== -1 && c >= s && c <= e) todayMatches = true;
        } else if (seg === today) todayMatches = true;
      }
      if (!todayMatches) continue;
      const [oh, om] = open.split(':').map(Number);
      const [ch, cm] = close.split(':').map(Number);
      const isOpen = timeNow >= oh * 60 + om && timeNow < ch * 60 + cm;
      return { isOpen, label: `${isOpen ? 'Open' : 'Closed'} · ${open}–${close}` };
    }
  } catch {}
  return null;
}

// ─── Photo fetching ───────────────────────────────────────────────────────────
// Google Places API (needs VITE_GOOGLE_MAPS_KEY env var) → Wikimedia fallback

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';

function getTagPhotos(tags = {}) {
  const urls = [];
  if (tags.image?.startsWith('http')) urls.push(tags.image);
  if (tags.wikimedia_commons?.startsWith('File:')) {
    const file = tags.wikimedia_commons.replace('File:', '');
    urls.push(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1200`);
  }
  return urls;
}

async function fetchGooglePhotos(name, lat, lon) {
  if (!GOOGLE_KEY) return [];
  try {
    const findRes = await fetch(
      `/gplaces/findplacefromtext/json` +
      `?input=${encodeURIComponent(name)}&inputtype=textquery` +
      `&locationbias=circle:100@${lat},${lon}` +
      `&fields=place_id,name,geometry,photos&key=${GOOGLE_KEY}`
    );
    if (!findRes.ok) return [];
    const candidate = (await findRes.json()).candidates?.[0];
    if (!candidate) return [];

    // Reject if too far away (~100m)
    const cLat = candidate.geometry?.location?.lat;
    const cLon = candidate.geometry?.location?.lng;
    if (!cLat || Math.hypot(cLat - lat, cLon - lon) > 0.001) return [];

    let photos = candidate.photos || [];
    if (!photos.length && candidate.place_id) {
      const dr = await fetch(
        `/gplaces/details/json` +
        `?place_id=${candidate.place_id}&fields=photos&key=${GOOGLE_KEY}`
      );
      if (dr.ok) photos = (await dr.json()).result?.photos || [];
    }
    return photos.slice(0, 8).map(p =>
      `/gplaces/photo?maxwidth=1200&photo_reference=${p.photo_reference}&key=${GOOGLE_KEY}`
    );
  } catch { return []; }
}

async function fetchWikimediaPhotos(lat, lon) {
  try {
    const r = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&list=geosearch` +
      `&gscoord=${lat}|${lon}&gsradius=100&gslimit=5&gsnamespace=6&format=json&origin=*`
    );
    if (!r.ok) return [];
    const pages = (await r.json()).query?.geosearch || [];
    if (!pages.length) return [];
    const titles = pages.map(p => p.title).join('|');
    const ir = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json&origin=*`
    );
    if (!ir.ok) return [];
    return Object.values((await ir.json()).query?.pages || {})
      .map(p => p.imageinfo?.[0]?.thumburl).filter(Boolean);
  } catch { return []; }
}

async function tryFetchPhotos(name, lat, lon, tags = {}) {
  const tagPhotos = getTagPhotos(tags);
  if (tagPhotos.length) return tagPhotos;
  if (GOOGLE_KEY) {
    const google = await fetchGooglePhotos(name, lat, lon);
    if (google.length) return google;
  }
  return fetchWikimediaPhotos(lat, lon);
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ photos, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  const touchStartX = useRef(null);

  const prev = useCallback(() => setIdx(i => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % photos.length), [photos.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next, onClose]);

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchStartX.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black flex items-center justify-center"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-sm transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/50 backdrop-blur-sm text-white text-sm font-medium px-3 py-1 rounded-full">
        {idx + 1} / {photos.length}
      </div>

      {/* Prev */}
      {photos.length > 1 && (
        <button
          onClick={prev}
          className="absolute left-3 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white backdrop-blur-sm transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Image */}
      <img
        key={idx}
        src={photos[idx]}
        alt=""
        className="max-w-full max-h-full object-contain select-none"
        style={{ maxHeight: '100dvh', maxWidth: '100dvw' }}
        onError={e => { e.target.src = ''; }}
      />

      {/* Next */}
      {photos.length > 1 && (
        <button
          onClick={next}
          className="absolute right-3 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white backdrop-blur-sm transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white w-4' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stars ────────────────────────────────────────────────────────────────────
function Stars({ value = 0, size = 14, interactive = false, onRate }) {
  const [hover, setHover] = useState(0);
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => {
        const fill = interactive ? (hover || value) >= i ? 1 : 0 : Math.min(Math.max(value - (i - 1), 0), 1);
        return (
          <span key={i} className="relative inline-block leading-none"
            style={{ width: size, height: size, fontSize: size, cursor: interactive ? 'pointer' : 'default' }}
            onMouseEnter={() => interactive && setHover(i)}
            onMouseLeave={() => interactive && setHover(0)}
            onClick={() => interactive && onRate?.(i)}
          >
            <span className="text-gray-200 dark:text-gray-600">★</span>
            <span className="absolute inset-0 overflow-hidden text-amber-400" style={{ width: `${fill * 100}%` }}>★</span>
          </span>
        );
      })}
    </span>
  );
}

function ActionBtn({ icon: Icon, label, onClick, color, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl bg-gray-100 dark:bg-accent/60 hover:bg-gray-200 dark:hover:bg-accent active:scale-95 transition-all disabled:opacity-40 flex-1">
      <Icon className="w-5 h-5" style={{ color: color || undefined }} />
      <span className="text-[11px] font-medium text-gray-700 dark:text-foreground whitespace-nowrap">{label}</span>
    </button>
  );
}

function ContactRow({ icon: Icon, value, href }) {
  const inner = (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-accent/60 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500 dark:text-muted-foreground" />
      </div>
      <span className="text-sm text-foreground break-all">{value}</span>
    </div>
  );
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:bg-gray-50 dark:hover:bg-accent/40 rounded-xl transition-colors">{inner}</a>
    : <div>{inner}</div>;
}

// ─── Mini bar ─────────────────────────────────────────────────────────────────
function MiniBar({ poi, category, sfRating, photoUrl, onExpand, onClose, onNavigate, onShare, onAddPhoto, user, onOpenLightbox }) {
  const avg = sfRating?.count > 0 ? sfRating.avg : 0;
  const count = sfRating?.count || 0;

  return (
    <div className="fixed left-0 right-0 z-[1200] bg-white dark:bg-card shadow-2xl border-t border-gray-100 dark:border-border rounded-t-2xl"
      style={{ bottom: 56 }}>
      <button className="w-full flex justify-center pt-2.5 pb-0" onClick={onExpand}>
        <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-border" />
      </button>
      <button onClick={onClose}
        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 dark:bg-accent flex items-center justify-center z-10">
        <X className="w-3.5 h-3.5 text-foreground" />
      </button>

      <div className="flex items-center gap-3 px-4 pt-2 pb-3 cursor-pointer" onClick={onExpand}>
        <div
          className="w-14 h-14 rounded-full flex-shrink-0 overflow-hidden border-2 flex items-center justify-center"
          style={{ borderColor: category.color, background: `${category.color}18` }}
          onClick={photoUrl ? (e => { e.stopPropagation(); onOpenLightbox(0); }) : undefined}
        >
          {photoUrl
            ? <img src={photoUrl} alt={poi.name} className="w-full h-full object-cover cursor-zoom-in"
                onError={e => { e.target.style.display = 'none'; }} />
            : <span className="text-2xl">{category.icon}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm leading-tight truncate">{poi.name}</p>
          {poi.address && <p className="text-xs text-muted-foreground truncate mt-0.5">{poi.address}</p>}
          {avg > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <Stars value={avg} size={12} />
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">{avg.toFixed(1)}</span>
              {count > 0 && <span className="text-xs text-muted-foreground">({count})</span>}
            </div>
          )}
        </div>
        <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mr-8" />
      </div>

      <div className="flex items-center gap-2 px-4 pb-4">
        <ActionBtn icon={Navigation} label="Navigate" onClick={onNavigate} color={category.color} />
        <ActionBtn icon={Share2} label="Share" onClick={onShare} />
        <ActionBtn icon={Camera} label="Add Photo" onClick={onAddPhoto} disabled={!user} />
      </div>
    </div>
  );
}

// ─── Full sheet ───────────────────────────────────────────────────────────────
function FullSheet({ poi, category, sfPhotos, sfRating, photos, onClose, onNavigate, onShare, onAddPhoto, onSubmitRating, user, onOpenLightbox }) {
  const [ratingVal, setRatingVal] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);

  const tags = poi.tags || {};
  const phone = getPhone(tags), website = getWebsite(tags), email = getEmail(tags);
  const ohRaw = getHours(tags), desc = getDescription(tags), status = parseOpenStatus(ohRaw);
  const avg = sfRating?.count > 0 ? sfRating.avg : 0;
  const count = sfRating?.count || 0;

  const allPhotos = [
    ...photos.map(u => ({ url: u, source: 'remote' })),
    ...sfPhotos.map(p => ({ url: p.image || p.photo, source: 'sf' })),
  ];

  const handleRateSubmit = async () => {
    if (!ratingVal || submitting) return;
    setSubmitting(true);
    await onSubmitRating(ratingVal, ratingComment);
    setSubmitting(false);
    setRatingDone(true);
  };

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-auto bg-white dark:bg-card rounded-t-3xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>

        {/* Hero — clickable to open lightbox */}
        <div
          className="relative bg-gray-100 dark:bg-accent cursor-zoom-in"
          style={{ height: 200 }}
          onClick={allPhotos.length ? () => onOpenLightbox(0) : undefined}
        >
          {allPhotos[0]?.url
            ? <img src={allPhotos[0].url} alt={poi.name} className="w-full h-full object-cover"
                onError={e => { e.target.style.display = 'none'; }} />
            : <div className="w-full h-full flex items-center justify-center" style={{ background: `${category.color}18` }}>
                <span className="text-7xl">{category.icon}</span>
              </div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/50 pointer-events-none" />
          {/* Photo count badge */}
          {allPhotos.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full pointer-events-none">
              1 / {allPhotos.length}
            </div>
          )}
          <button
            onClick={e => { e.stopPropagation(); onClose(); }}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'calc(92vh - 200px)' }}>
          <div className="px-5 pt-4 pb-10">
            <h1 className="text-xl font-bold text-foreground leading-tight">{poi.name}</h1>
            <div className="mt-1.5 mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                style={{ background: category.color }}>
                {category.icon} {category.name}
              </span>
            </div>

            <div className="flex gap-2 mb-5">
              <ActionBtn icon={Navigation} label="Navigate" onClick={onNavigate} color={category.color} />
              <ActionBtn icon={Share2} label="Share" onClick={onShare} />
              <ActionBtn icon={Camera} label="Add Photo" onClick={onAddPhoto} disabled={!user} />
            </div>

            <div className="h-px bg-gray-100 dark:bg-border mb-4" />

            {status && (
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className={`text-sm font-semibold ${status.isOpen ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {status.label}
                </span>
              </div>
            )}
            {ohRaw && !status && (
              <div className="flex items-start gap-2 mb-4">
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">{ohRaw}</span>
              </div>
            )}

            {/* Ratings */}
            <div className="mb-4">
              {avg > 0 ? (
                <div className="flex items-center gap-2 mb-3">
                  <Stars value={avg} size={20} />
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">{avg.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">({count} {count === 1 ? 'review' : 'reviews'})</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-3">No ratings yet — be the first!</p>
              )}
              {!ratingDone ? (
                <div className="bg-gray-50 dark:bg-accent/40 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Rate this place</p>
                  {user ? (
                    <>
                      <Stars value={ratingVal} size={28} interactive onRate={setRatingVal} />
                      {ratingVal > 0 && (
                        <>
                          <textarea value={ratingComment} onChange={e => setRatingComment(e.target.value)}
                            placeholder="Add a comment (optional)"
                            className="mt-3 w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-border bg-white dark:bg-background text-foreground resize-none outline-none focus:ring-2 focus:ring-blue-300"
                            rows={2} />
                          <button onClick={handleRateSubmit} disabled={submitting}
                            className="mt-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
                            style={{ background: category.color }}>
                            {submitting ? 'Submitting…' : 'Submit Rating'}
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sign in to rate this place</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
                  <Star className="w-4 h-4 fill-current" /> Thanks for your rating!
                </div>
              )}
            </div>

            <div className="h-px bg-gray-100 dark:bg-border mb-4" />

            {desc && (
              <>
                <p className="text-sm text-foreground leading-relaxed mb-4">{desc}</p>
                <div className="h-px bg-gray-100 dark:bg-border mb-4" />
              </>
            )}

            {(phone || email || website || poi.lat) && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contact & Info</p>
                {phone && <ContactRow icon={Phone} value={phone} href={`tel:${phone}`} />}
                {email && <ContactRow icon={Mail} value={email} href={`mailto:${email}`} />}
                {website && <ContactRow icon={Globe} value={website} href={website.startsWith('http') ? website : `https://${website}`} />}
                <ContactRow icon={MapPin} value={`${poi.lat.toFixed(6)}, ${poi.lon.toFixed(6)}`}
                  href={`https://maps.google.com/?q=${poi.lat},${poi.lon}`} />
                <div className="h-px bg-gray-100 dark:bg-border mt-2 mb-4" />
              </>
            )}

            {/* Photo gallery */}
            {allPhotos.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Photos ({allPhotos.length})
                  {sfPhotos.length > 0 && <span className="text-green-600 dark:text-green-400 normal-case font-normal ml-1">· {sfPhotos.length} from SpotFinder</span>}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
                  {allPhotos.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => onOpenLightbox(i)}
                      className="flex-shrink-0 w-28 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-accent relative cursor-zoom-in hover:opacity-90 active:scale-95 transition-all"
                    >
                      <img src={p.url} alt="" className="w-full h-full object-cover"
                        onError={e => { e.target.parentNode.style.display = 'none'; }} />
                      {p.source === 'sf' && (
                        <div className="absolute bottom-1 right-1 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">SF</div>
                      )}
                    </button>
                  ))}
                  {user && (
                    <button onClick={onAddPhoto}
                      className="flex-shrink-0 w-28 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-gray-400 transition-colors">
                      <Camera className="w-5 h-5" />
                      <span className="text-xs">Add photo</span>
                    </button>
                  )}
                </div>
              </>
            )}

            {allPhotos.length === 0 && user && (
              <button onClick={onAddPhoto}
                className="w-full h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-gray-400 transition-colors mb-4">
                <Camera className="w-5 h-5" />
                <span className="text-xs">Be the first to add a photo</span>
              </button>
            )}

            {sfRating?.ratings?.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">SpotFinder Reviews</p>
                <div className="space-y-3">
                  {sfRating.ratings.slice(0, 5).map(r => (
                    <div key={r.id} className="bg-gray-50 dark:bg-accent/40 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Stars value={r.rating} size={12} />
                        <span className="text-xs text-muted-foreground">{r.created_by?.split('@')[0] || 'User'}</span>
                      </div>
                      {r.comment && <p className="text-sm text-foreground">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function POIDetailPanel({ poi, category, onClose, onNavigate, user }) {
  const [expanded, setExpanded] = useState(false);
  const [sfPhotos, setSfPhotos] = useState([]);
  const [sfRating, setSfRating] = useState({ ratings: [], avg: 0, count: 0 });
  const [photos, setPhotos] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(null); // null = closed
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!poi) return;
    setExpanded(false);
    setPhotos([]);
    setLightboxIndex(null);

    const poiId = makePOIId(poi.lat, poi.lon, poi.name);
    getPOIPhotos(poiId).then(setSfPhotos);
    getPOIRatings(poiId).then(r => setSfRating(
      Array.isArray(r)
        ? { ratings: r, avg: r.length ? Math.round(r.reduce((s, x) => s + x.rating, 0) / r.length * 10) / 10 : 0, count: r.length }
        : (r || { ratings: [], avg: 0, count: 0 })
    ));
    tryFetchPhotos(poi.name, poi.lat, poi.lon, poi.tags || {}).then(urls => { if (urls.length) setPhotos(urls); });
  }, [poi?.id]);

  const handleShare = async () => {
    const url = `https://maps.google.com/?q=${poi.lat},${poi.lon}`;
    try {
      if (navigator.share) await navigator.share({ title: poi.name, text: poi.address || poi.name, url });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(`${poi.name}\n${url}`); alert('Link copied!'); }
      else window.open(url, '_blank');
    } catch (e) { if (e.name !== 'AbortError') window.open(url, '_blank'); }
  };

  const handleAddPhoto = () => { if (user) fileInputRef.current?.click(); };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const poiId = makePOIId(poi.lat, poi.lon, poi.name);
    try {
      const dataUrl = await uploadSpotImage(file);
      await addPOIPhoto(poiId, dataUrl, user.email);
      setSfPhotos(prev => [{ id: Date.now(), image: dataUrl, created_by: user.email }, ...prev]);
    } catch (err) { console.error('Photo upload failed:', err); }
    e.target.value = '';
  };

  const handleSubmitRating = async (rating, comment) => {
    const poiId = makePOIId(poi.lat, poi.lon, poi.name);
    await addPOIRating(poiId, rating, comment, user?.email);
    getPOIRatings(poiId).then(r => setSfRating(
      Array.isArray(r)
        ? { ratings: r, avg: r.length ? Math.round(r.reduce((s, x) => s + x.rating, 0) / r.length * 10) / 10 : 0, count: r.length }
        : r
    ));
  };

  const handleNavigate = () => { onNavigate?.({ lat: poi.lat, lng: poi.lon, label: poi.name }); onClose(); };

  // All photos merged for lightbox
  const allPhotoUrls = [
    ...photos,
    ...sfPhotos.map(p => p.image || p.photo).filter(Boolean),
  ];

  if (!poi) return null;

  const sharedProps = {
    poi, category, sfPhotos, sfRating, photos,
    onClose, onNavigate: handleNavigate, onShare: handleShare,
    onAddPhoto: handleAddPhoto, user,
    onOpenLightbox: (i) => setLightboxIndex(i),
  };

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {expanded
        ? <FullSheet {...sharedProps} onSubmitRating={handleSubmitRating} />
        : <MiniBar {...sharedProps} photoUrl={photos[0] || null} onExpand={() => setExpanded(true)} />}

      {lightboxIndex !== null && allPhotoUrls.length > 0 && (
        <Lightbox
          photos={allPhotoUrls}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}